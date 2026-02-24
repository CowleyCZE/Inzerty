import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { spawn, ChildProcess } from 'child_process';
import { initDb, saveAd, getAllAds, updateAdModelAi, updateAdEmbedding, getAllAdsByType, saveMatch } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

initDb().catch(console.error);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

let ollamaProcess: ChildProcess | null = null;
let isOllamaRunning = false;

const checkOllamaStatus = async () => {
    try {
        await axios.get('http://localhost:11434/api/tags');
        isOllamaRunning = true;
        return true;
    } catch (e) {
        isOllamaRunning = false;
        return false;
    }
};

app.post('/ollama/toggle', async (req, res) => {
    const { action } = req.body;

    if (action === 'start') {
        if (await checkOllamaStatus()) {
            return res.json({ message: 'Ollama is already running.', status: true });
        }

        ollamaProcess = spawn('ollama', ['serve'], {
            detached: true,
            stdio: 'ignore'
        });
        ollamaProcess.unref();

        let attempts = 0;
        while (attempts < 5) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (await checkOllamaStatus()) break;
            attempts++;
        }

        return res.json({
            message: isOllamaRunning ? 'Ollama started successfully.' : 'Ollama starting in background...',
            status: isOllamaRunning
        });
    } else {
        spawn('pkill', ['ollama']);
        isOllamaRunning = false;
        return res.json({ message: 'Ollama stop signal sent.', status: false });
    }
});

app.get('/ollama/status', async (req, res) => {
    const running = await checkOllamaStatus();
    res.json({ status: running });
});

const BRANDS = [
    'Samsung', 'Apple', 'Huawei', 'Motorola', 'Nokia', 'Sony', 'Xiaomi'
];

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
];

const getRandomUserAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fetchPageWithRetry = async (url: string, retries = 3): Promise<any> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const delayMs = Math.floor(Math.random() * 2000) + 1500;
            await sleep(delayMs);

            const response = await axios.get(url, {
                timeout: 30000,
                headers: {
                    'User-Agent': getRandomUserAgent(),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'cs,cs-CZ;q=0.9,en;q=0.8'
                }
            });
            return response;
        } catch (error: any) {
            console.warn(`Pokus ${attempt} selhal pro ${url}: ${error.message}`);
            if (attempt === retries) throw error;
            await sleep(attempt * 3000);
        }
    }
};

const parseDate = (dateString: string): Date | null => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateString.includes('Dnes')) return today;
    if (dateString.includes('Včera')) return yesterday;

    const parts = dateString.match(/(\d+)\. (\d+)\. (\d{4})?/);
    if (parts && parts[1] && parts[2]) {
        const day = parseInt(parts[1], 10);
        const month = parseInt(parts[2], 10) - 1;
        let year = today.getFullYear();
        if (parts[3]) year = parseInt(parts[3], 10);
        const date = new Date(year, month, day);
        if (date > today && !parts[3]) date.setFullYear(year - 1);
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

const extractStorage = (text: string): number | null => {
    const match = text.match(/(\d+)\s*GB/i);
    return match && match[1] ? parseInt(match[1], 10) : null;
};

const getSimilarity = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const s2 = str2.toLowerCase().replace(/[^a-z0-9\s]/g, '');

    const words1 = new Set(s1.split(/\s+/).filter(w => w.length > 1));
    const words2 = new Set(s2.split(/\s+/).filter(w => w.length > 1));

    if (words1.size === 0 || words2.size === 0) return 0;

    let intersection = 0;
    words1.forEach(word => {
        if (words2.has(word)) intersection++;
    });

    return (2 * intersection) / (words1.size + words2.size);
};

const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

const extractModelWithAI = async (title: string, description: string): Promise<string> => {
    try {
        const prompt = `Extract only the specific mobile phone model name and its storage capacity (in GB) from this ad. 
        Format: "Model Name GB". Exclude brand. 
        If it's an iPhone, include the number and Pro/Max/Plus.
        Title: "${title}"
        Description: "${description.substring(0, 100)}"
        Model:`;

        const response = await axios.post('http://localhost:11434/api/generate', {
            model: 'llama3.2:1b',
            prompt: prompt,
            stream: false
        }, { timeout: 10000 });

        return response.data.response.trim();
    } catch (error) {
        console.error('AI Extraction failed:', error);
        return '';
    }
};

const getEmbeddingFromOllama = async (text: string): Promise<number[] | null> => {
    try {
        const response = await axios.post('http://localhost:11434/api/embeddings', {
            model: 'llama3.2:1b',
            prompt: text
        }, { timeout: 15000 });
        return response.data.embedding;
    } catch (error) {
        console.error('AI Embedding failed:', error);
        return null;
    }
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

        try {
            const response = await fetchPageWithRetry(currentPageUrl);
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
                const adTitle = $(element).find(selectors.title).text().trim();
                const adDescription = $(element).find(selectors.description).text().trim();

                const ad = {
                    id: randomUUID(),
                    title: adTitle,
                    price: $(element).find(selectors.price).text().trim(),
                    link: link && !link.startsWith('http') ? `${baseUrl}${link}` : link,
                    date_posted: adDateStr,
                    brand: brand,
                    ad_type: adType,
                    scraped_at: new Date().toISOString(),
                    description: adDescription,
                    location: $(element).find(selectors.location).text().trim(),
                };

                try {
                    await saveAd(ad);
                } catch (err) {
                    console.error(`Failed to save ad ${ad.title}:`, err);
                }

                scrapedAds.push(ad);

                if (scrapedAds.length >= 50) {
                    console.log('Reached 50 ads limit. Stopping.');
                    shouldStop = true;
                    break;
                }
            }

            if (shouldStop) break;

            const nextPageLink = $('a:contains("Další")').attr('href');
            if (nextPageLink) {
                currentPageUrl = new URL(nextPageLink, baseUrl).href;
            } else {
                hasNextPage = false;
                console.log('No next page link found. Stopping.');
            }
        } catch (error) {
            console.error(`Scraping failed completely for ${currentPageUrl} after retries. Preskakuji stránku.`);
            break; 
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
        const scrapedData: { nabidka: any[], poptavka: any[] } = { nabidka: [], poptavka: [] };
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
            message: `Scraping complete! Found ${totalNabidka} offers and ${totalPoptavka} demands. All ads saved to database.`,
            data: { nabidkaCount: totalNabidka, poptavkaCount: totalPoptavka },
        });

    } catch (error) {
        console.error('An error occurred during scraping:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        res.status(500).json({ message: 'An error occurred during scraping.', error: errorMessage });
    }
});

app.post('/compare', async (req, res) => {
    try {
        const foundMatches: { offer: any, demand: any }[] = [];
        const useAI = await checkOllamaStatus();

        const allOffers = await getAllAdsByType('nabidka');
        const allDemands = await getAllAdsByType('poptavka');

        if (allOffers.length === 0 || allDemands.length === 0) {
            return res.json({
                message: 'Comparison complete! Not enough data in database to compare.',
                data: [],
            });
        }

        const enrichedOffers: any[] = [];
        const enrichedDemands: any[] = [];

        if (useAI) {
            console.log('Processing offers with AI...');
            for (const offerAd of allOffers) {
                const model = offerAd.model_ai || await extractModelWithAI(offerAd.title, offerAd.description);
                if (model && !offerAd.model_ai) await updateAdModelAi(offerAd.id, model);

                let embeddingData = offerAd.embedding ? JSON.parse(offerAd.embedding) : null;
                if (!embeddingData) {
                    embeddingData = await getEmbeddingFromOllama(`${offerAd.title} ${offerAd.description}`);
                    if (embeddingData) await updateAdEmbedding(offerAd.id, JSON.stringify(embeddingData));
                }
                enrichedOffers.push({ ...offerAd, model_ai: model, parsed_embedding: embeddingData });
            }
            console.log('Processing demands with AI...');
            for (const demandAd of allDemands) {
                const model = demandAd.model_ai || await extractModelWithAI(demandAd.title, demandAd.description);
                if (model && !demandAd.model_ai) await updateAdModelAi(demandAd.id, model);

                let embeddingData = demandAd.embedding ? JSON.parse(demandAd.embedding) : null;
                if (!embeddingData) {
                    embeddingData = await getEmbeddingFromOllama(`${demandAd.title} ${demandAd.description}`);
                    if (embeddingData) await updateAdEmbedding(demandAd.id, JSON.stringify(embeddingData));
                }
                enrichedDemands.push({ ...demandAd, model_ai: model, parsed_embedding: embeddingData });
            }
        } else {
            enrichedOffers.push(...allOffers);
            enrichedDemands.push(...allDemands);
        }

        for (const demandAd of enrichedDemands) {
            const demandPrice = parsePrice(demandAd.price);
            if (demandPrice === null) continue;

            const demandModel = useAI ? demandAd.model_ai || '' : '';
            const demandStorage = extractStorage(demandAd.title + ' ' + demandAd.description) || extractStorage(demandModel);

            for (const offerAd of enrichedOffers) {
                if (demandAd.brand !== offerAd.brand) continue;
                if (demandAd.url === offerAd.url) continue;

                const offerPrice = parsePrice(offerAd.price);
                if (offerPrice === null) continue;

                if (demandPrice <= offerPrice) continue;
                if (demandPrice > offerPrice * 1.6) continue;

                let isMatch = false;
                let similarityScore = 0;

                const offerModel = useAI ? offerAd.model_ai || '' : '';
                const offerStorage = extractStorage(offerAd.title + ' ' + offerAd.description) || extractStorage(offerModel);

                if (demandStorage && offerStorage && demandStorage !== offerStorage) continue;

                if (useAI) {
                    if (demandAd.parsed_embedding && offerAd.parsed_embedding) {
                        const sim = cosineSimilarity(demandAd.parsed_embedding, offerAd.parsed_embedding);
                        similarityScore = Math.round(sim * 100);
                        
                        let modelMatch = false;
                        if (demandModel && offerModel) {
                             modelMatch = demandModel.toLowerCase().includes(offerModel.split(' ')[0].toLowerCase()) ||
                                offerModel.toLowerCase().includes(demandModel.split(' ')[0].toLowerCase());
                        }

                        isMatch = (similarityScore >= 80) || modelMatch;
                        
                        if (modelMatch && similarityScore < 100) {
                            similarityScore = Math.min(100, similarityScore + 15);
                        }
                    } else if (demandModel && offerModel) {
                        isMatch = demandModel.toLowerCase().includes(offerModel.split(' ')[0].toLowerCase()) ||
                            offerModel.toLowerCase().includes(demandModel.split(' ')[0].toLowerCase());
                        similarityScore = isMatch ? 100 : 0;
                    }
                } else {
                    similarityScore = getSimilarity(demandAd.title, offerAd.title);
                    isMatch = similarityScore >= 0.35;
                    similarityScore = Math.round(similarityScore * 100);
                }

                if (isMatch) {
                    const matchObj = {
                        offer: { ...offerAd, similarity: similarityScore, ai: useAI },
                        demand: demandAd
                    };
                    foundMatches.push(matchObj);
                    await saveMatch(offerAd.id, demandAd.id, similarityScore, useAI);
                }
            }
        }

        res.json({
            message: `Comparison complete! Found ${foundMatches.length} matches. ${useAI ? '(AI Powered Embeddings)' : '(Keyword Powered)'}`,
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
