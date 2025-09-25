import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto'; // Import pro generování UUID

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

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

    const parts = dateString.match(/(\d+)\. (\d+)\. (\d{4})?/); // Added optional year group
    if (parts && parts[1] && parts[2]) {
        const day = parseInt(parts[1], 10);
        const month = parseInt(parts[2], 10) - 1;
        let year = today.getFullYear();
        if (parts[3]) { // If year is present in the string
            year = parseInt(parts[3], 10);
        }
        const date = new Date(year, month, day);
        if (date > today && !parts[3]) { // Only adjust year if it wasn't explicitly provided
            date.setFullYear(year - 1);
        }
        return date;
    }
    return null;
};

app.post('/scrape', async (req, res) => {
    const { url, brand, adType, selectors } = req.body;

    if (!url || !brand || !selectors) {
        return res.status(400).json({ message: 'Missing required configuration.' });
    }

    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    const scrapedAds: any[] = [];
    let currentPageUrl = url;
    let hasNextPage = true;
    let pagesScraped = 0;

    console.log(`Starting scrape for ${brand} (${adType}) at ${url}`);

    try {
        while (scrapedAds.length < 500 && hasNextPage && pagesScraped < 50) { // Safety page limit
            console.log(`Scraping page: ${currentPageUrl}`);
            pagesScraped++;

            const response = await axios.get(currentPageUrl, {
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
            for (const element of items) {
                const adDateStr = $(element).find(selectors.date).text().trim();
                const adDate = parseDate(adDateStr);

                if (adDate && adDate < twoMonthsAgo) {
                    console.log(`Found ad older than 2 months (${adDateStr}). Stopping.`);
                    shouldStop = true;
                    break;
                }
                const link = $(element).find(selectors.link).attr('href');
                const ad = {
                    id: randomUUID(), // Použití importovaného randomUUID
                    title: $(element).find(selectors.title).text().trim(),
                    price: $(element).find(selectors.price).text().trim(),
                    link: link && !link.startsWith('http') ? `${baseUrl}${link}` : link, // Doplnění URL
                    date_posted: adDateStr,
                    brand: brand,
                    ad_type: adType,
                    scraped_at: new Date().toISOString(),
                    description: $(element).find(selectors.description).text().trim(), // Přidáno description
                    location: $(element).find(selectors.location).text().trim(), // Přidáno location
                };
                scrapedAds.push(ad);

                if (scrapedAds.length >= 500) {
                    console.log('Reached 500 ads limit. Stopping.');
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
        res.json({
            message: `Scraping complete! Found ${scrapedAds.length} ads. Saved to ${filePath}`,
            filePath: filePath,
            data: scrapedAds,
        });

    } catch (error) {
        console.error('An error occurred during scraping:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        res.status(500).json({ message: 'An error occurred during scraping.', error: errorMessage });
    }
});

app.listen(port, () => {
  console.log(`Backend server is running at http://localhost:${port}`);
});
