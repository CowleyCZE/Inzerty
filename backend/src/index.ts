import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { spawn, ChildProcess } from 'child_process';
import { initDb, saveAd, getAllAds, updateAdModelAi, updateAdEmbedding, getAllAdsByType, saveMatch, getRecentScrapedUrls, getScrapeCheckpoint, updateScrapeCheckpoint, usingPostgres, isPgVectorAvailable, getPgVectorSimilarities, saveMatchMeta, getResolvedMatchKeys, getDailyMetaStats } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const isLocalOllama = OLLAMA_BASE_URL.includes('localhost') || OLLAMA_BASE_URL.includes('127.0.0.1');

initDb().catch(console.error);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

let ollamaProcess: ChildProcess | null = null;
let isOllamaRunning = false;

type RuntimeLogEntry = {
    id: string;
    timestamp: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'system';
};

const runtimeLogs: RuntimeLogEntry[] = [];
const MAX_RUNTIME_LOGS = 500;

const pushRuntimeLog = (message: string, type: RuntimeLogEntry['type'] = 'info') => {
    const entry: RuntimeLogEntry = {
        id: randomUUID(),
        timestamp: new Date().toLocaleTimeString('cs-CZ'),
        message,
        type,
    };
    runtimeLogs.push(entry);
    if (runtimeLogs.length > MAX_RUNTIME_LOGS) {
        runtimeLogs.splice(0, runtimeLogs.length - MAX_RUNTIME_LOGS);
    }

    if (type === 'error') {
        console.error(`[${entry.timestamp}] ${message}`);
    } else {
        console.log(`[${entry.timestamp}] ${message}`);
    }
};


const checkOllamaStatus = async () => {
    try {
        await axios.get(`${OLLAMA_BASE_URL}/api/tags`);
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

        if (!isLocalOllama) {
            return res.json({ 
                message: `Cannot start remote Ollama automatically. Please ensure it is running at ${OLLAMA_BASE_URL}`, 
                status: false 
            });
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
        if (!isLocalOllama) {
            return res.json({ 
                message: 'Cannot stop remote Ollama from this device.', 
                status: await checkOllamaStatus() 
            });
        }

        spawn('pkill', ['ollama']);
        isOllamaRunning = false;
        return res.json({ message: 'Ollama stop signal sent.', status: false });
    }
});

app.get('/ollama/status', async (req, res) => {
    const running = await checkOllamaStatus();
    res.json({ status: running });
});


app.get('/logs', (req, res) => {
    res.json({ logs: runtimeLogs.slice(-200) });
});

app.post('/logs/clear', (req, res) => {
    runtimeLogs.length = 0;
    res.json({ message: 'Logs cleared' });
});

const BRANDS = [
    'Samsung', 'Apple', 'Huawei', 'Motorola', 'Nokia', 'Sony', 'Xiaomi'
];

const USER_AGENTS: string[] = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
];

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const getRandomUserAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] ?? DEFAULT_USER_AGENT;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const firstToken = (value: string) => value.trim().split(/\s+/)[0] ?? '';


const proxyPool = (process.env.SCRAPER_PROXY_URLS || '')
    .split(',')
    .map((proxyUrl) => proxyUrl.trim())
    .filter(Boolean);

const getRandomProxy = () => {
    if (proxyPool.length === 0) return undefined;
    const url = proxyPool[Math.floor(Math.random() * proxyPool.length)];
    if (!url) return undefined;

    try {
        const parsed = new URL(url);
        const proxyConfig: { protocol: string; host: string; port: number; auth?: { username: string; password: string } } = {
            protocol: parsed.protocol.replace(':', ''),
            host: parsed.hostname,
            port: Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80)),
        };

        if (parsed.username) {
            proxyConfig.auth = {
                username: decodeURIComponent(parsed.username),
                password: decodeURIComponent(parsed.password),
            };
        }

        return proxyConfig;
    } catch {
        return undefined;
    }
};

const scraperHttpClient = axios.create({ timeout: 30000 });

const fetchPageWithRetry = async (url: string): Promise<any> => {
    const maxRetries = 5;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const delayMs = Math.floor(Math.random() * 2000) + 1200;
            await sleep(delayMs);

            const proxy = getRandomProxy();
            const requestConfig: { headers: Record<string, string>; proxy?: { protocol: string; host: string; port: number; auth?: { username: string; password: string } } } = {
                headers: {
                    'User-Agent': getRandomUserAgent(),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'cs,cs-CZ;q=0.9,en;q=0.8'
                },
            };

            if (proxy) {
                requestConfig.proxy = proxy;
            }

            const response = await scraperHttpClient.get(url, requestConfig);
            return response;
        } catch (error: any) {
            const status = error?.response?.status as number | undefined;
            const retryable = !status || status >= 500 || status === 429 || status === 408;
            if (!retryable || attempt === maxRetries) {
                throw error;
            }

            const backoff = Math.min(10000, 1200 * Math.pow(2, attempt - 1));
            await sleep(backoff + Math.floor(Math.random() * 500));
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
        const a = vecA[i] ?? 0;
        const b = vecB[i] ?? 0;
        dotProduct += a * b;
        normA += a * a;
        normB += b * b;
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

        const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
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
        const response = await axios.post(`${OLLAMA_BASE_URL}/api/embeddings`, {
            model: 'llama3.2:1b',
            prompt: text
        }, { timeout: 15000 });
        return response.data.embedding;
    } catch (error) {
        console.error('AI Embedding failed:', error);
        return null;
    }
};

async function scrapeUrl(url: string, brand: string, adType: string, selectors: any, options?: { stopOnKnownAd?: boolean; maxAdsPerTypePerBrand?: number }) {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    const scrapedAds: any[] = [];
    let savedAdsCount = 0;
    let currentPageUrl = url;
    let hasNextPage = true;
    let pagesScraped = 0;

    const recentUrls = await getRecentScrapedUrls(brand, adType, 25);
    const checkpoint = await getScrapeCheckpoint(brand, adType);
    const checkpointDate = checkpoint?.lastSeenDate ? parseDate(checkpoint.lastSeenDate) : null;
    let latestSeenUrl: string | null = null;
    let latestSeenDate: string | null = null;
    const stopOnKnownAd = options?.stopOnKnownAd !== false;
    const maxAdsPerTypePerBrand = Math.max(1, Math.min(500, Number(options?.maxAdsPerTypePerBrand || 50)));

    if (process.env.MOCK_SCRAPE === '1') {
        for (let i = 0; i < Math.min(maxAdsPerTypePerBrand, 3); i++) {
            const ad = {
                id: randomUUID(),
                title: `${brand} test ${adType} ${i + 1}`,
                price: `${2000 + (i * 100)} Kč`,
                link: `https://mock.local/${adType}/${brand.toLowerCase()}/${i + 1}`,
                date_posted: 'Dnes',
                brand,
                ad_type: adType,
                scraped_at: new Date().toISOString(),
                description: `Testovací inzerát ${adType}`,
                location: 'Praha',
            };
            const wasSaved = await saveAd(ad);
            if (wasSaved) savedAdsCount += 1;
            scrapedAds.push(ad);
        }

        pushRuntimeLog(`MOCK režim: vytvořeno ${scrapedAds.length} inzerátů pro ${brand} (${adType}).`, 'system');
        return { ads: scrapedAds, savedAdsCount };
    }

    pushRuntimeLog(`Spouštím scrapování pro ${brand} (${adType}) na ${url}`, 'system');

    while (scrapedAds.length < maxAdsPerTypePerBrand && hasNextPage && pagesScraped < 50) {
        pushRuntimeLog(`Scrapuji stránku: ${currentPageUrl}`);
        pagesScraped++;

        try {
            const response = await fetchPageWithRetry(currentPageUrl);
            const $ = cheerio.load(response.data);
            const urlObject = new URL(currentPageUrl);
            const baseUrl = urlObject.origin;

            const items = $(selectors.item);
            if (items.length === 0) {
                pushRuntimeLog('Na stránce nebyly nalezeny žádné inzeráty. Ukončuji.', 'system');
                break;
            }

            let shouldStop = false;
            for (const element of items.get()) {
                const adDateStr = $(element).find(selectors.date).text().trim();
                const adDate = parseDate(adDateStr);

                if (adDate && adDate < twoMonthsAgo) {
                    pushRuntimeLog(`Nalezen inzerát starší než 2 měsíce (${adDateStr}). Ukončuji.`, 'system');
                    shouldStop = true;
                    break;
                }

                if (stopOnKnownAd && checkpointDate && adDate && adDate <= checkpointDate) {
                    pushRuntimeLog(`Narazili jsme na inzerát starší nebo stejný jako checkpoint (${adDateStr}). Inkrementální scraping končí.`, 'system');
                    shouldStop = true;
                    break;
                }
                
                const link = $(element).find(selectors.link).attr('href');
                const fullLink = link && !link.startsWith('http') ? `${baseUrl}${link}` : link;
                
                if (stopOnKnownAd && fullLink && checkpoint?.lastSeenUrl && fullLink === checkpoint.lastSeenUrl) {
                    pushRuntimeLog(`Dosažen uložený checkpoint URL pro ${brand}. Inkrementální scraping končí.`, 'system');
                    shouldStop = true;
                    break;
                }

                if (stopOnKnownAd && fullLink && recentUrls.includes(fullLink)) {
                    pushRuntimeLog(`Inzerát ${fullLink} již byl dříve stažen. Skript končí inkrementální stahování pro ${brand}.`, 'system');
                    shouldStop = true;
                    break;
                }

                if (!latestSeenUrl && fullLink) {
                    latestSeenUrl = fullLink;
                    latestSeenDate = adDateStr || null;
                }

                const adTitle = $(element).find(selectors.title).text().trim();
                const adDescription = $(element).find(selectors.description).text().trim();

                const ad = {
                    id: randomUUID(),
                    title: adTitle,
                    price: $(element).find(selectors.price).text().trim(),
                    link: fullLink,
                    date_posted: adDateStr,
                    brand: brand,
                    ad_type: adType,
                    scraped_at: new Date().toISOString(),
                    description: adDescription,
                    location: $(element).find(selectors.location).text().trim(),
                };

                try {
                    const wasSaved = await saveAd(ad);
                    if (wasSaved) {
                        savedAdsCount += 1;
                    }
                } catch (err) {
                    console.error(`Failed to save ad ${ad.title}:`, err);
                }

                scrapedAds.push(ad);

                if (scrapedAds.length >= maxAdsPerTypePerBrand) {
                    pushRuntimeLog(`Dosažen nastavený limit inzerátů (${maxAdsPerTypePerBrand}). Ukončuji.`, 'system');
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
                pushRuntimeLog('Nebyl nalezen odkaz na další stránku. Ukončuji.', 'system');
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

    if (latestSeenUrl || latestSeenDate) {
        await updateScrapeCheckpoint(brand, adType, latestSeenUrl, latestSeenDate);
    }

    pushRuntimeLog(`Úspěšně načteno ${scrapedAds.length} inzerátů (${savedAdsCount} nových v DB). Uloženo do ${filePath}`, 'success');
    return { ads: scrapedAds, savedAdsCount };
}

const getBrandSegment = (brand: string) => {
    let segment = brand.toLowerCase().replace(/ /g, '-');
    if (brand === 'Sony') {
        segment = 'ericsson';
    } else if (brand === 'Ostatní') {
        segment = 'mobily';
    }
    return segment;
};

const getBazosBrandUrls = (brand: string, brandSegment: string, adType: 'nabidka' | 'poptavka') => {
    if (adType === 'nabidka') {
        return [`https://mobil.bazos.cz/${brandSegment}/`];
    }

    const demandSearch = encodeURIComponent(brand.toLowerCase());
    return [
        `https://mobil.bazos.cz/koupim/${brandSegment}/`,
        `https://mobil.bazos.cz/koupim/?hledat=${demandSearch}`,
    ];
};

app.post('/scrape-all', async (req, res) => {
    const { selectors, scrapingOptions } = req.body;

    if (!selectors) {
        return res.status(400).json({ message: 'Chybí povinná konfigurace.' });
    }

    try {
        const effectiveScrapingOptions = {
            stopOnKnownAd: scrapingOptions?.stopOnKnownAd !== false,
            maxAdsPerTypePerBrand: Math.max(1, Math.min(500, Number(scrapingOptions?.maxAdsPerTypePerBrand || 50))),
        };
        pushRuntimeLog(`Nastavení scrapování: stopOnKnownAd=${effectiveScrapingOptions.stopOnKnownAd}, maxAdsPerTypePerBrand=${effectiveScrapingOptions.maxAdsPerTypePerBrand}`, 'system');

        const scrapedData: { nabidka: any[], poptavka: any[] } = { nabidka: [], poptavka: [] };
        let totalNabidka = 0;
        let totalPoptavka = 0;
        let totalSavedNabidka = 0;
        let totalSavedPoptavka = 0;

        for (const brand of BRANDS) {
            pushRuntimeLog(`Scrapuji nabídky pro ${brand}`, 'system');
            const brandUrlSegment = getBrandSegment(brand);

            const offerUrl = getBazosBrandUrls(brand, brandUrlSegment, 'nabidka')[0] || `https://mobil.bazos.cz/${brandUrlSegment}/`;
            const offerResult = await scrapeUrl(offerUrl, brand, 'nabidka', selectors, effectiveScrapingOptions);
            scrapedData.nabidka.push(...offerResult.ads);
            totalNabidka += offerResult.ads.length;
            totalSavedNabidka += offerResult.savedAdsCount;

            pushRuntimeLog(`Scrapuji poptávky pro ${brand}`, 'system');
            const demandUrls = getBazosBrandUrls(brand, brandUrlSegment, 'poptavka');
            let demandResult = { ads: [] as any[], savedAdsCount: 0 };

            for (let i = 0; i < demandUrls.length; i++) {
                const demandUrl = demandUrls[i] ?? ''; 
                if (!demandUrl) continue;

                demandResult = await scrapeUrl(demandUrl, brand, 'poptavka', selectors, effectiveScrapingOptions);
                if (demandResult.ads.length > 0 || i === demandUrls.length - 1) {
                    break;
                }

                pushRuntimeLog(`Poptávky pro ${brand} z URL ${demandUrl} nebyly načteny. Zkouším fallback URL.`, 'info');
            }

            scrapedData.poptavka.push(...demandResult.ads);
            totalPoptavka += demandResult.ads.length;
            totalSavedPoptavka += demandResult.savedAdsCount;
        }

        res.json({
            message: `Scrapování dokončeno! Načteno ${totalNabidka} nabídek a ${totalPoptavka} poptávek; do DB uloženo ${totalSavedNabidka} nabídek a ${totalSavedPoptavka} poptávek.`,
            data: {
                nabidkaCount: totalNabidka,
                poptavkaCount: totalPoptavka,
                savedNabidkaCount: totalSavedNabidka,
                savedPoptavkaCount: totalSavedPoptavka,
                healthWarning: totalPoptavka > 0 && totalSavedPoptavka === 0
                    ? 'Byly nalezeny poptávky, ale žádná se neuložila do DB. Zkontrolujte selektory, URL pro poptávku nebo duplicitní data.'
                    : '',
            },
        });

    } catch (error) {
pushRuntimeLog(`Chyba scrapování: ${error instanceof Error ? error.message : 'neznámá chyba'}`, 'error');
        console.error('Během scrapování došlo k chybě:', error);
        const errorMessage = error instanceof Error ? error.message : 'Došlo k neznámé chybě';
        res.status(500).json({ message: 'Během scrapování došlo k chybě.', error: errorMessage });
    }
});


const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const normalizeText = (value: string) => (value || '').toLowerCase();

const locationSimilarity = (demandLocation: string, offerLocation: string) => {
    const a = normalizeText(demandLocation).trim();
    const b = normalizeText(offerLocation).trim();
    if (!a || !b) return 55;
    if (a === b) return 100;
    const tokenA = new Set(a.split(/[\s,.-]+/).filter(Boolean));
    const tokenB = new Set(b.split(/[\s,.-]+/).filter(Boolean));
    let inter = 0;
    tokenA.forEach((t) => { if (tokenB.has(t)) inter += 1; });
    const denom = Math.max(1, Math.max(tokenA.size, tokenB.size));
    return Math.round(clamp((inter / denom) * 100, 35, 100));
};

const median = (nums: number[]) => {
    if (!nums.length) return 0;
    const arr = [...nums].sort((a,b)=>a-b);
    const mid = Math.floor(arr.length/2);
    return arr.length % 2 ? (arr[mid] ?? 0) : (((arr[mid-1] ?? 0) + (arr[mid] ?? 0)) / 2);
};

const priceTrustScore = (price: number, baseline: number) => {
    if (!baseline || baseline <= 0) return 60;
    const deviation = Math.abs(price - baseline) / baseline;
    return Math.round(clamp(100 - (deviation * 120), 5, 100));
};


const daysSincePosted = (dateStr: string): number => {
    const parsed = parseDate(dateStr);
    if (!parsed) return 14;
    const now = new Date();
    return Math.max(0, Math.floor((now.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24)));
};

const computeOpportunityScore = (profit: number, similarityScore: number, demandDateStr: string, offerDateStr: string): number => {
    const profitScore = clamp((profit / 8000) * 100, 0, 100);
    const freshnessDemand = clamp(100 - daysSincePosted(demandDateStr) * 5, 20, 100);
    const freshnessOffer = clamp(100 - daysSincePosted(offerDateStr) * 5, 20, 100);
    const weighted = (profitScore * 0.45) + (similarityScore * 0.35) + ((freshnessDemand + freshnessOffer) / 2 * 0.20);
    return Math.round(clamp(weighted, 0, 100));
};

const computeRealOpportunityScore = (
    profit: number,
    demandPrice: number,
    offerPrice: number,
    similarityScore: number,
    demandDateStr: string,
    offerDateStr: string,
    locationScore: number,
    trustScore: number,
): number => {
    const netProfitScore = clamp(((profit - 400) / 7000) * 100, 0, 100);
    const margin = demandPrice > 0 ? ((demandPrice - offerPrice) / demandPrice) * 100 : 0;
    const marginScore = clamp(margin * 2.2, 0, 100);
    const freshnessDemand = clamp(100 - daysSincePosted(demandDateStr) * 6, 10, 100);
    const freshnessOffer = clamp(100 - daysSincePosted(offerDateStr) * 6, 10, 100);
    const freshness = (freshnessDemand + freshnessOffer) / 2;
    const weighted = (netProfitScore * 0.28) + (similarityScore * 0.23) + (marginScore * 0.16) + (freshness * 0.13) + (locationScore * 0.10) + (trustScore * 0.10);
    return Math.round(clamp(weighted, 0, 100));
};

app.post('/alerts/notify', async (req, res) => {
    try {
        const { telegramBotToken, telegramChatId, emailWebhookUrl, discordWebhookUrl, minProfit = 0, minScore = 0, matches = [] } = req.body;
        const filtered = (Array.isArray(matches) ? matches : []).filter((m: any) => (m.arbitrageScore || 0) >= minProfit && (m.realOpportunityScore || m.opportunityScore || 0) >= minScore);
        const topMatches = filtered.slice(0, 5);
        const summary = topMatches
            .map((m: any, idx: number) => `${idx + 1}. ${m.offer?.title || 'N/A'} → ${m.arbitrageScore || 0} Kč (Opportunity ${m.realOpportunityScore || m.opportunityScore || 0})`)
            .join('\n');
        const message = `📈 Bazoš alert: nové TOP příležitosti\n${summary || 'Žádné nové položky.'}`;

        const results: { telegram?: string; email?: string; discord?: string } = {};

        if (telegramBotToken && telegramChatId) {
            const tgRes = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: telegramChatId, text: message }),
            });
            results.telegram = tgRes.ok ? 'sent' : `failed (${tgRes.status})`;
        }

        if (emailWebhookUrl) {
            const emailRes = await fetch(emailWebhookUrl, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject: 'Bazoš alert – nové ziskové příležitosti', text: message, matches: topMatches }),
            });
            results.email = emailRes.ok ? 'sent' : `failed (${emailRes.status})`;
        }

        if (discordWebhookUrl) {
            const discordRes = await fetch(discordWebhookUrl, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: message }),
            });
            results.discord = discordRes.ok ? 'sent' : `failed (${discordRes.status})`;
        }

        res.json({ message: 'Alert processing finished', results, topMatchesCount: topMatches.length });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        pushRuntimeLog(`Alert failed: ${errorMessage}`, 'error');
        res.status(500).json({ message: 'Alert failed', error: errorMessage });
    }
});

app.post('/match-meta', async (req, res) => {
    try {
        await saveMatchMeta(req.body || {});
        res.json({ message: 'saved' });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ message: 'match-meta failed', error: errorMessage });
    }
});

app.get('/reports/daily', async (req, res) => {
    const stats: any = await getDailyMetaStats();
    res.json({
        newCount: Number(stats.new_count || 0),
        contactedCount: Number(stats.contacted_count || 0),
        closedCount: Number(stats.closed_count || 0),
    });
});

app.post('/export/csv', async (req, res) => {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const headers = ['offerTitle','demandTitle','profit','opportunity','offerUrl','demandUrl','status','priority','note','lastActionAt'];
    const csv = [headers.join(',')]
      .concat(rows.map((r: any) => headers.map((h) => `"${String((r[h] ?? '')).replaceAll('"','""')}"`).join(',')))
      .join('\n');
    res.json({ csv });
});

app.post('/compare', async (req, res) => {
    try {
        const foundMatches: any[] = [];
        pushRuntimeLog('Porovnávání spuštěno.', 'system');
        const seenMatches = new Set<string>();
        const comparisonMethod = req.body.comparisonMethod || 'auto';
        const filterRules = req.body.filterRules || {};
        const hideResolved = req.body.hideResolved !== false;
        const resolvedMatchKeys = hideResolved ? new Set(await getResolvedMatchKeys()) : new Set<string>();
        
        let useAI = false;
        if (comparisonMethod === 'ollama') {
            useAI = await checkOllamaStatus();
        } else if (comparisonMethod === 'auto') {
            useAI = await checkOllamaStatus();
        } else if (comparisonMethod === 'local-keyword') {
            useAI = false;
        }

        const allOffers = await getAllAdsByType('nabidka');
        const allDemands = await getAllAdsByType('poptavka');

        pushRuntimeLog(`Načtená data pro porovnání: nabídky=${allOffers.length}, poptávky=${allDemands.length}`);

        if (allOffers.length === 0 || allDemands.length === 0) {
            return res.json({
                message: 'Porovnání dokončeno! V databázi není dostatek dat pro porovnání.',
                data: [],
            });
        }

        const enrichedOffers: any[] = [];
        const enrichedDemands: any[] = [];

        const offerPricesByBrand: Record<string, number[]> = {};
        allOffers.forEach((offer: any) => {
            const p = parsePrice(offer.price);
            if (p !== null) {
                offerPricesByBrand[offer.brand] = offerPricesByBrand[offer.brand] || [];
                offerPricesByBrand[offer.brand]?.push(p);
            }
        });

        if (useAI) {
            pushRuntimeLog('Zpracovávám nabídky pomocí AI...', 'system');
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
            pushRuntimeLog('Zpracovávám poptávky pomocí AI...', 'system');
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

        const useDatabaseVectorSearch = useAI && usingPostgres() && isPgVectorAvailable();

        let processedDemands = 0;
        for (const demandAd of enrichedDemands) {
            processedDemands += 1;
            if (processedDemands % 50 === 0) {
                pushRuntimeLog(`Průběh porovnání: zpracováno ${processedDemands}/${enrichedDemands.length} poptávek, shod=${foundMatches.length}`);
            }
            const demandPrice = parsePrice(demandAd.price);
            if (demandPrice === null) continue;

            const demandModel = useAI ? demandAd.model_ai || '' : '';
            const demandStorage = extractStorage(demandAd.title + ' ' + demandAd.description) || extractStorage(demandModel);
            const pgSimilarityMap = new Map<string, number>();

            if (useDatabaseVectorSearch) {
                const similarRows = await getPgVectorSimilarities(demandAd.id, 0.75);
                similarRows.forEach((row: { offer_id: string; similarity: number }) => {
                    pgSimilarityMap.set(row.offer_id, Math.round(row.similarity * 100));
                });
            }

            for (const offerAd of enrichedOffers) {
                if (demandAd.brand !== offerAd.brand) continue;
                if (demandAd.url === offerAd.url) continue;

                const offerPrice = parsePrice(offerAd.price);
                if (offerPrice === null) continue;

                if (demandPrice <= offerPrice) continue;
                if (demandPrice > offerPrice * 1.6) continue;

                const fullText = `${demandAd.title} ${demandAd.description} ${offerAd.title} ${offerAd.description}`.toLowerCase();
                const blacklistTerms: string[] = Array.isArray(filterRules.blacklistTerms) ? filterRules.blacklistTerms : [];
                if (blacklistTerms.some((term) => term && fullText.includes(String(term).toLowerCase()))) continue;

                const whitelistModels: string[] = Array.isArray(filterRules.whitelistModels) ? filterRules.whitelistModels : [];
                if (whitelistModels.length > 0) {
                    const modelText = `${demandAd.title} ${offerAd.title}`.toLowerCase();
                    if (!whitelistModels.some((m) => modelText.includes(String(m).toLowerCase()))) continue;
                }

                const minPrice = typeof filterRules.minPrice === 'number' ? filterRules.minPrice : null;
                const maxPrice = typeof filterRules.maxPrice === 'number' ? filterRules.maxPrice : null;
                if (minPrice !== null && offerPrice < minPrice) continue;
                if (maxPrice !== null && offerPrice > maxPrice) continue;

                let isMatch = false;
                let similarityScore = 0;

                const offerModel = useAI ? offerAd.model_ai || '' : '';
                const offerStorage = extractStorage(offerAd.title + ' ' + offerAd.description) || extractStorage(offerModel);

                if (demandStorage && offerStorage && demandStorage !== offerStorage) continue;

                if (useAI) {
                    const dbSimilarity = pgSimilarityMap.get(offerAd.id);

                    if (typeof dbSimilarity === 'number') {
                        similarityScore = dbSimilarity;

                        let modelMatch = false;
                        if (demandModel && offerModel) {
                            modelMatch = demandModel.toLowerCase().includes(firstToken(offerModel).toLowerCase()) ||
                                offerModel.toLowerCase().includes(firstToken(demandModel).toLowerCase());
                        }

                        isMatch = similarityScore >= 80 || modelMatch;
                    } else if (demandAd.parsed_embedding && offerAd.parsed_embedding) {
                        const sim = cosineSimilarity(demandAd.parsed_embedding, offerAd.parsed_embedding);
                        similarityScore = Math.round(sim * 100);

                        let modelMatch = false;
                        if (demandModel && offerModel) {
                            modelMatch = demandModel.toLowerCase().includes(firstToken(offerModel).toLowerCase()) ||
                                offerModel.toLowerCase().includes(firstToken(demandModel).toLowerCase());
                        }

                        isMatch = (similarityScore >= 80) || modelMatch;

                        if (modelMatch && similarityScore < 100) {
                            similarityScore = Math.min(100, similarityScore + 15);
                        }
                    } else if (demandModel && offerModel) {
                        isMatch = demandModel.toLowerCase().includes(firstToken(offerModel).toLowerCase()) ||
                            offerModel.toLowerCase().includes(firstToken(demandModel).toLowerCase());
                        similarityScore = isMatch ? 100 : 0;
                    }
                } else {
                    similarityScore = getSimilarity(demandAd.title, offerAd.title);
                    isMatch = similarityScore >= 0.35;
                    similarityScore = Math.round(similarityScore * 100);
                }

                if (isMatch) {
                    const dedupKey = `${offerAd.url || offerAd.id}__${demandAd.url || demandAd.id}`;
                    if (seenMatches.has(dedupKey)) continue;
                    seenMatches.add(dedupKey);

                    const arbitrageScore = demandPrice - offerPrice;
                    const opportunityScore = computeOpportunityScore(arbitrageScore, similarityScore, demandAd.date_posted || '', offerAd.date_posted || '');
                    const locScore = locationSimilarity(demandAd.location || '', offerAd.location || '');
                    const baseline = median(offerPricesByBrand[demandAd.brand] || []);
                    const trustScore = priceTrustScore(offerPrice as number, baseline);
                    const realOpportunityScore = computeRealOpportunityScore(arbitrageScore, demandPrice, offerPrice, similarityScore, demandAd.date_posted || '', offerAd.date_posted || '', locScore, trustScore);

                    if (resolvedMatchKeys.has(dedupKey)) continue;

                    const matchObj = {
                        offer: { ...offerAd, similarity: similarityScore, ai: useAI },
                        demand: demandAd,
                        arbitrageScore,
                        opportunityScore,
                        realOpportunityScore,
                        expectedNetProfit: Math.max(0, Math.round(arbitrageScore - 400)),
                        locationScore: locScore,
                        priceTrustScore: trustScore,
                    };
                    foundMatches.push(matchObj);
                    await saveMatch(offerAd.id, demandAd.id, similarityScore, useAI);
                }
            }
        }

        // Seřazení výsledků od nejvyššího potenciálního zisku (arbitrážního skóre)
        foundMatches.sort((a, b) => (b.realOpportunityScore - a.realOpportunityScore) || (b.arbitrageScore - a.arbitrageScore));
        pushRuntimeLog(`Porovnání dokončeno. Nalezeno ${foundMatches.length} shod.`, foundMatches.length > 0 ? 'success' : 'system');

        res.json({
            message: `Porovnání dokončeno! Nalezeno ${foundMatches.length} shod. ${useAI ? '(AI embeddingy)' : '(Klíčová slova)'}`,
            data: foundMatches,
        });

    } catch (error) {
pushRuntimeLog(`Chyba porovnávání: ${error instanceof Error ? error.message : 'neznámá chyba'}`, 'error');
        console.error('Během porovnávání došlo k chybě:', error);
        const errorMessage = error instanceof Error ? error.message : 'Došlo k neznámé chybě';
        res.status(500).json({ message: 'Během porovnávání došlo k chybě.', error: errorMessage });
    }
});

app.listen(port, () => {
    pushRuntimeLog(`Backend server běží na adrese http://localhost:${port}`, 'success');
});
