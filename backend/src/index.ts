import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const BRANDS = [
  'Samsung', 'Apple', 'Huawei', 'Motorola', 'Nokia', 'Sony', 'Xiaomi'
];

const AD_TYPE_OPTIONS = [
  { value: 'nabidka', label: 'Nabídka (Prodej)' },
  { value: 'poptavka', label: 'Poptávka (Koupě)' },
];

const parseDate = (dateString: string): Date | null => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateString.includes('Dnes')) {
        return today;
    }
    if (dateString.includes('Včera')) {
        return yesterday;
    }

    const parts = dateString.match(/(\d+)\. (\d+)\. (\d{4})?/);
    if (parts && parts[1] && parts[2]) {
        const day = parseInt(parts[1], 10);
        const month = parseInt(parts[2], 10) - 1;
        let year = today.getFullYear();
        if (parts[3]) {
            year = parseInt(parts[3], 10);
        }
        const date = new Date(year, month, day);
        if (date > today && !parts[3]) {
            date.setFullYear(year - 1);
        }
        return date;
    }
    return null;
};

const parsePrice = (priceString: string): number | null => {
  if (!priceString) return null;
  const cleanedPrice = priceString.replace(/[^0-9,-]+/g, '').replace(',', '.');
  const price = parseFloat(cleanedPrice);
  return isNaN(price) ? null : price;
};

async function scrapeUrl(url: string, brand: string, adType: string, selectors: any) {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    const scrapedAds: any[] = [];
    let currentPageUrl = url;
    let hasNextPage = true;
    let pagesScraped = 0;

    console.log(`Starting scrape for ${brand} (${adType}) at ${url}`);

    while (scrapedAds.length < 50 && hasNextPage && pagesScraped < 50) {
        console.log(`Scraping page: ${currentPageUrl}`);
        pagesScraped++;

        const response = await axios.get(currentPageUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const $ = cheerio.load(response.data);
        const urlObject = new URL(currentPageUrl);
        const baseUrl = urlObject.origin;

        const items = $(selectors.item);
        if (items.length === 0) {
            console.log('No items found on page. Stopping.');
            break;
        }

        let shouldStop = false;
        for (const element of items.get()) {
            const adDateStr = $(element).find(selectors.date).text().trim();
            const adDate = parseDate(adDateStr);

            if (adDate && adDate < twoMonthsAgo) {
                console.log(`Found ad older than 2 months (${adDateStr}). Stopping.`);
                shouldStop = true;
                break;
            }
            const link = $(element).find(selectors.link).attr('href');
            const ad = {
                id: randomUUID(),
                title: $(element).find(selectors.title).text().trim(),
                price: $(element).find(selectors.price).text().trim(),
                link: link && !link.startsWith('http') ? `${baseUrl}${link}` : link,
                date_posted: adDateStr,
                brand: brand,
                ad_type: adType,
                scraped_at: new Date().toISOString(),
                description: $(element).find(selectors.description).text().trim(),
                location: $(element).find(selectors.location).text().trim(),
            };
            scrapedAds.push(ad);

            if (scrapedAds.length >= 50) {
                console.log('Reached 50 ads limit. Stopping.');
                shouldStop = true;
                break;
            }
        }

        if (shouldStop) {
            break;
        }

        const nextPageLink = $('a:contains("Další")').attr('href');
        if (nextPageLink) {
            currentPageUrl = new URL(nextPageLink, baseUrl).href;
        } else {
            hasNextPage = false;
            console.log('No next page link found. Stopping.');
        }
    }

    const fileName = `${brand.replace(/ /g, '_')}_${adType}.json`;
    const outputDir = path.join(__dirname, '..', 'scraped_data');
    const filePath = path.join(outputDir, fileName);

    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(scrapedAds, null, 2));

    console.log(`Successfully scraped ${scrapedAds.length} ads. Saved to ${filePath}`);
    return scrapedAds;
}

app.post('/scrape-all', async (req, res) => {
    const { selectors } = req.body;

    if (!selectors) {
        return res.status(400).json({ message: 'Missing required configuration.' });
    }

    try {
        const scrapedData = { nabidka: [], poptavka: [] };
        let totalNabidka = 0;
        let totalPoptavka = 0;

        for (const brand of BRANDS) {
            console.log(`Scraping offers for ${brand}`);
            let brandUrlSegment = brand.toLowerCase().replace(/ /g, '-');
            if (brand === 'Sony') {
                brandUrlSegment = 'ericsson';
            } else if (brand === 'Ostatní') {
                brandUrlSegment = 'mobily';
            }

            const offerAds = await scrapeUrl(`https://mobil.bazos.cz/${brandUrlSegment}/`, brand, 'nabidka', selectors);
            scrapedData.nabidka.push(...offerAds);
            totalNabidka += offerAds.length;

            console.log(`Scraping demands for ${brand}`);
            const demandAds = await scrapeUrl(`https://mobil.bazos.cz/${brandUrlSegment}/`, brand, 'poptavka', selectors);
            scrapedData.poptavka.push(...demandAds);
            totalPoptavka += demandAds.length;
        }

        res.json({
            message: `Scraping complete! Found ${totalNabidka} offers and ${totalPoptavka} demands.`,
            data: scrapedData,
        });

    } catch (error) {
        console.error('An error occurred during scraping:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        res.status(500).json({ message: 'An error occurred during scraping.', error: errorMessage });
    }
});

app.post('/compare', async (req, res) => {
    const { scrapedData } = req.body;

    if (!scrapedData) {
        return res.status(400).json({ message: 'Missing scraped data.' });
    }

    try {
        const foundMatches: { offer: any, demand: any }[] = [];

        scrapedData.poptavka.forEach(demandAd => {
            const demandPrice = parsePrice(demandAd.price);
            if (demandPrice === null) return;

            scrapedData.nabidka.forEach(offerAd => {
                if (demandAd.brand !== offerAd.brand) return;

                const offerPrice = parsePrice(offerAd.price);
                if (offerPrice === null) return;

                if (demandPrice > offerPrice) {
                    foundMatches.push({ offer: offerAd, demand: demandAd });
                }
            });
        });

        res.json({
            message: `Comparison complete! Found ${foundMatches.length} matches.`,
            data: foundMatches,
        });

    } catch (error) {
        console.error('An error occurred during comparison:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        res.status(500).json({ message: 'An error occurred during comparison.', error: errorMessage });
    }
});

app.listen(port, () => {
  console.log(`Backend server is running at http://localhost:${port}`);
});
