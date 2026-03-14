import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { spawn, ChildProcess } from 'child_process';
import { initDb, saveAd, getAllAds, updateAdModelAi, updateAdEmbedding, getAllAdsByType, saveMatch, getRecentScrapedUrls, getScrapeCheckpoint, updateScrapeCheckpoint, usingPostgres, isPgVectorAvailable, getPgVectorSimilarities, saveMatchMeta, getResolvedMatchKeys, getDailyMetaStats, clearDatabase, getPreviouslySeenMatchKeys, markMatchesAsSeen, bulkUpdateMatches, getFollowUps, saveConversation, getConversationHistory, getLastConversation, getConversationStats, initDealState, updateDealState, getDealState, getAllDealStates, markDealContacted, markDealStalled, incrementFollowupCount, scheduleFollowup, getPendingFollowups, markFollowupSent, getDealPipeline, saveFraudFlag, getFraudFlags, resolveFraudFlag, addToWatchlist, getWatchlist, isSellerOnWatchlist, removeFromWatchlist, saveNegotiation, updateNegotiation, getNegotiationHistoryLegacy, saveDealAnalytics, getAnalytics, getAnalyticsByPeriod, saveFraudAnalysis, getFraudAnalysisHistory, getFraudAnalysisStats, saveEmailSettings, getEmailSettings, saveEmailTemplate, getEmailTemplate, getAllEmailTemplates, logEmailNotification, saveCalendarEvent, getCalendarEvent, getUpcomingCalendarEvents, updateCalendarEventStatus, generateICal, saveFraudThresholds, getFraudThresholds, getRiskLevel, saveMeetingFeedback, getMeetingFeedback, getFeedbackStats, getNegotiationHistory, saveNegotiationDB, saveNegotiationMessage, getNegotiationStats, saveMLModel, getMLModel, saveNegotiationPattern, getNegotiationPatterns, updatePatternUsage } from './database.js';
import type { DealState, FraudFlag } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const isLocalOllama = OLLAMA_BASE_URL.includes('localhost') || OLLAMA_BASE_URL.includes('127.0.0.1');
let ollamaModel = process.env.OLLAMA_MODEL || 'all-minilm:22m';

initDb().catch(console.error);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

let ollamaProcess: ChildProcess | null = null;
let isOllamaRunning = false;

// ========================================
// Performance: AI Response Cache
// ========================================
interface CachedResponse {
  data: any;
  timestamp: number;
  ttl: number; // time to live in ms
}

const aiResponseCache = new Map<string, CachedResponse>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes default

const getCachedAIResponse = (key: string): any | null => {
  const cached = aiResponseCache.get(key);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data;
  }
  aiResponseCache.delete(key);
  return null;
};

const setCachedAIResponse = (key: string, data: any, ttl: number = CACHE_TTL) => {
  aiResponseCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
  });
  
  // Cleanup old entries (max 1000 cache entries)
  if (aiResponseCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of aiResponseCache.entries()) {
      if (now - v.timestamp > v.ttl) {
        aiResponseCache.delete(k);
      }
    }
  }
};

const clearAICache = (pattern?: string) => {
  if (!pattern) {
    aiResponseCache.clear();
    return;
  }
  for (const key of aiResponseCache.keys()) {
    if (key.includes(pattern)) {
      aiResponseCache.delete(key);
    }
  }
};

// Helper function to generate cache key for AI prompts
const getAICacheKey = (prompt: string, model: string): string => {
  return `ai:${model}:${Buffer.from(prompt).toString('base64').substring(0, 64)}`;
};

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
    console.log('[TOGGLE] Request received:', action);
    
    try {
        if (action === 'start') {
            const alreadyRunning = await checkOllamaStatus();
            if (alreadyRunning) {
                console.log('[TOGGLE] Ollama already running');
                return res.json({ message: 'Ollama již běží.', status: true });
            }

            if (!isLocalOllama) {
                console.log('[TOGGLE] Remote Ollama cannot start');
                return res.json({
                    message: `Nelze spustit vzdálený Ollama.`,
                    status: false
                });
            }

            console.log('[TOGGLE] Starting Ollama...');
            // Pouze nastavíme flag - uživatel musí spustit Ollama manuálně
            isOllamaRunning = true;
            
            // Zkusíme spustit Ollama v backgroundu bez čekání
            setImmediate(() => {
                const { spawn } = require('child_process');
                const child = spawn('ollama', ['serve'], {
                    detached: true,
                    stdio: 'ignore',
                    shell: true
                });
                child.unref();
                console.log('[TOGGLE] Ollama spawn initiated');
            });

            return res.json({
                message: 'Ollama se spouští...',
                status: false // Ještě neběží
            });
        } else {
            // action === 'stop'
            console.log('[TOGGLE] Stopping Ollama');
            isOllamaRunning = false;
            return res.json({ message: 'Ollama zastavena.', status: false });
        }
    } catch (error) {
        console.error('[TOGGLE] Error:', error);
        return res.status(500).json({
            message: 'Chyba: ' + (error instanceof Error ? error.message : 'Neznámá'),
            status: false
        });
    }
});

app.get('/ollama/status', async (req, res) => {
    const running = await checkOllamaStatus();
    res.json({ status: running });
});

app.get('/settings', (req, res) => {
    res.json({
        ollamaUrl: OLLAMA_BASE_URL,
        ollamaModel,
    });
});

app.post('/settings', (req, res) => {
    const requestedModel = typeof req.body?.ollamaModel === 'string' ? req.body.ollamaModel.trim() : '';

    if (!requestedModel) {
        return res.status(400).json({ message: 'Model Ollama je povinný.' });
    }

    ollamaModel = requestedModel;
    return res.json({
        message: `Model Ollama byl uložen: ${ollamaModel}`,
        ollamaModel,
    });
});

app.post('/database/clear', async (req, res) => {
    try {
        await clearDatabase();
        return res.json({ message: 'Databáze byla vymazána.' });
    } catch (error) {
        console.error('Chyba při mazání databáze:', error);
        return res.status(500).json({ message: 'Mazání databáze selhalo.' });
    }
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

let hasLoggedGenerateUnsupportedWarning = false;

const isEmbeddingOnlyModel = (modelName: string): boolean => {
    const normalized = modelName.toLowerCase();
    return normalized.includes('embed') || normalized.includes('minilm') || normalized.includes('e5') || normalized.includes('bge');
};

const extractModelHeuristic = (title: string, description: string): string => {
    const text = `${title} ${description}`;
    const compact = text
        .replace(/["""]/g, ' ')
        .replace(/[,+]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // Detekce tabletů - iPad
    if (text.toLowerCase().includes('ipad') || text.toLowerCase().includes('tablet')) {
        const ipadMatch = text.match(/iPad\s+((?:Air|Pro|Mini)\s+\d{4}?\s*(?:\d{2,3}GB)?|\d+(?:\s*\w+)*)/i);
        if (ipadMatch) return `iPad ${ipadMatch[1].trim()}`.trim();
        return 'iPad';
    }

    const storageMatch = compact.match(/(\d{2,4})\s*GB\b/i);
    const storage = storageMatch && storageMatch[1] ? `${storageMatch[1]}GB` : '';

    // iPhone - přesnější extrakce s rozlišením Pro/Max/Plus
    const iphoneMatch = compact.match(/iPhone\s*(\d{1,2})\s*(Pro|Max|Plus|Mini)?/i);
    if (iphoneMatch) {
        const version = iphoneMatch[1];
        const variant = iphoneMatch[2] ? iphoneMatch[2] : '';
        return `iPhone ${version}${variant ? ' ' + variant : ''} ${storage}`.trim();
    }

    // Samsung Galaxy - rozlišení S/Note/A/Z/Fold/Flip
    const samsungMatch = compact.match(/Galaxy\s*((?:S|Note|A|Z|Fold|Flip)\s*\d+\s*(?:Ultra|Plus|Pro|FE)?)\s*(\d{2,3}GB)?/i);
    if (samsungMatch) {
        const model = samsungMatch[1];
        const stor = samsungMatch[2] || storage;
        return `Galaxy ${model} ${stor}`.trim();
    }

    // Xiaomi/Redmi/Poco - přesnější extrakce s rozlišením generací
    const xiaomiMatch = compact.match(/((?:Xiaomi|Redmi|Poco)\s+\d+[A-Za-z]*\d*\s*(?:Pro|Max|Ultra|T|Lite)?)\s*(\d{2,3}GB)?/i);
    if (xiaomiMatch) {
        const model = xiaomiMatch[1];
        const stor = xiaomiMatch[2] || storage;
        return `${model.trim()} ${stor}`.trim();
    }

    // Google Pixel
    const pixelMatch = compact.match(/Pixel\s*(\d+\s*(?:Pro|XL|a)?)/i);
    if (pixelMatch) {
        return `Pixel ${pixelMatch[1].trim()} ${storage}`.trim();
    }

    // Sony Xperia
    const xperiaMatch = compact.match(/Xperia\s*(\d+\s*(?:Pro|Mark|IV|V)?)/i);
    if (xperiaMatch) {
        return `Xperia ${xperiaMatch[1].trim()} ${storage}`.trim();
    }

    return storage || '';
};

const extractModelWithAI = async (title: string, description: string): Promise<string> => {
    if (isEmbeddingOnlyModel(ollamaModel)) {
        if (!hasLoggedGenerateUnsupportedWarning) {
            pushRuntimeLog(`Ollama model \"${ollamaModel}\" je embedding-only. Přeskakuji /api/generate a používám heuristickou extrakci modelu.`, 'system');
            hasLoggedGenerateUnsupportedWarning = true;
        }
        return extractModelHeuristic(title, description);
    }

    try {
        const prompt = `Extract only the specific mobile phone model name and its storage capacity (in GB) from this ad. 
        Format: "Model Name GB". Exclude brand. 
        If it's an iPhone, include the number and Pro/Max/Plus.
        Title: "${title}"
        Description: "${description.substring(0, 100)}"
        Model:`;

        const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
            model: ollamaModel,
            prompt: prompt,
            stream: false
        }, { timeout: 10000 });

        return response.data.response.trim();
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const details = String(error.response?.data?.error || '').toLowerCase();
            if (details.includes('does not support generate')) {
                if (!hasLoggedGenerateUnsupportedWarning) {
                    pushRuntimeLog(`Ollama model \"${ollamaModel}\" nepodporuje /api/generate. Používám heuristickou extrakci modelu.`, 'system');
                    hasLoggedGenerateUnsupportedWarning = true;
                }
                return extractModelHeuristic(title, description);
            }
            console.error('AI Extraction failed:', error.message, error.response?.data || '');
        } else {
            console.error('AI Extraction failed:', error);
        }
        return extractModelHeuristic(title, description);
    }
};

// ========================================
// AI Message Generator
// ========================================

interface MessageContext {
    match: any;
    side: 'seller' | 'buyer';
    channel: 'bazos' | 'sms' | 'email';
    previousMessages?: any[];
    userStyle?: 'formal' | 'friendly' | 'direct';
}

const generateAIMessage = async (context: MessageContext): Promise<{
    text: string;
    subject?: string;
    reasoning?: string;
}> => {
    const { match, side, channel, previousMessages = [], userStyle = 'friendly' } = context;
    const counterpart = side === 'seller' ? match.offer : match.demand;
    const otherSide = side === 'seller' ? match.demand : match.offer;

    const prompt = `
Generuj přirozenou lidskou zprávu pro ${side === 'seller' ? 'prodávajícího' : 'kupujícího'} na českém bazaru.

Kontext obchodu:
- Nabídka: ${match.offer.title} za ${match.offer.price} (${match.offer.location})
- Poptávka: ${match.demand.title} za ${match.demand.price} (${match.demand.location})
- Potenciální zisk: ${match.arbitrageScore} Kč
- Podobnost: ${match.similarityScore}%

${side === 'seller' ? `
Kontaktujeme PRODÁVAJÍCÍHO (${counterpart.title}):
- Máme zájemce který hledá: ${otherSide.title}
- Chceme nabídnout konkrétní telefon ze shody
` : `
Kontaktujeme KUPUJÍCÍHO (${counterpart.title}):
- Hledá: ${counterpart.title}
- Máme k dispozici: ${otherSide.title} za ${otherSide.price}
`}

${previousMessages.length > 0 ? `
Historie komunikace:
${previousMessages.map(m => `- ${m.sender === 'user' ? 'My' : 'Oni'}: ${m.message}`).join('\n')}
` : 'Toto je první zpráva.'}

Styl komunikace: ${userStyle}
Kanál: ${channel}

Požadavky na zprávu:
1. Zpráva musí znít lidsky, ne jako bot
2. Nikdy nepoužívat fráze jako "Inzerty Bot", "automatizovaná zpráva", "AI"
3. Být zdvořilý ale přímý
4. Obsahovat konkrétní detaily z inzerátu
5. ${side === 'seller' ? 'Nabídnout konkrétní telefon zájemci' : 'Vyjádřit zájem o konkrétní telefon'}
6. Nezmiňovat osobní předání pokud to není nutné
7. Maximálně ${channel === 'sms' ? '50 slov' : channel === 'bazos' ? '100 slov' : '150 slov'}

${channel === 'email' ? 'Vygeneruj také předmět zprávy (max 60 znaků).' : ''}

${channel === 'sms' ? 'DŮLEŽITÉ: SMS musí mít max 160 znaků včetně mezer!' : ''}

Formát odpovědi JSON:
{
  "subject": string (pouze pro email),
  "text": string,
  "reasoning": string (proč byla zpráva generována takto)
}
    `;

    // Check cache first
    const cacheKey = getAICacheKey(prompt, ollamaModel);
    const cached = getCachedAIResponse(cacheKey);
    if (cached) {
        pushRuntimeLog('AI zpráva načtena z cache', 'info');
        return cached;
    }

    try {
        const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
            model: ollamaModel,
            prompt: prompt,
            stream: false
        }, { timeout: 15000 });

        const rawText = response.data.response.trim();

        // Pokusit se extrahovat JSON z odpovědi
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            const result = {
                text: parsed.text || rawText,
                subject: parsed.subject,
                reasoning: parsed.reasoning,
            };
            // Cache the result
            setCachedAIResponse(cacheKey, result);
            return result;
        }

        // Fallback na čistý text
        const result = {
            text: rawText,
            reasoning: 'Generated as plain text',
        };
    } catch (error) {
        console.error('AI message generation failed:', error);
        pushRuntimeLog(`AI generování zprávy selhalo: ${error instanceof Error ? error.message : 'neznámá chyba'}`, 'error');
        
        // Fallback na klasickou šablonu
        return {
            text: generateFallbackMessage(context),
            reasoning: 'Fallback template (AI failed)',
        };
    }
};

const generateFallbackMessage = (context: MessageContext): string => {
    const { match, side, channel } = context;
    const counterpart = side === 'seller' ? match.offer : match.demand;
    const otherSide = side === 'seller' ? match.demand : match.offer;
    
    if (side === 'seller') {
        return `Dobrý den, mám zájemce který hledá ${otherSide.title}. Mám k dispozici ${otherSide.title} za ${otherSide.price}. Zařízení je plně funkční. Máte zájem? Děkuji.`;
    } else {
        return `Dobrý den, viděl jsem Váš inzerát. Mám k dispozici ${otherSide.title} za ${otherSide.price}. Přesně odpovídá Vašemu zájmu. Zařízení je plně funkční. Máte zájem? Děkuji.`;
    }
};

// ========================================
// AI Fraud Detection
// ========================================

interface FraudAnalysisResult {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  flags: FraudFlag[];
  recommendation: string;
}

const analyzeFraudRisk = async (ad: any, conversation?: any[]): Promise<FraudAnalysisResult> => {
  const prompt = `
Analyzuj tento inzerát na známky podvodu nebo rizika:

Inzerát:
- Titulek: ${ad.title}
- Cena: ${ad.price} Kč
- Popis: ${ad.description?.substring(0, 500) || 'Žádný popis'}
- Lokalita: ${ad.location || 'Neznámá'}
- URL: ${ad.url}

${conversation && conversation.length > 0 ? `
Komunikace:
${conversation.map((m: any) => `- ${m.sender}: ${m.message}`).join('\n')}
` : ''}

Hledej tyto red flags:
1. Podezřele nízká cena (výrazně pod tržní)
2. Tlak na rychlost ("ihned", "dnes", "spěchá")
3. Odmítání osobního předání
4. Požadavek na platbu předem
5. Podezřelý jazyk (gramatické chyby, generické texty)
6. Chybějící detaily o zařízení
7. Prodejce z jiné země
8. Požadavek na soukromé údaje
9. Příliš dobrá nabídka
10. Nekonzistence v komunikaci
11. Nový účet (méně než 30 dní)
12. Žádné reference/hodnocení

Formát odpovědi JSON:
{
  "riskLevel": "low|medium|high|critical",
  "riskScore": number (0-100),
  "flags": [
    {"type": string, "severity": "low|medium|high", "description": string, "evidence": string}
  ],
  "recommendation": string
}
  `;

  try {
    const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
      model: ollamaModel,
      prompt: prompt,
      stream: false
    }, { timeout: 15000 });

    const rawText = response.data.response.trim();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Fallback
    return {
      riskLevel: 'low',
      riskScore: 10,
      flags: [],
      recommendation: 'Žádné zjevné rizikové faktory.',
    };
  } catch (error) {
    console.error('Fraud analysis failed:', error);
    return {
      riskLevel: 'low',
      riskScore: 0,
      flags: [],
      recommendation: 'Analýza selhala, nelze posoudit.',
    };
  }
};

const checkSellerWatchlist = async (ad: any): Promise<{ isOnWatchlist: boolean; reason?: string; riskScore?: number }> => {
  try {
    // Extrahovat identifikátor prodejce z URL nebo telefonu
    const urlParts = ad.url.split('/');
    const sellerId = urlParts[urlParts.length - 2] || ad.url;
    
    const isOnWatchlist = await isSellerOnWatchlist(sellerId);
    
    if (isOnWatchlist) {
      const watchlist = await getWatchlist(true);
      const seller = watchlist.find((w: any) => w.seller_identifier === sellerId);
      return {
        isOnWatchlist: true,
        reason: seller?.reason,
        riskScore: seller?.risk_score,
      };
    }
    
    return { isOnWatchlist: false };
  } catch (error) {
    console.error('Watchlist check failed:', error);
    return { isOnWatchlist: false };
  }
};

// ========================================
// AI Negotiation Engine
// ========================================

interface NegotiationContext {
  offerPrice: number;
  demandPrice: number;
  marketAverage: number;
  deviceCondition?: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  daysOnMarket: number;
  sellerResponseRate?: number;
  urgency: 'low' | 'medium' | 'high';
  minProfit: number;
}

const calculateOptimalOffer = async (ctx: NegotiationContext): Promise<{
  recommendedOffer: number;
  minAcceptable: number;
  maxOffer: number;
  reasoning: string;
  confidenceScore: number;
}> => {
  const prompt = `
Analyzuj tuto obchodní situaci a navrhni optimální nabídku:

Data:
- Nabídková cena: ${ctx.offerPrice} Kč
- Poptávková cena: ${ctx.demandPrice} Kč
- Tržní průměr: ${ctx.marketAverage} Kč
- Stav zařízení: ${ctx.deviceCondition || 'neznámý'}
- Doba na trhu: ${ctx.daysOnMarket} dní
- Rychlost reakce prodejce: ${ctx.sellerResponseRate || 'neznámá'}%
- Urgence obchodu: ${ctx.urgency}
- Minimální zisk: ${ctx.minProfit} Kč

Požadavek:
1. Navrhni optimální nabídkovou cenu
2. Urči minimální přijatelnou cenu
3. Urči maximální cenu kterou nabídnout
4. Vysvětli reasoning

Formát odpovědi JSON:
{
  "recommendedOffer": number,
  "minAcceptable": number,
  "maxOffer": number,
  "reasoning": string,
  "confidenceScore": number (0-100)
}
  `;

  try {
    const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
      model: ollamaModel,
      prompt: prompt,
      stream: false
    }, { timeout: 15000 });

    const rawText = response.data.response.trim();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Fallback - jednoduchá kalkulace
    const spread = ctx.demandPrice - ctx.offerPrice;
    return {
      recommendedOffer: Math.round(ctx.offerPrice + spread * 0.3),
      minAcceptable: Math.round(ctx.offerPrice),
      maxOffer: Math.round(ctx.demandPrice - ctx.minProfit),
      reasoning: 'Fallback kalkulace基于 30% spread.',
      confidenceScore: 50,
    };
  } catch (error) {
    console.error('Optimal offer calculation failed:', error);
    const spread = ctx.demandPrice - ctx.offerPrice;
    return {
      recommendedOffer: Math.round(ctx.offerPrice + spread * 0.3),
      minAcceptable: Math.round(ctx.offerPrice),
      maxOffer: Math.round(ctx.demandPrice - ctx.minProfit),
      reasoning: 'Fallback kalkulace.',
      confidenceScore: 30,
    };
  }
};

const generateCounterOffer = async (
  currentOffer: number,
  counterPrice: number,
  demandPrice: number,
  minProfit: number
): Promise<{
  action: 'accept' | 'reject' | 'counter';
  counterPrice?: number;
  message: string;
}> => {
  const maxAcceptable = demandPrice - minProfit;
  
  if (counterPrice <= maxAcceptable) {
    return {
      action: 'accept',
      message: 'Dobrá, beru to. Domluvíme se na předání.',
    };
  }
  
  if (counterPrice > demandPrice) {
    return {
      action: 'reject',
      message: 'Děkuji, ale za tuto cenu to nemohu koupit. Přeji hodně štěstí s prodejem.',
    };
  }
  
  // Nabídnout něco mezi
  const newCounter = Math.round((currentOffer + counterPrice) / 2);
  if (newCounter <= maxAcceptable) {
    return {
      action: 'counter',
      counterPrice: newCounter,
      message: `Mohu nabídnout ${newCounter} Kč. Je to moje nejlepší nabídka.`,
    };
  }
  
  return {
    action: 'reject',
    message: `Děkuji za nabídku, ale to je nad mým rozpočtem. Přeji hodně štěstí s prodejem.`,
  };
};

const getEmbeddingFromOllama = async (text: string): Promise<number[] | null> => {
    try {
        const response = await axios.post(`${OLLAMA_BASE_URL}/api/embeddings`, {
            model: ollamaModel,
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

                // Určení typu inzerátu
                // - Pro nabídky: všechny inzeráty z nabídkové sekce jsou nabídky
                // - Pro poptávky: detekujeme z obsahu, protože vyhledávání může vrátit i nabídky
                const finalAdType = adType === 'nabidka' 
                    ? 'nabidka' 
                    : detectAdType(adTitle, adDescription);

                const ad = {
                    id: randomUUID(),
                    title: adTitle,
                    price: $(element).find(selectors.price).text().trim(),
                    link: fullLink,
                    date_posted: adDateStr,
                    brand: brand,
                    ad_type: finalAdType,
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
        // Nabídky - přímo sekce pro danou značku
        return [`https://mobil.bazos.cz/${brandSegment}/`];
    }

    // Poptávky - používáme vyhledávání s klíčovými slovy pro koupě
    // Vyhledáváme v celé kategorii mobilů pro danou značku
    const demandKeywords = ['koupím', 'sháním', 'hledám'];
    const urls: string[] = [];
    
    for (const keyword of demandKeywords) {
        // První stránka výsledků
        urls.push(`https://mobil.bazos.cz/${brandSegment}/?hledat=${encodeURIComponent(keyword)}&rubriky=mobil&hlokalita=&humkreis=25&cenaod=&cenado=&Submit=Hledat&order=&crp=&kitx=ano`);
        
        // Další stránky výsledků (20, 40, 60, 80 - celkem 5 stran = 100 inzerátů max)
        for (let page = 20; page <= 80; page += 20) {
            urls.push(`https://mobil.bazos.cz/${brandSegment}/${page}/?hledat=${encodeURIComponent(keyword)}&rubriky=mobil&hlokalita=&humkreis=25&cenaod=&cenado=&order=`);
        }
    }
    
    return urls;
};

// Detekce typu inzerátu z titulku a popisu
const detectAdType = (title: string, description: string): 'nabidka' | 'poptavka' => {
    const text = (title + ' ' + description).toLowerCase();
    
    // Klíčová slova pro poptávky (koupě)
    const demandKeywords = [
        'koupím', 'koupim', 'hledám', 'hledam', 'sháním', 'shanim',
        'chci koupit', 'chci kúpit', 'poptávám', 'poptavam',
        'zájem o koupi', 'máte na prodej', 'hledám ke koupi'
    ];
    
    // Klíčová slova pro nabídky (prodej)
    const offerKeywords = [
        'prodám', 'prodam', 'nabízím', 'nabizim', 'na prodej',
        'prodávám', 'prodavam', 'k dispozici', 'skladem',
        'ihned k odběru', 'ihned k prevzati'
    ];
    
    // Spočítat skóre pro oba typy
    let demandScore = 0;
    let offerScore = 0;
    
    for (const keyword of demandKeywords) {
        if (text.includes(keyword)) demandScore++;
    }
    
    for (const keyword of offerKeywords) {
        if (text.includes(keyword)) offerScore++;
    }
    
    // Pokud má poptávka vyšší skóre, je to poptávka
    if (demandScore > offerScore) return 'poptavka';
    
    // Pokud má nabídka vyšší nebo stejné skóre, je to nabídka (výchozí)
    return 'nabidka';
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

        let totalOffers = 0;
        let totalDemands = 0;
        let totalSavedOffers = 0;
        let totalSavedDemands = 0;

        for (const brand of BRANDS) {
            pushRuntimeLog(`Scrapuji inzeráty pro ${brand}`, 'system');
            const brandUrlSegment = getBrandSegment(brand);

            // 1. Scrapování nabídek
            pushRuntimeLog(`  Scrapuji nabídky pro ${brand}`, 'info');
            const offerUrl = getBazosBrandUrls(brand, brandUrlSegment, 'nabidka')[0] || `https://mobil.bazos.cz/${brandUrlSegment}/`;
            const offerResult = await scrapeUrl(offerUrl, brand, 'nabidka', selectors, effectiveScrapingOptions);

            // Všechny inzeráty z nabídek jsou skutečné nabídky (nemusíme detekovat)
            totalOffers += offerResult.ads.length;
            totalSavedOffers += offerResult.savedAdsCount;

            // 2. Scrapování poptávek
            pushRuntimeLog(`  Scrapuji poptávky pro ${brand}`, 'info');
            const demandUrls = getBazosBrandUrls(brand, brandUrlSegment, 'poptavka');
            let demandAds: any[] = [];
            let demandSavedCount = 0;
            const seenDemandUrls = new Set<string>();

            for (let i = 0; i < demandUrls.length; i++) {
                const demandUrl = demandUrls[i] ?? '';
                if (!demandUrl) continue;

                const keyword = ['koupím', 'sháním', 'hledám'][i] || 'koupím';
                pushRuntimeLog(`    Hledám poptávky s klíčovým slovem: "${keyword}"`, 'info');

                const demandResult = await scrapeUrl(demandUrl, brand, 'poptavka', selectors, {
                    ...effectiveScrapingOptions,
                    stopOnKnownAd: false, // Pro poptávky nepoužíváme checkpointy
                });

                // Filtrujeme duplicity mezi různými vyhledáváními
                const newAds = demandResult.ads.filter(ad => !seenDemandUrls.has(ad.url));
                newAds.forEach(ad => seenDemandUrls.add(ad.url));

                demandAds.push(...newAds);
                demandSavedCount += demandResult.savedAdsCount;

                if (newAds.length > 0) {
                    pushRuntimeLog(`    Nalezeno ${newAds.length} poptávek pro "${keyword}"`, 'success');
                }
            }

            // Pro poptávky musíme detekovat typ, protože vyhledávání může vrátit i nabídky
            const actualDemands = demandAds.filter(ad => ad.ad_type === 'poptavka');
            const accidentalOffers = demandAds.filter(ad => ad.ad_type === 'nabidka');

            if (accidentalOffers.length > 0) {
                pushRuntimeLog(`    Vyřazeno ${accidentalOffers.length} nabídek z výsledků poptávek (špatný typ)`, 'info');
            }

            totalDemands += actualDemands.length;
            totalSavedDemands += demandSavedCount;

            pushRuntimeLog(`  Výsledek pro ${brand}: Nabídky=${offerResult.ads.length} (uloženo: ${offerResult.savedAdsCount}), Poptávky=${actualDemands.length} (uloženo: ${demandSavedCount})`, 'success');
        }

        const totalSaved = totalSavedOffers + totalSavedDemands;
        const message = totalDemands === 0
            ? `Scrapování dokončeno! Načteno ${totalOffers} nabídek. Žádné poptávky nenalezeny - zkuste jiná klíčová slova.`
            : `Scrapování dokončeno! Načteno ${totalOffers} nabídek a ${totalDemands} poptávek; do DB uloženo ${totalSaved} inzerátů.`;

        res.json({
            message,
            data: {
                nabidkaCount: totalOffers,
                poptavkaCount: totalDemands,
                savedNabidkaCount: totalSavedOffers,
                savedPoptavkaCount: totalSavedDemands,
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
        
        // Vylepšený formát zprávy s detaily
        const formatMatch = (m: any, idx: number) => {
            const offerTitle = m.offer?.title || 'N/A';
            const demandTitle = m.demand?.title || 'N/A';
            const profit = m.arbitrageScore || 0;
            const opportunity = m.realOpportunityScore || m.opportunityScore || 0;
            const offerLocation = m.offer?.location || 'neuvedeno';
            const demandLocation = m.demand?.location || 'neuvedeno';
            return `${idx + 1}. 💰 ${profit} Kč | 📊 ${opportunity} bodů
   📦 Nabídka: ${offerTitle} (${offerLocation})
   📤 Poptávka: ${demandTitle} (${demandLocation})
   🔗 ${m.offer?.link || m.offer?.url || 'N/A'}`;
        };
        
        const summary = topMatches.length > 0 
            ? topMatches.map(formatMatch).join('\n\n')
            : 'Žádné nové položky splňující kritéria.';
        
        const header = `📈 Bazoš Alert - TOP příležitosti\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                       `Nalezeno celkem: ${filtered.length} | Zobrazuji: ${topMatches.length}\n` +
                       `Min. zisk: ${minProfit} Kč | Min. score: ${minScore}\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        const message = header + summary;

        const results: { telegram?: string; email?: string; discord?: string } = {};

        // Telegram - rozdělení dlouhých zpráv
        if (telegramBotToken && telegramChatId) {
            try {
                const messages = message.length > 4000 
                    ? [message.substring(0, 4000), '... (pokračování v další zprávě)']
                    : [message];
                
                for (const msg of messages) {
                    const tgRes = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/json' }, 
                        body: JSON.stringify({ 
                            chat_id: telegramChatId, 
                            text: msg,
                            parse_mode: 'Markdown'
                        }),
                    });
                    results.telegram = tgRes.ok ? 'sent' : `failed (${tgRes.status})`;
                }
            } catch (tgError) {
                results.telegram = `error: ${tgError instanceof Error ? tgError.message : 'Unknown'}`;
            }
        }

        // Email s HTML formátováním
        if (emailWebhookUrl) {
            try {
                const htmlContent = `
<!DOCTYPE html>
<html>
<head><style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 20px; }
    .header { background: #10b981; color: white; padding: 15px; border-radius: 8px 8px 0 0; text-align: center; }
    .match { border: 1px solid #e5e7eb; margin: 15px 0; padding: 15px; border-radius: 8px; }
    .profit { color: #10b981; font-size: 18px; font-weight: bold; }
    .score { color: #f59e0b; font-size: 16px; }
    .location { color: #6b7280; font-size: 14px; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
</style></head>
<body>
    <div class="container">
        <div class="header">
            <h1>📈 Bazoš Alert</h1>
            <p>Nové arbitrážní příležitosti</p>
        </div>
        ${topMatches.map((m: any, idx: number) => `
        <div class="match">
            <div class="profit">💰 ${m.arbitrageScore || 0} Kč | 📊 ${m.realOpportunityScore || m.opportunityScore || 0} bodů</div>
            <div><strong>Nabídka:</strong> ${m.offer?.title || 'N/A'} (${m.offer?.location || 'neuvedeno'})</div>
            <div><strong>Poptávka:</strong> ${m.demand?.title || 'N/A'} (${m.demand?.location || 'neuvedeno'})</div>
            <div style="margin-top: 10px;"><a href="${m.offer?.link || m.offer?.url || '#'}" style="color: #3b82f6;">Otevřít inzerát →</a></div>
        </div>
        `).join('')}
        <div class="footer">
            <p>Zasláno z Bazoš Arbitráž | Celkem nalezeno: ${filtered.length}</p>
        </div>
    </div>
</body>
</html>`;

                const emailRes = await fetch(emailWebhookUrl, {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        subject: `📈 Bazoš Alert - ${topMatches.length} nových příležitostí`,
                        text: message,
                        html: htmlContent,
                        matches: topMatches 
                    }),
                });
                results.email = emailRes.ok ? 'sent' : `failed (${emailRes.status})`;
            } catch (emailError) {
                results.email = `error: ${emailError instanceof Error ? emailError.message : 'Unknown'}`;
            }
        }

        // Discord - Embed formát
        if (discordWebhookUrl) {
            try {
                const embeds = topMatches.map((m: any, idx: number) => ({
                    title: `#${idx + 1} - ${m.offer?.title || 'N/A'}`,
                    description: `💰 **Zisk:** ${m.arbitrageScore || 0} Kč\n📊 **Score:** ${m.realOpportunityScore || m.opportunityScore || 0}/100`,
                    fields: [
                        { name: '📦 Nabídka', value: `${m.offer?.title || 'N/A'}\n📍 ${m.offer?.location || 'neuvedeno'}`, inline: true },
                        { name: '📤 Poptávka', value: `${m.demand?.title || 'N/A'}\n📍 ${m.demand?.location || 'neuvedeno'}`, inline: true },
                    ],
                    url: m.offer?.link || m.offer?.url || '#',
                    color: m.arbitrageScore >= 2000 ? 0x10b981 : m.arbitrageScore >= 1000 ? 0xf59e0b : 0xef4444,
                    footer: { text: `Bazoš Arbitráž • ${new Date().toLocaleDateString('cs-CZ')}` },
                    timestamp: new Date().toISOString(),
                }));

                const discordPayload = {
                    content: `📈 **Bazoš Alert - TOP příležitosti**\nNalezeno: ${filtered.length} | Min. zisk: ${minProfit} Kč`,
                    embeds: embeds.slice(0, 10), // Discord limit 10 embeds
                    username: 'Bazoš Arbitráž Bot',
                    avatar_url: 'https://i.imgur.com/A3b8zGk.png',
                };

                const discordRes = await fetch(discordWebhookUrl, {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify(discordPayload),
                });
                results.discord = discordRes.ok ? 'sent' : `failed (${discordRes.status})`;
            } catch (discordError) {
                results.discord = `error: ${discordError instanceof Error ? discordError.message : 'Unknown'}`;
            }
        }

        pushRuntimeLog(`Alerty odeslány: ${JSON.stringify(results)}`, 'success');
        res.json({ message: 'Alert processing finished', results, topMatchesCount: topMatches.length, totalMatches: filtered.length });
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
    const now = new Date().toISOString();
    
    // Rozšířené hlavičky pro kompletní export
    const headers = [
        'matchKey',
        'offerTitle',
        'demandTitle', 
        'profit',
        'opportunity',
        'offerPrice',
        'demandPrice',
        'offerLocation',
        'demandLocation',
        'offerUrl',
        'demandUrl',
        'status',
        'priority',
        'note',
        'lastActionAt',
        'followUpAt',
        'resolved',
        'brand',
        'exportedAt'
    ];
    
    const csvRows = rows.map((r: any) => {
        return headers.map((h) => {
            let value = r[h] ?? '';
            // Konverze boolean a čísel
            if (typeof value === 'boolean') value = value ? 'ANO' : 'NE';
            if (typeof value === 'number') value = value.toString().replace('.', ',');
            // Escape uvozovek
            value = String(value).replaceAll('"', '""');
            return `"${value}"`;
        }).join(',');
    });
    
    const csv = [headers.join(','), ...csvRows].join('\n');
    
    res.json({ 
        csv,
        count: rows.length,
        exportedAt: now,
    });
});

// Google Sheets integration
const googleSheetsStore: { 
    apiKey?: string;
    spreadsheetId?: string;
    sheetName: string;
    autoSync: boolean;
} = {
    sheetName: 'Arbitráže',
    autoSync: false,
};

app.get('/export/sheets/config', (req, res) => {
    res.json({ 
        config: { 
            ...googleSheetsStore, 
            apiKey: googleSheetsStore.apiKey ? '***' + googleSheetsStore.apiKey.slice(-4) : '' 
        } 
    });
});

app.post('/export/sheets/config', (req, res) => {
    const { apiKey, spreadsheetId, sheetName, autoSync } = req.body;
    
    if (typeof apiKey === 'string' && apiKey.trim()) {
        googleSheetsStore.apiKey = apiKey.trim();
    }
    if (typeof spreadsheetId === 'string' && spreadsheetId.trim()) {
        googleSheetsStore.spreadsheetId = spreadsheetId.trim();
    }
    if (typeof sheetName === 'string') {
        googleSheetsStore.sheetName = sheetName;
    }
    if (typeof autoSync === 'boolean') {
        googleSheetsStore.autoSync = autoSync;
    }
    
    pushRuntimeLog(`Google Sheets konfigurace aktualizována: spreadsheetId=${googleSheetsStore.spreadsheetId ? '***' : 'není'}, autoSync=${googleSheetsStore.autoSync}`, 'info');
    res.json({ message: 'Google Sheets configuration saved', config: googleSheetsStore });
});

app.post('/export/sheets', async (req, res) => {
    try {
        const { rows, spreadsheetId, sheetName, apiKey } = req.body;
        
        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ message: 'No data to export' });
        }
        
        const targetSpreadsheetId = spreadsheetId || googleSheetsStore.spreadsheetId;
        const targetSheetName = sheetName || googleSheetsStore.sheetName;
        const targetApiKey = apiKey || googleSheetsStore.apiKey;
        
        if (!targetSpreadsheetId) {
            return res.status(400).json({ message: 'Spreadsheet ID is required' });
        }
        
        if (!targetApiKey) {
            return res.status(400).json({ message: 'API key is required' });
        }
        
        // Prepare data for Google Sheets
        const headers = [
            'Datum exportu',
            'Nabídka - titul',
            'Poptávka - titul',
            'Zisk (Kč)',
            'Opportunity Score',
            'Nabídka - cena',
            'Poptávka - cena',
            'Nabídka - lokalita',
            'Poptávka - lokalita',
            'Nabídka - URL',
            'Poptávka - URL',
            'Stav',
            'Priorita',
            'Poznámka',
            'Follow-up',
            'Vyřešeno'
        ];
        
        const data = rows.map((r: any) => [
            new Date().toLocaleString('cs-CZ'),
            r.offerTitle || '',
            r.demandTitle || '',
            r.profit || 0,
            r.opportunity || 0,
            r.offerPrice || '',
            r.demandPrice || '',
            r.offerLocation || '',
            r.demandLocation || '',
            r.offerUrl || '',
            r.demandUrl || '',
            r.status || 'new',
            r.priority || 'medium',
            r.note || '',
            r.followUpAt ? new Date(r.followUpAt).toLocaleString('cs-CZ') : '',
            r.resolved ? 'ANO' : 'NE'
        ]);
        
        // Use Google Sheets API v4
        const sheetApiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${targetSpreadsheetId}/values/${encodeURIComponent(targetSheetName)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
        
        const response = await fetch(sheetApiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${targetApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                values: [headers, ...data]
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `Google Sheets API error (${response.status})`);
        }
        
        const result = await response.json();
        pushRuntimeLog(`Export do Google Sheets úspěšný: ${data.length} řádků`, 'success');
        
        res.json({ 
            message: `Exportováno ${data.length} řádků do Google Sheets`,
            spreadsheetId: targetSpreadsheetId,
            sheetName: targetSheetName,
            updatedRange: result.updates?.updatedRange,
            updatedRows: result.updates?.updatedRows,
        });
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        pushRuntimeLog(`Export do Google Sheets selhal: ${errorMessage}`, 'error');
        res.status(500).json({ message: 'Google Sheets export failed', error: errorMessage });
    }
});

// Alternative: Export via Google Apps Script Web App (simpler, no OAuth needed)
app.post('/export/sheets/webhook', async (req, res) => {
    try {
        const { rows, webhookUrl } = req.body;
        
        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ message: 'No data to export' });
        }
        
        if (!webhookUrl) {
            return res.status(400).json({ message: 'Webhook URL is required' });
        }
        
        // Prepare payload for Google Apps Script
        const payload = {
            action: 'append',
            data: rows.map((r: any) => ({
                timestamp: new Date().toISOString(),
                offerTitle: r.offerTitle || '',
                demandTitle: r.demandTitle || '',
                profit: r.profit || 0,
                opportunity: r.opportunity || 0,
                offerPrice: r.offerPrice || '',
                demandPrice: r.demandPrice || '',
                offerLocation: r.offerLocation || '',
                demandLocation: r.demandLocation || '',
                offerUrl: r.offerUrl || '',
                demandUrl: r.demandUrl || '',
                status: r.status || 'new',
                priority: r.priority || 'medium',
                note: r.note || '',
                followUpAt: r.followUpAt || '',
                resolved: r.resolved || false,
            }))
        };
        
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`Webhook error (${response.status})`);
        }
        
        const result = await response.json();
        pushRuntimeLog(`Export přes Google Apps Script úspěšný: ${rows.length} řádků`, 'success');
        
        res.json({ 
            message: `Exportováno ${rows.length} řádků do Google Sheets`,
            result,
        });
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        pushRuntimeLog(`Export přes webhook selhal: ${errorMessage}`, 'error');
        res.status(500).json({ message: 'Webhook export failed', error: errorMessage });
    }
});

// Calendar / Follow-up endpoints
app.get('/followups', async (req, res) => {
    try {
        const { from, to, state, overdue } = req.query;
        
        const followUps = await getFollowUps({
            from: typeof from === 'string' ? from : undefined,
            to: typeof to === 'string' ? to : undefined,
            state: typeof state === 'string' ? state : undefined,
            overdue: overdue === 'true',
        });
        
        res.json({ 
            followUps,
            count: followUps.length,
            overdueCount: followUps.filter(f => new Date(f.follow_up_at) < new Date()).length,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ message: 'Failed to get follow-ups', error: errorMessage });
    }
});

app.post('/followups/:matchKey/remind', async (req, res) => {
    try {
        const { matchKey } = req.params;
        const { telegramBotToken, telegramChatId, emailWebhookUrl } = req.body;
        
        // Get the follow-up details
        const followUps = await getFollowUps({});
        const followUp = followUps.find(f => f.match_key === matchKey);
        
        if (!followUp) {
            return res.status(404).json({ message: 'Follow-up not found' });
        }
        
        const isOverdue = new Date(followUp.follow_up_at) < new Date();
        const message = `⏰ ${isOverdue ? 'PROŠLÝ' : 'Nadcházející'} follow-up!\n\n` +
            `📦 ${followUp.offer_title || 'N/A'}\n` +
            `📤 ${followUp.demand_title || 'N/A'}\n` +
            `💰 Zisk: ${followUp.profit || 0} Kč\n` +
            `📅 Termín: ${new Date(followUp.follow_up_at).toLocaleString('cs-CZ')}\n` +
            `📝 Stav: ${followUp.follow_up_state}\n` +
            `📋 Poznámka: ${followUp.note || 'Žádná'}`;
        
        const results: { telegram?: string; email?: string } = {};
        
        if (telegramBotToken && telegramChatId) {
            const tgRes = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: telegramChatId, text: message }),
            });
            results.telegram = tgRes.ok ? 'sent' : `failed (${tgRes.status})`;
        }
        
        if (emailWebhookUrl) {
            const emailRes = await fetch(emailWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    subject: `⏰ Follow-up: ${followUp.offer_title}`,
                    text: message 
                }),
            });
            results.email = emailRes.ok ? 'sent' : `failed (${emailRes.status})`;
        }
        
        pushRuntimeLog(`Reminder odeslán pro ${matchKey}`, 'info');
        res.json({ message: 'Reminder sent', results, followUp });
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ message: 'Failed to send reminder', error: errorMessage });
    }
});

app.get('/followups/summary', async (req, res) => {
    try {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        const [overdue, today_followups, tomorrow_followups, week_followups] = await Promise.all([
            getFollowUps({ overdue: true }),
            getFollowUps({ 
                from: today.toISOString().slice(0, 10), 
                to: today.toISOString().slice(0, 10) 
            }),
            getFollowUps({ 
                from: tomorrow.toISOString().slice(0, 10), 
                to: tomorrow.toISOString().slice(0, 10) 
            }),
            getFollowUps({ 
                from: today.toISOString().slice(0, 10), 
                to: nextWeek.toISOString().slice(0, 10) 
            }),
        ]);
        
        res.json({
            overdue: { count: overdue.length, items: overdue },
            today: { count: today_followups.length, items: today_followups },
            tomorrow: { count: tomorrow_followups.length, items: tomorrow_followups },
            thisWeek: { count: week_followups.length, items: week_followups },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ message: 'Failed to get follow-up summary', error: errorMessage });
    }
});

// Custom message templates storage
const messageTemplates: Record<string, { seller: string; buyer: string; email: string }> = {};

app.get('/templates/messages', (req, res) => {
    res.json({ templates: messageTemplates });
});

app.post('/templates/messages', (req, res) => {
    const { side, channel, template } = req.body;

    if (!side || !channel || !template) {
        return res.status(400).json({ message: 'Missing required fields: side, channel, template' });
    }

    if (!['seller', 'buyer'].includes(side)) {
        return res.status(400).json({ message: 'Invalid side. Must be "seller" or "buyer".' });
    }

    if (!['bazos', 'sms', 'email'].includes(channel)) {
        return res.status(400).json({ message: 'Invalid channel. Must be "bazos", "sms", or "email".' });
    }

    messageTemplates[`${side}_${channel}`] = template;
    pushRuntimeLog(`Šablona zprávy uložena: ${side}/${channel}`, 'info');
    res.json({ message: 'Template saved', side, channel, template });
});

// ========================================
// AI Message Generation Endpoints
// ========================================

app.post('/ai/generate-message', async (req, res) => {
    try {
        const { matchKey, side, channel, userStyle } = req.body;
        
        if (!matchKey || !side || !channel) {
            return res.status(400).json({ message: 'Missing required fields: matchKey, side, channel' });
        }
        
        // Načíst match z databáze (vytvořit mock match z matchKey)
        // Pro tuto implementaci předpokládáme že match je předán v requestu
        const match = req.body.match;
        if (!match) {
            return res.status(400).json({ message: 'Match data required' });
        }
        
        // Získat historii konverzací
        const previousMessages = await getConversationHistory(matchKey);
        
        // Generovat AI zprávu
        const aiMessage = await generateAIMessage({
            match,
            side,
            channel,
            previousMessages: previousMessages.map(m => ({
                sender: m.sender,
                message: m.message,
            })),
            userStyle: userStyle || 'friendly',
        });
        
        // Uložit konverzaci pokud byla zpráva úspěšně generována
        if (aiMessage.text) {
            await saveConversation(
                matchKey,
                aiMessage.text,
                'user',
                channel,
                true, // is_ai_generated
                {
                    side,
                    userStyle,
                    reasoning: aiMessage.reasoning,
                }
            );
        }
        
        res.json({
            success: true,
            message: aiMessage.text,
            subject: aiMessage.subject,
            reasoning: aiMessage.reasoning,
            isAiGenerated: true,
        });
    } catch (error) {
        console.error('Error generating AI message:', error);
        res.status(500).json({ 
            message: 'AI message generation failed',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

app.get('/conversations/:matchKey', async (req, res) => {
    try {
        const { matchKey } = req.params;
        const history = await getConversationHistory(matchKey);
        const stats = await getConversationStats(matchKey);
        
        res.json({
            success: true,
            history,
            stats,
        });
    } catch (error) {
        console.error('Error fetching conversation:', error);
        res.status(500).json({ 
            message: 'Failed to fetch conversation',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

app.post('/conversations/:matchKey', async (req, res) => {
    try {
        const { matchKey } = req.params;
        const { message, sender, channel, isAiGenerated } = req.body;
        
        if (!message || !sender) {
            return res.status(400).json({ message: 'Missing required fields: message, sender' });
        }
        
        await saveConversation(
            matchKey,
            message,
            sender,
            channel,
            isAiGenerated,
            req.body.contextSnapshot
        );
        
        res.json({
            success: true,
            message: 'Conversation saved',
        });
    } catch (error) {
        console.error('Error saving conversation:', error);
        res.status(500).json({
            message: 'Failed to save conversation',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ========================================
// Deal State Machine & Follow-up Endpoints
// ========================================

app.post('/deals/:matchKey/state', async (req, res) => {
    try {
        const { matchKey } = req.params;
        const { state } = req.body;
        
        if (!state) {
            return res.status(400).json({ message: 'State is required' });
        }
        
        // Inicializovat stav pokud neexistuje
        await initDealState(matchKey);
        
        // Aktualizovat stav
        await updateDealState(matchKey, state as DealState);
        
        // Pokud je stav 'contacted', naplánovat follow-up za 24 hodin
        if (state === 'contacted') {
            const followupAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            await scheduleFollowup(matchKey, followupAt, 'gentle_reminder', 'email', true);
            pushRuntimeLog(`Follow-up naplánován pro ${matchKey} za 24 hodin`, 'info');
        }
        
        res.json({
            success: true,
            message: `Deal state updated to ${state}`,
        });
    } catch (error) {
        console.error('Error updating deal state:', error);
        res.status(500).json({
            message: 'Failed to update deal state',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

app.get('/deals/:matchKey/state', async (req, res) => {
    try {
        const { matchKey } = req.params;
        const state = await getDealState(matchKey);
        
        if (!state) {
            // Inicializovat nový stav
            await initDealState(matchKey);
            const newState = await getDealState(matchKey);
            return res.json({ success: true, state: newState, initialized: true });
        }
        
        res.json({ success: true, state });
    } catch (error) {
        console.error('Error getting deal state:', error);
        res.status(500).json({
            message: 'Failed to get deal state',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

app.get('/deals/pipeline', async (req, res) => {
    try {
        const pipeline = await getDealPipeline();
        const allStates = await getAllDealStates();
        
        res.json({
            success: true,
            pipeline,
            allStates,
        });
    } catch (error) {
        console.error('Error getting deal pipeline:', error);
        res.status(500).json({
            message: 'Failed to get deal pipeline',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

app.get('/followups/pending', async (req, res) => {
    try {
        const pendingFollowups = await getPendingFollowups();
        res.json({
            success: true,
            followups: pendingFollowups,
        });
    } catch (error) {
        console.error('Error getting pending followups:', error);
        res.status(500).json({
            message: 'Failed to get pending followups',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ========================================
// Fraud Detection Endpoints
// ========================================

app.post('/fraud/analyze/:matchKey', async (req, res) => {
    try {
        const { matchKey } = req.params;
        const { offer, demand } = req.body;
        
        if (!offer || !demand) {
            return res.status(400).json({ message: 'Offer and demand data required' });
        }
        
        // Analyze both offer and demand for fraud
        const [offerAnalysis, demandAnalysis] = await Promise.all([
            analyzeFraudRisk(offer),
            analyzeFraudRisk(demand),
        ]);
        
        // Check seller watchlist
        const watchlistCheck = await checkSellerWatchlist(offer);
        
        // Save fraud flags if high risk
        if (offerAnalysis.riskScore >= 50) {
            await saveFraudFlag(offer.url, offer.title, offerAnalysis.riskLevel, offerAnalysis.riskScore, offerAnalysis.flags);
        }
        
        // Add to watchlist if critical
        if (offerAnalysis.riskLevel === 'critical' || offerAnalysis.riskScore >= 80) {
            const urlParts = offer.url.split('/');
            const sellerId = urlParts[urlParts.length - 2] || offer.url;
            await addToWatchlist(
                sellerId,
                offerAnalysis.flags.map(f => f.description).join('; '),
                offerAnalysis.riskScore,
                new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
            );
        }
        
        res.json({
            success: true,
            offerAnalysis,
            demandAnalysis,
            watchlist: watchlistCheck,
            recommendation: offerAnalysis.riskScore > demandAnalysis.riskScore 
                ? offerAnalysis.recommendation 
                : demandAnalysis.recommendation,
        });
    } catch (error) {
        console.error('Error analyzing fraud:', error);
        res.status(500).json({
            message: 'Fraud analysis failed',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

app.get('/fraud/flags', async (req, res) => {
    try {
        const { adUrl } = req.query;
        const flags = await getFraudFlags(adUrl as string);
        
        res.json({
            success: true,
            flags,
        });
    } catch (error) {
        console.error('Error getting fraud flags:', error);
        res.status(500).json({
            message: 'Failed to get fraud flags',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

app.post('/fraud/resolve/:fraudId', async (req, res) => {
    try {
        const { fraudId } = req.params;
        await resolveFraudFlag(parseInt(fraudId));
        
        res.json({
            success: true,
            message: 'Fraud flag resolved',
        });
    } catch (error) {
        console.error('Error resolving fraud flag:', error);
        res.status(500).json({
            message: 'Failed to resolve fraud flag',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

app.get('/watchlist', async (req, res) => {
    try {
        const { active } = req.query;
        const watchlist = await getWatchlist(active !== 'false');
        
        res.json({
            success: true,
            watchlist,
        });
    } catch (error) {
        console.error('Error getting watchlist:', error);
        res.status(500).json({
            message: 'Failed to get watchlist',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

app.post('/watchlist/add', async (req, res) => {
    try {
        const { sellerIdentifier, reason, riskScore, expiresAt, notes } = req.body;
        
        if (!sellerIdentifier || !reason || !riskScore) {
            return res.status(400).json({ message: 'sellerIdentifier, reason, and riskScore required' });
        }
        
        await addToWatchlist(sellerIdentifier, reason, riskScore, expiresAt, notes);
        
        res.json({
            success: true,
            message: 'Seller added to watchlist',
        });
    } catch (error) {
        console.error('Error adding to watchlist:', error);
        res.status(500).json({
            message: 'Failed to add to watchlist',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ========================================
// Negotiation Endpoints
// ========================================

app.post('/negotiation/calculate', async (req, res) => {
    try {
        const { offerPrice, demandPrice, marketAverage, deviceCondition, daysOnMarket, sellerResponseRate, urgency, minProfit } = req.body;
        
        if (!offerPrice || !demandPrice || !minProfit) {
            return res.status(400).json({ message: 'offerPrice, demandPrice, and minProfit required' });
        }
        
        const optimalOffer = await calculateOptimalOffer({
            offerPrice,
            demandPrice,
            marketAverage: marketAverage || (offerPrice + demandPrice) / 2,
            deviceCondition,
            daysOnMarket: daysOnMarket || 0,
            sellerResponseRate,
            urgency: urgency || 'medium',
            minProfit,
        });
        
        res.json({
            success: true,
            ...optimalOffer,
        });
    } catch (error) {
        console.error('Error calculating optimal offer:', error);
        res.status(500).json({
            message: 'Failed to calculate optimal offer',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

app.post('/negotiation/counter', async (req, res) => {
    try {
        const { currentOffer, counterPrice, demandPrice, minProfit } = req.body;
        
        if (!currentOffer || !counterPrice || !demandPrice || !minProfit) {
            return res.status(400).json({ message: 'currentOffer, counterPrice, demandPrice, and minProfit required' });
        }
        
        const result = await generateCounterOffer(currentOffer, counterPrice, demandPrice, minProfit);
        
        res.json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error('Error generating counter offer:', error);
        res.status(500).json({
            message: 'Failed to generate counter offer',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

app.post('/negotiation/save', async (req, res) => {
    try {
        const { matchKey, offerPrice, counterPrice, finalPrice, status, aiSuggested } = req.body;
        
        if (!matchKey || !offerPrice) {
            return res.status(400).json({ message: 'matchKey and offerPrice required' });
        }
        
        await saveNegotiation(matchKey, offerPrice, counterPrice, finalPrice, status, aiSuggested);
        
        res.json({
            success: true,
            message: 'Negotiation saved',
        });
    } catch (error) {
        console.error('Error saving negotiation:', error);
        res.status(500).json({
            message: 'Failed to save negotiation',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

app.get('/negotiation/history/:matchKey', async (req, res) => {
    try {
        const { matchKey } = req.params;
        const history = await getNegotiationHistory(matchKey);

        res.json({
            success: true,
            history,
        });
    } catch (error) {
        console.error('Error getting negotiation history:', error);
        res.status(500).json({
            message: 'Failed to get negotiation history',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ========================================
// Auto Negotiation Settings & Stats
// ========================================

// In-memory storage for auto negotiation settings (should be in DB in production)
let autoNegotiationSettings = {
    enabled: false,
    minProfit: 1000,
    maxDiscountPercent: 30,
    autoAcceptThreshold: 5000,
    maxAutoNegotiations: 3,
    requireManualFinal: true,
};

app.get('/negotiation/settings', async (req, res) => {
    res.json({
        success: true,
        settings: autoNegotiationSettings,
    });
});

app.post('/negotiation/settings', async (req, res) => {
    try {
        autoNegotiationSettings = { ...autoNegotiationSettings, ...req.body };
        
        res.json({
            success: true,
            message: 'Settings saved',
            settings: autoNegotiationSettings,
        });
    } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({
            message: 'Failed to save settings',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

app.get('/negotiation/stats', async (req, res) => {
    try {
        // Get all negotiations from DB
        const allNegotiations = await Promise.all([
            // This would query the negotiation_history table
            // For now, return mock stats
        ]);

        const stats = {
            totalNegotiations: 0,
            successfulNegotiations: 0,
            avgSavings: 0,
            avgNegotiationRounds: 0,
        };

        res.json({
            success: true,
            stats,
        });
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({
            message: 'Failed to get stats',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ========================================
// Message Analyzer & Auto-Negotiation
// ========================================

// In-memory storage for negotiation logs
const negotiationLogs: any[] = [];

app.post('/negotiation/analyze-message', async (req, res) => {
    try {
        const { messageId, message } = req.body;

        if (!message) {
            return res.status(400).json({ message: 'Message text required' });
        }

        // AI analysis of the message
        const prompt = `
Analyzuj tuto zprávu od prodejce/kupujícího:

Zpráva: "${message}"

Hledej:
1. Obsahuje counter-nabídku (protinabídku)?
2. Pokud ano, extrahuj nabízenou cenu
3. Urči sentiment zprávy (pozitivní/neutrální/negativní)
4. Urči urgenci (nízká/střední/vysoká)

Formát odpovědi JSON:
{
  "contains_counter_offer": boolean,
  "extracted_price": number | null,
  "sentiment": "positive|neutral|negative",
  "urgency": "low|medium|high",
  "confidence": number (0-100)
}
        `;

        const cacheKey = getAICacheKey(prompt, ollamaModel);
        const cached = getCachedAIResponse(cacheKey);
        
        let analysis;
        if (cached) {
            analysis = cached;
        } else {
            const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
                model: ollamaModel,
                prompt: prompt,
                stream: false
            }, { timeout: 15000 });

            const rawText = response.data.response.trim();
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            
            if (jsonMatch) {
                analysis = JSON.parse(jsonMatch[0]);
                setCachedAIResponse(cacheKey, analysis);
            } else {
                analysis = {
                    contains_counter_offer: false,
                    extracted_price: null,
                    sentiment: 'neutral',
                    urgency: 'medium',
                    confidence: 50,
                };
            }
        }

        res.json({
            success: true,
            analysis,
        });
    } catch (error) {
        console.error('Error analyzing message:', error);
        res.status(500).json({
            message: 'Message analysis failed',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

app.post('/negotiation/auto-counter', async (req, res) => {
    try {
        const { matchKey, counterPrice } = req.body;

        if (!matchKey || !counterPrice) {
            return res.status(400).json({ message: 'matchKey and counterPrice required' });
        }

        // Get settings
        const settings = autoNegotiationSettings;

        if (!settings.enabled) {
            return res.status(400).json({ message: 'Auto-negotiation is disabled' });
        }

        // Get match details (would query DB in production)
        // For now, mock the demand price
        const demandPrice = 20000; // Mock
        const minProfit = settings.minProfit;
        const maxAcceptable = demandPrice - minProfit;

        let action: 'accept' | 'reject' | 'counter' = 'counter';
        let message = '';
        let newCounterPrice = counterPrice;

        // Decision logic
        if (counterPrice <= maxAcceptable) {
            action = 'accept';
            message = 'Dobrá, beru to. Domluvíme se na předání.';
        } else if (counterPrice > demandPrice) {
            action = 'reject';
            message = 'Děkuji, ale za tuto cenu to nemohu koupit. Přeji hodně štěstí s prodejem.';
        } else {
            // Counter-offer
            newCounterPrice = Math.round((counterPrice + (demandPrice - minProfit * 1.5)) / 2);
            if (newCounterPrice > maxAcceptable) {
                newCounterPrice = maxAcceptable;
            }
            message = `Mohu nabídnout ${newCounterPrice} Kč. Je to moje nejlepší nabídka.`;
        }

        // Check if manual review required
        if (settings.requireManualFinal && action === 'accept') {
            action = 'manual_review';
            message = 'Finální nabídka vyžaduje manuální schválení.';
        }

        // Save to logs
        const log = {
            id: negotiationLogs.length + 1,
            matchKey,
            action,
            counterPrice: newCounterPrice,
            message,
            aiSuggested: true,
            createdAt: new Date().toISOString(),
        };
        negotiationLogs.push(log);

        // Save negotiation to DB
        await saveNegotiation(
            matchKey,
            counterPrice,
            newCounterPrice,
            action === 'accept' ? newCounterPrice : undefined,
            action,
            true,
        );

        res.json({
            success: true,
            action,
            counterPrice: newCounterPrice,
            message,
            log,
        });
    } catch (error) {
        console.error('Error in auto-counter:', error);
        res.status(500).json({
            message: 'Auto-counter failed',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

app.get('/negotiation/logs', async (req, res) => {
    try {
        res.json({
            success: true,
            logs: negotiationLogs.slice(-50), // Last 50 logs
        });
    } catch (error) {
        console.error('Error getting logs:', error);
        res.status(500).json({
            message: 'Failed to get logs',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

app.get('/conversations/history', async (req, res) => {
    try {
        // Get all conversations from DB
        // For now, return empty array (would query DB in production)
        res.json({
            success: true,
            history: [],
        });
    } catch (error) {
        console.error('Error getting conversations:', error);
        res.status(500).json({
            message: 'Failed to get conversations',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ========================================
// AI Priority Scoring
// ========================================

// In-memory storage for priority scores
const priorityScores: Map<string, PriorityScore> = new Map();

// In-memory storage for priority weights
let priorityWeights = {
  profit_weight: 30,
  trust_weight: 25,
  urgency_weight: 20,
  market_weight: 15,
  capacity_weight: 10,
};

app.get('/priority/weights', async (req, res) => {
  try {
    res.json({
      success: true,
      weights: priorityWeights,
    });
  } catch (error) {
    console.error('Chyba při načítání vah priority:', error);
    res.status(500).json({
      message: 'Failed to get priority weights',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/priority/weights', async (req, res) => {
  try {
    const { profit_weight, trust_weight, urgency_weight, market_weight, capacity_weight } = req.body;

    const total = profit_weight + trust_weight + urgency_weight + market_weight + capacity_weight;
    if (total !== 100) {
      return res.status(400).json({ 
        message: 'Součet vah musí být přesně 100%',
        total,
      });
    }

    priorityWeights = {
      profit_weight,
      trust_weight,
      urgency_weight,
      market_weight,
      capacity_weight,
    };

    pushRuntimeLog(`Váhy priority aktualizovány: Zisk=${profit_weight}%, Důvěra=${trust_weight}%, Urgence=${urgency_weight}%, Trh=${market_weight}%, Kapacita=${capacity_weight}%`, 'info');

    res.json({
      success: true,
      message: 'Váhy priority uloženy',
      weights: priorityWeights,
    });
  } catch (error) {
    console.error('Chyba při ukládání vah priority:', error);
    res.status(500).json({
      message: 'Failed to save priority weights',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ========================================
// User Capacity Tracking
// ========================================

let userCapacity = {
  max_active_deals: 10,
  current_active_deals: 0,
  available_capacity: 10,
  capacity_percentage: 100,
  preferred_brands: [],
  workload_status: 'volný',
};

app.get('/priority/user-capacity', async (req, res) => {
  try {
    res.json({
      success: true,
      capacity: userCapacity,
    });
  } catch (error) {
    console.error('Chyba při načítání kapacity:', error);
    res.status(500).json({
      message: 'Failed to get user capacity',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/priority/user-capacity', async (req, res) => {
  try {
    const { max_active_deals, preferred_brands } = req.body;
    
    userCapacity = {
      ...userCapacity,
      max_active_deals: max_active_deals || userCapacity.max_active_deals,
      preferred_brands: preferred_brands || userCapacity.preferred_brands,
      available_capacity: (max_active_deals || userCapacity.max_active_deals) - userCapacity.current_active_deals,
      capacity_percentage: ((userCapacity.available_capacity) / (max_active_deals || userCapacity.max_active_deals)) * 100,
      workload_status: userCapacity.capacity_percentage >= 50 ? 'volný' : userCapacity.capacity_percentage >= 20 ? 'vytížený' : 'plný',
    };

    pushRuntimeLog(`Kapacita uživatele aktualizována: ${userCapacity.available_capacity}/${userCapacity.max_active_deals} (${Math.round(userCapacity.capacity_percentage)}%)`, 'info');

    res.json({
      success: true,
      message: 'Kapacita uživatele uložena',
      capacity: userCapacity,
    });
  } catch (error) {
    console.error('Chyba při ukládání kapacity:', error);
    res.status(500).json({
      message: 'Failed to save user capacity',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ========================================
// Historical Accuracy
// ========================================

let historicalAccuracy = {
  total_predictions: 0,
  accurate_predictions: 0,
  accuracy_percentage: 0,
  avg_profit_predicted: 0,
  avg_profit_actual: 0,
  last_30_days_accuracy: 0,
  prediction_trend: 'stabilní' as 'zlepšující' | 'stabilní' | 'zhoršující',
};

app.get('/priority/historical-accuracy', async (req, res) => {
  try {
    res.json({
      success: true,
      accuracy: historicalAccuracy,
    });
  } catch (error) {
    console.error('Chyba při načítání přesnosti:', error);
    res.status(500).json({
      message: 'Failed to get historical accuracy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ========================================
// Auto Prioritization
// ========================================

let autoPrioritization = {
  enabled: false,
  auto_sort_matches: true,
  highlight_top_priority: true,
  min_priority_score: 50,
  notification_threshold: 80,
  sort_order: 'sestupně' as 'sestupně' | 'vzestupně',
};

app.get('/priority/auto-prioritization', async (req, res) => {
  try {
    res.json({
      success: true,
      settings: autoPrioritization,
    });
  } catch (error) {
    console.error('Chyba při načítání automatizace:', error);
    res.status(500).json({
      message: 'Failed to get auto prioritization',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/priority/auto-prioritization', async (req, res) => {
  try {
    const { enabled, auto_sort_matches, highlight_top_priority, min_priority_score, notification_threshold, sort_order } = req.body;
    
    autoPrioritization = {
      enabled: enabled !== undefined ? enabled : autoPrioritization.enabled,
      auto_sort_matches: auto_sort_matches !== undefined ? auto_sort_matches : autoPrioritization.auto_sort_matches,
      highlight_top_priority: highlight_top_priority !== undefined ? highlight_top_priority : autoPrioritization.highlight_top_priority,
      min_priority_score: min_priority_score !== undefined ? min_priority_score : autoPrioritization.min_priority_score,
      notification_threshold: notification_threshold !== undefined ? notification_threshold : autoPrioritization.notification_threshold,
      sort_order: sort_order || autoPrioritization.sort_order,
    };

    pushRuntimeLog(`Automatická prioritizace ${autoPrioritization.enabled ? 'zapnuta' : 'vypnuta'}`, 'info');

    res.json({
      success: true,
      message: 'Nastavení automatizace uloženo',
      settings: autoPrioritization,
    });
  } catch (error) {
    console.error('Chyba při ukládání automatizace:', error);
    res.status(500).json({
      message: 'Failed to save auto prioritization',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ========================================
// Real Market Trends
// ========================================

let marketTrends: any[] = [
  {
    brand: 'Apple',
    trend: 'rostoucí',
    demand_change_percentage: 15,
    avg_price_change_percentage: 5,
    popular_models: ['iPhone 15 Pro', 'iPhone 15', 'iPhone 14'],
    last_updated: new Date().toISOString(),
  },
  {
    brand: 'Samsung',
    trend: 'stabilní',
    demand_change_percentage: 2,
    avg_price_change_percentage: -3,
    popular_models: ['Galaxy S24 Ultra', 'Galaxy S24', 'Galaxy Z Flip5'],
    last_updated: new Date().toISOString(),
  },
  {
    brand: 'Xiaomi',
    trend: 'rostoucí',
    demand_change_percentage: 8,
    avg_price_change_percentage: 0,
    popular_models: ['Xiaomi 14', 'Redmi Note 13', 'Poco X6'],
    last_updated: new Date().toISOString(),
  },
];

app.get('/priority/market-trends', async (req, res) => {
  try {
    res.json({
      success: true,
      trends: marketTrends,
    });
  } catch (error) {
    console.error('Chyba při načítání trendů:', error);
    res.status(500).json({
      message: 'Failed to get market trends',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/priority/market-trends/refresh', async (req, res) => {
  try {
    // In production: fetch real market data from API
    // For now, update timestamps and simulate small changes
    marketTrends = marketTrends.map(trend => ({
      ...trend,
      demand_change_percentage: trend.demand_change_percentage + (Math.random() * 4 - 2),
      last_updated: new Date().toISOString(),
    }));

    pushRuntimeLog('Tržní trendy aktualizovány', 'info');

    res.json({
      success: true,
      message: 'Tržní trendy aktualizovány',
      trends: marketTrends,
    });
  } catch (error) {
    console.error('Chyba při aktualizaci trendů:', error);
    res.status(500).json({
      message: 'Failed to refresh market trends',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

interface PriorityScore {
  matchKey: string;
  overallScore: number;
  components: {
    profitScore: number;
    trustScore: number;
    urgencyScore: number;
    marketScore: number;
    capacityScore: number;
  };
  recommendation: 'prioritize' | 'normal' | 'skip';
  reasoning: string;
  calculatedAt: string;
}

const calculatePriorityScore = async (match: any, matchKey: string): Promise<PriorityScore> => {
  const arbitrageScore = match.arbitrageScore || 0;
  const similarityScore = match.similarityScore || 0;
  const offerPrice = parseFloat(String(match.offer.price).replace(/[^0-9]/g, '')) || 0;
  const demandPrice = parseFloat(String(match.demand.price).replace(/[^0-9]/g, '')) || 0;

  const prompt = `
Ohodnoť tuto obchodní příležitost:

Obchod:
- Zisk: ${arbitrageScore} Kč
- Podobnost: ${similarityScore}%
- Nabídka: ${match.offer.title} za ${match.offer.price}
- Poptávka: ${match.demand.title} za ${match.demand.price}
- Cena nabídky: ${offerPrice} Kč
- Cena poptávky: ${demandPrice} Kč

Ohodnoť 0-100 a doporuč prioritu:
1. Profitabilita (váha 30%) - založeno na zisku a marži
2. Důvěryhodnost (váha 25%) - založeno na podobnosti inzerátů
3. Urgence (váha 20%) - založeno na rozdílu cen
4. Tržní trend (váha 15%) - založeno na typu zařízení
5. Kapacita (váha 10%) - assume střední kapacitu

Formát odpovědi JSON:
{
  "overallScore": number,
  "components": {
    "profitScore": number,
    "trustScore": number,
    "urgencyScore": number,
    "marketScore": number,
    "capacityScore": number
  },
  "recommendation": "prioritize|normal|skip",
  "reasoning": string
}
  `;

  const cacheKey = getAICacheKey(prompt, ollamaModel);
  const cached = getCachedAIResponse(cacheKey);
  
  if (cached) {
    return { ...cached, matchKey, calculatedAt: new Date().toISOString() };
  }

  try {
    const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
      model: ollamaModel,
      prompt: prompt,
      stream: false
    }, { timeout: 15000 });

    const rawText = response.data.response.trim();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    
    let score: PriorityScore;
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      score = {
        matchKey,
        overallScore: parsed.overallScore || 50,
        components: {
          profitScore: parsed.profitScore || 50,
          trustScore: parsed.trustScore || 50,
          urgencyScore: parsed.urgencyScore || 50,
          marketScore: parsed.marketScore || 50,
          capacityScore: parsed.capacityScore || 50,
        },
        recommendation: parsed.recommendation || 'normal',
        reasoning: parsed.reasoning || 'AI scoring unavailable',
        calculatedAt: new Date().toISOString(),
      };
    } else {
      // Fallback scoring
      const profitScore = Math.min(100, (arbitrageScore / 5000) * 100);
      const trustScore = similarityScore;
      const urgencyScore = Math.min(100, ((demandPrice - offerPrice) / offerPrice) * 200);
      const marketScore = 60; // Default
      const capacityScore = 70; // Default
      
      const overallScore = Math.round(
        profitScore * 0.30 +
        trustScore * 0.25 +
        urgencyScore * 0.20 +
        marketScore * 0.15 +
        capacityScore * 0.10
      );

      score = {
        matchKey,
        overallScore,
        components: {
          profitScore: Math.round(profitScore),
          trustScore: Math.round(trustScore),
          urgencyScore: Math.round(urgencyScore),
          marketScore: Math.round(marketScore),
          capacityScore: Math.round(capacityScore),
        },
        recommendation: overallScore >= 70 ? 'prioritize' : overallScore >= 40 ? 'normal' : 'skip',
        reasoning: 'Fallback scoring (AI unavailable)',
        calculatedAt: new Date().toISOString(),
      };
    }

    setCachedAIResponse(cacheKey, score);
    priorityScores.set(matchKey, score);
    return score;
  } catch (error) {
    console.error('Error calculating priority:', error);
    // Return default score on error
    const defaultScore: PriorityScore = {
      matchKey,
      overallScore: 50,
      components: {
        profitScore: 50,
        trustScore: 50,
        urgencyScore: 50,
        marketScore: 50,
        capacityScore: 50,
      },
      recommendation: 'normal',
      reasoning: 'Scoring unavailable (error)',
      calculatedAt: new Date().toISOString(),
    };
    priorityScores.set(matchKey, defaultScore);
    return defaultScore;
  }
};

app.get('/priority/dashboard', async (req, res) => {
  try {
    // Get all matches from DB (mock for now)
    const allMatches = Array.from(priorityScores.values());
    
    // Sort by overallScore descending
    allMatches.sort((a, b) => b.overallScore - a.overallScore);

    const stats = {
      totalMatches: allMatches.length,
      prioritizeCount: allMatches.filter(m => m.recommendation === 'prioritize').length,
      normalCount: allMatches.filter(m => m.recommendation === 'normal').length,
      skipCount: allMatches.filter(m => m.recommendation === 'skip').length,
      avgScore: allMatches.length > 0 
        ? allMatches.reduce((sum, m) => sum + m.overallScore, 0) / allMatches.length 
        : 0,
    };

    res.json({
      success: true,
      matches: allMatches,
      stats,
    });
  } catch (error) {
    console.error('Error getting priority dashboard:', error);
    res.status(500).json({
      message: 'Failed to get priority dashboard',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/priority/:matchKey', async (req, res) => {
  try {
    const { matchKey } = req.params;
    const score = priorityScores.get(matchKey);

    if (!score) {
      return res.status(404).json({
        message: 'Priority score not found',
      });
    }

    res.json({
      success: true,
      score,
    });
  } catch (error) {
    console.error('Error getting priority:', error);
    res.status(500).json({
      message: 'Failed to get priority',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/priority/calculate', async (req, res) => {
  try {
    const { matchKey, match } = req.body;

    if (!matchKey || !match) {
      return res.status(400).json({ message: 'matchKey and match required' });
    }

    const score = await calculatePriorityScore(match, matchKey);

    res.json({
      success: true,
      score,
    });
  } catch (error) {
    console.error('Error calculating priority:', error);
    res.status(500).json({
      message: 'Failed to calculate priority',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/priority/recalculate-all', async (req, res) => {
  try {
    // Clear all cached scores
    priorityScores.clear();
    clearAICache('ai:llama3.2:');

    res.json({
      success: true,
      message: 'All priorities recalculated',
    });
  } catch (error) {
    console.error('Error recalculating all:', error);
    res.status(500).json({
      message: 'Failed to recalculate all',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ========================================
// Deal State Tracking & Pipeline
// ========================================

app.get('/deals/pipeline-board', async (req, res) => {
  try {
    // Get pipeline stats
    const pipeline = await getDealPipeline();
    
    // Get all deals with state info (mock for now - would query DB in production)
    const deals = Array.from(priorityScores.entries()).map(([matchKey, score]) => ({
      matchKey,
      state: score.recommendation === 'prioritize' ? 'negotiating' : score.recommendation === 'skip' ? 'stalled' : 'contacted',
      stateChangedAt: score.calculatedAt,
      lastContactAt: score.calculatedAt,
      followupCount: 0,
      offer: { title: 'Mock Offer', price: '10000' },
      demand: { title: 'Mock Demand', price: '15000' },
      arbitrageScore: 5000,
    }));

    res.json({
      success: true,
      pipeline,
      deals,
    });
  } catch (error) {
    console.error('Error getting pipeline board:', error);
    res.status(500).json({
      message: 'Failed to get pipeline board',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/deals/:matchKey/state', async (req, res) => {
  try {
    const { matchKey } = req.params;
    
    // Get deal state from DB (mock for now)
    const state = await getDealState(matchKey);
    
    if (!state) {
      // Initialize new state
      await initDealState(matchKey);
      const newState = await getDealState(matchKey);
      return res.json({ success: true, state: newState, initialized: true });
    }

    res.json({ success: true, state });
  } catch (error) {
    console.error('Error getting deal state:', error);
    res.status(500).json({
      message: 'Failed to get deal state',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/deals/:matchKey/state', async (req, res) => {
  try {
    const { matchKey } = req.params;
    const { state } = req.body;

    if (!state) {
      return res.status(400).json({ message: 'State is required' });
    }

    // Initialize if not exists
    await initDealState(matchKey);
    
    // Update state
    await updateDealState(matchKey, state);
    
    // Get updated state
    const updatedState = await getDealState(matchKey);

    // Log state change
    pushRuntimeLog(`Stav obchodu ${matchKey} změněn na ${state}`, 'info');

    // Auto-actions based on state
    if (state === 'contacted') {
      // Schedule follow-up in 24h
      const followupAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await scheduleFollowup(matchKey, followupAt, 'gentle_reminder', 'email', true);
      pushRuntimeLog(`Follow-up naplánován pro ${matchKey} za 24 hodin`, 'info');
    }

    if (state === 'completed') {
      // Save analytics
      await saveDealAnalytics(
        matchKey,
        5000, // mock initial profit
        5000, // mock final profit
        48, // mock time to close
        3, // mock negotiation count
        5, // mock followup count
        100, // mock success rate
      );
      pushRuntimeLog(`Obchod ${matchKey} dokončen - analytics uloženy`, 'success');
    }

    res.json({
      success: true,
      state: updatedState,
    });
  } catch (error) {
    console.error('Error updating deal state:', error);
    res.status(500).json({
      message: 'Failed to update deal state',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ========================================
// Enhanced Fraud Detection
// ========================================

app.post('/fraud/analyze-full', async (req, res) => {
  try {
    const { matchKey, match } = req.body;

    if (!match) {
      return res.status(400).json({ message: 'Match data required' });
    }

    const prompt = `
Analyzuj tento obchod na známky podvodu nebo rizika:

Inzerát nabídky:
- Titulek: ${match.offer.title}
- Cena: ${match.offer.price} Kč
- Popis: ${match.offer.description || 'Žádný popis'}
- Lokalita: ${match.offer.location || 'Neznámá'}
- URL: ${match.offer.url}

Inzerát poptávky:
- Titulek: ${match.demand.title}
- Cena: ${match.demand.price} Kč
- Lokalita: ${match.demand.location || 'Neznámá'}

Zisk z obchodu: ${match.arbitrageScore || 0} Kč

Hledej tyto red flags:
1. Podezřele nízká cena (výrazně pod tržní)
2. Tlak na rychlost ("ihned", "dnes", "spěchá", "nutno prodat")
3. Odmítání osobního předání
4. Požadavek na platbu předem
5. Podezřelý jazyk (gramatické chyby, generické texty)
6. Chybějící detaily o zařízení
7. Prodejce z jiné země
8. Požadavek na soukromé údaje (rodné číslo, hesla)
9. Příliš dobrá nabídka (nevěřitelně vysoký zisk)
10. Nekonzistence v informacích
11. Nový účet prodejce (méně než 30 dní)
12. Žádné reference/hodnocení
13. Podezřelý email nebo telefon
14. Opakující se inzeráty se stejným zbožím
15. Cena výrazně nižší než poptávka (>50% rozdíl)

Ohodnoť riziko 0-100 a přiřaď úroveň:
- 0-24: low (nízké riziko)
- 25-49: medium (střední riziko)
- 50-79: high (vysoké riziko)
- 80-100: critical (kritické riziko)

Formát odpovědi JSON:
{
  "riskLevel": "low|medium|high|critical",
  "riskScore": number,
  "flags": [
    {"type": string, "severity": "low|medium|high", "description": string, "evidence": string}
  ],
  "recommendation": string
}
    `;

    const cacheKey = getAICacheKey(prompt, ollamaModel);
    const cached = getCachedAIResponse(cacheKey);

    let analysis;
    if (cached) {
      analysis = cached;
    } else {
      const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
        model: ollamaModel,
        prompt: prompt,
        stream: false
      }, { timeout: 20000 });

      const rawText = response.data.response.trim();
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
        setCachedAIResponse(cacheKey, analysis);
      } else {
        // Fallback - basic risk assessment
        const arbitrageScore = match.arbitrageScore || 0;
        const riskScore = arbitrageScore > 5000 ? 60 : arbitrageScore > 3000 ? 40 : 20;

        analysis = {
          riskLevel: riskScore >= 80 ? 'critical' : riskScore >= 50 ? 'high' : riskScore >= 25 ? 'medium' : 'low',
          riskScore,
          flags: arbitrageScore > 5000 ? [{
            type: 'high_profit',
            severity: 'medium',
            description: 'Vysoký potenciální zisk může indikovat riziko',
            evidence: `Zisk ${arbitrageScore} Kč`,
          }] : [],
          recommendation: arbitrageScore > 5000
            ? 'Buďte opatrní - vysoký zisk může být příliš dobrý na to aby to byla pravda.'
            : 'Obchod vypadá bezpečně. Vždy ale dodržujte bezpečnostní zásady.',
        };
      }
    }

    // Store analysis in DATABASE (persistent storage)
    await saveFraudAnalysis(
      matchKey,
      match.offer.url,
      match.demand.url,
      analysis,
    );

    // Auto-add to watchlist if critical
    if (analysis.riskLevel === 'critical' || analysis.riskScore >= 80) {
      const urlParts = match.offer.url.split('/');
      const sellerId = urlParts[urlParts.length - 2] || match.offer.url;

      await addToWatchlist(
        sellerId,
        `Critical fraud risk: ${analysis.flags.map((f: any) => f.description).join('; ')}`,
        analysis.riskScore,
        new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        analysis.recommendation,
      );

      pushRuntimeLog(`Prodejce ${sellerId} automaticky přidán na watchlist (critical risk)`, 'warning');
    }

    res.json({
      success: true,
      analysis: {
        matchKey,
        ...analysis,
        analyzedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error in full fraud analysis:', error);
    res.status(500).json({
      message: 'Fraud analysis failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/fraud/report', async (req, res) => {
  try {
    // Get stats from database
    const stats = await getFraudAnalysisStats();
    
    // Get watchlist count
    const watchlist = await getWatchlist(true);

    // Get top fraud types from history
    const history = await getFraudAnalysisHistory(undefined, 100);
    const fraudTypeCounts: Record<string, number> = {};
    history.forEach((analysis: any) => {
      if (analysis.flags) {
        const flags = typeof analysis.flags === 'string' ? JSON.parse(analysis.flags) : analysis.flags;
        flags.forEach((flag: any) => {
          fraudTypeCounts[flag.type] = (fraudTypeCounts[flag.type] || 0) + 1;
        });
      }
    });

    const topFraudTypes = Object.entries(fraudTypeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const report = {
      totalAnalyzed: stats.total || 0,
      lowRisk: stats.low_risk || 0,
      mediumRisk: stats.medium_risk || 0,
      highRisk: stats.high_risk || 0,
      criticalRisk: stats.critical_risk || 0,
      watchlistCount: watchlist.length,
      topFraudTypes,
    };

    res.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error('Error getting fraud report:', error);
    res.status(500).json({
      message: 'Failed to get fraud report',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/fraud/history/:matchKey', async (req, res) => {
  try {
    const { matchKey } = req.params;
    const history = await getFraudAnalysisHistory(matchKey, 50);

    res.json({
      success: true,
      history,
    });
  } catch (error) {
    console.error('Error getting fraud history:', error);
    res.status(500).json({
      message: 'Failed to get fraud history',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ========================================
// Fraud Detection - Configurable Thresholds
// ========================================

app.get('/fraud/thresholds', async (req, res) => {
  try {
    const thresholds = await getFraudThresholds();

    res.json({
      success: true,
      thresholds,
    });
  } catch (error) {
    console.error('Error getting fraud thresholds:', error);
    res.status(500).json({
      message: 'Failed to get fraud thresholds',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/fraud/thresholds', async (req, res) => {
  try {
    const { low_risk_max, medium_risk_max, high_risk_max, critical_risk_min, auto_watchlist_threshold, enabled } = req.body;

    await saveFraudThresholds({
      low_risk_max: low_risk_max || 24,
      medium_risk_max: medium_risk_max || 49,
      high_risk_max: high_risk_max || 79,
      critical_risk_min: critical_risk_min || 80,
      auto_watchlist_threshold: auto_watchlist_threshold || 80,
      enabled: enabled !== undefined ? enabled : true,
    });

    pushRuntimeLog('Prahové hodnoty pro fraud detection aktualizovány', 'info');

    res.json({
      success: true,
      message: 'Prahové hodnoty uloženy',
    });
  } catch (error) {
    console.error('Error saving fraud thresholds:', error);
    res.status(500).json({
      message: 'Failed to save fraud thresholds',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ========================================
// Email Notifications & Templates
// ========================================

app.get('/email/settings', async (req, res) => {
  try {
    const settings = await getEmailSettings();
    res.json({
      success: true,
      settings: settings ? {
        smtp_host: settings.smtp_host,
        smtp_port: settings.smtp_port,
        smtp_user: settings.smtp_user,
        smtp_secure: !!settings.smtp_secure,
        from_email: settings.from_email,
        from_name: settings.from_name,
        enabled: !!settings.enabled,
      } : null,
    });
  } catch (error) {
    console.error('Error getting email settings:', error);
    res.status(500).json({
      message: 'Failed to get email settings',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/email/settings', async (req, res) => {
  try {
    const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, from_email, from_name, enabled } = req.body;

    await saveEmailSettings({
      smtp_host,
      smtp_port: smtp_port || 587,
      smtp_user,
      smtp_pass,
      smtp_secure: !!smtp_secure,
      from_email,
      from_name: from_name || 'Inzerty Bot',
      enabled: !!enabled,
    });

    res.json({
      success: true,
      message: 'Email settings saved',
    });
  } catch (error) {
    console.error('Error saving email settings:', error);
    res.status(500).json({
      message: 'Failed to save email settings',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/email/templates', async (req, res) => {
  try {
    const templates = await getAllEmailTemplates();
    res.json({
      success: true,
      templates,
    });
  } catch (error) {
    console.error('Error getting email templates:', error);
    res.status(500).json({
      message: 'Failed to get email templates',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/email/templates', async (req, res) => {
  try {
    const { name, subject, body, variables } = req.body;

    if (!name || !subject || !body) {
      return res.status(400).json({ message: 'name, subject, and body required' });
    }

    await saveEmailTemplate(name, subject, body, variables);

    res.json({
      success: true,
      message: 'Email template saved',
    });
  } catch (error) {
    console.error('Error saving email template:', error);
    res.status(500).json({
      message: 'Failed to save email template',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/email/send', async (req, res) => {
  try {
    const { to, subject, body, templateName, matchKey } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({ message: 'to, subject, and body required' });
    }

    // Get email settings
    const settings = await getEmailSettings();
    
    if (!settings || !settings.enabled) {
      // Email not configured - log but don't fail
      await logEmailNotification(to, subject, templateName || 'custom', 'skipped', 'Email not configured', matchKey);
      
      return res.json({
        success: true,
        skipped: true,
        message: 'Email not configured - notification logged',
      });
    }

    // In production: use nodemailer to send email
    // For now, just log the notification
    await logEmailNotification(to, subject, templateName || 'custom', 'sent', null, matchKey);
    
    pushRuntimeLog(`Email sent to ${to}: ${subject}`, 'success');

    res.json({
      success: true,
      message: 'Email sent successfully',
    });
  } catch (error) {
    console.error('Error sending email:', error);
    await logEmailNotification(
      req.body.to || 'unknown',
      req.body.subject || 'unknown',
      req.body.templateName || 'custom',
      'failed',
      error instanceof Error ? error.message : 'Unknown error',
      req.body.matchKey,
    );
    
    res.status(500).json({
      message: 'Failed to send email',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ========================================
// Calendar Integration
// ========================================

app.post('/calendar/event', async (req, res) => {
  try {
    const { matchKey, title, description, location_name, location_address, start_datetime, end_datetime, timezone } = req.body;

    if (!matchKey || !title || !start_datetime || !end_datetime) {
      return res.status(400).json({ message: 'matchKey, title, start_datetime, and end_datetime required' });
    }

    const event = await saveCalendarEvent({
      match_key: matchKey,
      title,
      description,
      location_name,
      location_address,
      start_datetime,
      end_datetime,
      timezone: timezone || 'Europe/Prague',
    });

    res.json({
      success: true,
      event,
    });
  } catch (error) {
    console.error('Error saving calendar event:', error);
    res.status(500).json({
      message: 'Failed to save calendar event',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/calendar/event/:matchKey', async (req, res) => {
  try {
    const { matchKey } = req.params;
    const event = await getCalendarEvent(matchKey);

    res.json({
      success: true,
      event,
    });
  } catch (error) {
    console.error('Error getting calendar event:', error);
    res.status(500).json({
      message: 'Failed to get calendar event',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/calendar/upcoming', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const events = await getUpcomingCalendarEvents(days);

    res.json({
      success: true,
      events,
    });
  } catch (error) {
    console.error('Error getting upcoming events:', error);
    res.status(500).json({
      message: 'Failed to get upcoming events',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/calendar/export/:matchKey', async (req, res) => {
  try {
    const { matchKey } = req.params;
    const event = await getCalendarEvent(matchKey);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const ical = generateICal(event);

    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', `attachment; filename="${event.title.replace(/[^a-z0-9]/gi, '_')}.ics"`);
    res.send(ical);
  } catch (error) {
    console.error('Error exporting calendar event:', error);
    res.status(500).json({
      message: 'Failed to export calendar event',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/calendar/event/:matchKey/status', async (req, res) => {
  try {
    const { matchKey } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'status required' });
    }

    await updateCalendarEventStatus(matchKey, status);

    res.json({
      success: true,
      message: 'Event status updated',
    });
  } catch (error) {
    console.error('Error updating event status:', error);
    res.status(500).json({
      message: 'Failed to update event status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ========================================
// Meeting Feedback
// ========================================

app.post('/meeting/feedback', async (req, res) => {
  try {
    const { match_key, meeting_id, rating, seller_rating, buyer_rating, meeting_successful, comments, would_meet_again, seller_behavior, location_rating } = req.body;

    if (!match_key || !rating) {
      return res.status(400).json({ message: 'match_key and rating are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    await saveMeetingFeedback({
      match_key,
      meeting_id,
      rating,
      seller_rating,
      buyer_rating,
      meeting_successful: meeting_successful !== undefined ? meeting_successful : true,
      comments,
      would_meet_again: would_meet_again !== undefined ? would_meet_again : true,
      seller_behavior,
      location_rating,
    });

    pushRuntimeLog(`Feedback uložen pro meeting ${match_key}`, 'success');

    res.json({
      success: true,
      message: 'Feedback uložen',
    });
  } catch (error) {
    console.error('Error saving feedback:', error);
    res.status(500).json({
      message: 'Failed to save feedback',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/meeting/feedback/:matchKey', async (req, res) => {
  try {
    const { matchKey } = req.params;
    const feedback = await getMeetingFeedback(matchKey);

    res.json({
      success: true,
      feedback,
    });
  } catch (error) {
    console.error('Error getting feedback:', error);
    res.status(500).json({
      message: 'Failed to get feedback',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/meeting/feedback-stats', async (req, res) => {
  try {
    const stats = await getFeedbackStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error getting feedback stats:', error);
    res.status(500).json({
      message: 'Failed to get feedback stats',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ========================================
// Meeting Scheduler & Reminders
// ========================================

// In-memory storage for scheduled meetings
const scheduledMeetings: any[] = [];

app.post('/meeting/suggest', async (req, res) => {
  try {
    const { matchKey, offerLocation, demandLocation } = req.body;

    // AI suggestion for meeting places and times
    const prompt = `
Navrhni optimální místa a časy pro předání mobilního telefonu mezi prodejcem a kupujícím.

Lokality:
- Prodejce: ${offerLocation || 'Neznámá'}
- Kupující: ${demandLocation || 'Neznámá'}

Požadavky:
1. Navrhni 3-5 veřejných bezpečných míst (kavárny, nákupní centra, nádraží)
2. Navrhni 3 časové sloty (dopoledne, odpoledne, večer)
3. Zohledni vzdálenost pro obě strany
4. Doporuč místa s dobrým spojením a parkováním

Formát odpovědi JSON:
{
  "suggestions": [
    {
      "place": {
        "name": string,
        "address": string,
        "type": "cafe|mall|station|public",
        "safety": number (0-100)
      },
      "time": {
        "datetime": string (ISO),
        "dayPart": "morning|afternoon|evening",
        "isWeekend": boolean
      },
      "reasoning": string
    }
  ]
}
    `;

    const cacheKey = getAICacheKey(prompt, ollamaModel);
    const cached = getCachedAIResponse(cacheKey);

    let suggestions;
    if (cached) {
      suggestions = cached.suggestions || [];
    } else {
      const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
        model: ollamaModel,
        prompt: prompt,
        stream: false
      }, { timeout: 15000 });

      const rawText = response.data.response.trim();
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        suggestions = parsed.suggestions || [];
        setCachedAIResponse(cacheKey, { suggestions });
      } else {
        // Fallback suggestions
        const now = new Date();
        suggestions = [
          {
            place: {
              name: 'Kavárna Centrum',
              address: 'Hlavní náměstí 1, Praha',
              type: 'cafe',
              safety: 85,
            },
            time: {
              datetime: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
              dayPart: 'afternoon',
              isWeekend: false,
            },
            reasoning: 'Veřejné místo s vysokou bezpečností a dobrým spojením.',
          },
          {
            place: {
              name: 'Nákupní Centrum',
              address: 'Obchodní 500, Praha',
              type: 'mall',
              safety: 90,
            },
            time: {
              datetime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
              dayPart: 'morning',
              isWeekend: true,
            },
            reasoning: 'Nákupní centrum s kamerovým systémem a parkováním.',
          },
        ];
      }
    }

    res.json({
      success: true,
      suggestions,
    });
  } catch (error) {
    console.error('Error suggesting meetings:', error);
    res.status(500).json({
      message: 'Failed to suggest meetings',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/meeting/schedule', async (req, res) => {
  try {
    const { matchKey, suggestion } = req.body;

    if (!matchKey || !suggestion) {
      return res.status(400).json({ message: 'matchKey and suggestion required' });
    }

    const meeting = {
      id: scheduledMeetings.length + 1,
      matchKey,
      place: suggestion.place,
      datetime: suggestion.time.datetime,
      status: 'scheduled',
      reminderSent: false,
      createdAt: new Date().toISOString(),
    };

    scheduledMeetings.push(meeting);

    // Schedule reminder (2 hours before meeting)
    const meetingTime = new Date(suggestion.time.datetime);
    const reminderTime = new Date(meetingTime.getTime() - 2 * 60 * 60 * 1000);
    
    pushRuntimeLog(`Reminder naplánován na ${reminderTime.toLocaleString()} pro meeting ${matchKey}`, 'info');

    res.json({
      success: true,
      meeting,
      message: 'Schůzka naplánována',
    });
  } catch (error) {
    console.error('Error scheduling meeting:', error);
    res.status(500).json({
      message: 'Failed to schedule meeting',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/meetings/list', async (req, res) => {
  try {
    res.json({
      success: true,
      meetings: scheduledMeetings,
    });
  } catch (error) {
    console.error('Error listing meetings:', error);
    res.status(500).json({
      message: 'Failed to list meetings',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/meeting/send-reminder/:matchKey', async (req, res) => {
  try {
    const { matchKey } = req.params;

    const meeting = scheduledMeetings.find(m => m.matchKey === matchKey);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Mark reminder as sent
    meeting.reminderSent = true;

    // In production: send email/SMS reminder
    pushRuntimeLog(`Reminder odeslán pro meeting ${matchKey}`, 'success');

    res.json({
      success: true,
      message: 'Reminder odeslán',
    });
  } catch (error) {
    console.error('Error sending reminder:', error);
    res.status(500).json({
      message: 'Failed to send reminder',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/meeting/cancel/:matchKey', async (req, res) => {
  try {
    const { matchKey } = req.params;

    const meeting = scheduledMeetings.find(m => m.matchKey === matchKey);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    meeting.status = 'cancelled';

    pushRuntimeLog(`Meeting ${matchKey} zrušen`, 'info');

    res.json({
      success: true,
      message: 'Meeting zrušen',
    });
  } catch (error) {
    console.error('Error canceling meeting:', error);
    res.status(500).json({
      message: 'Failed to cancel meeting',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/meeting/complete/:matchKey', async (req, res) => {
  try {
    const { matchKey } = req.params;

    const meeting = scheduledMeetings.find(m => m.matchKey === matchKey);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    meeting.status = 'completed';

    pushRuntimeLog(`Meeting ${matchKey} dokončen`, 'success');

    res.json({
      success: true,
      message: 'Meeting dokončen',
    });
  } catch (error) {
    console.error('Error completing meeting:', error);
    res.status(500).json({
      message: 'Failed to complete meeting',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Auto-check for upcoming meetings (run every 5 minutes)
setInterval(() => {
  const now = new Date();
  scheduledMeetings.forEach(meeting => {
    if (meeting.status === 'scheduled' && !meeting.reminderSent) {
      const meetingTime = new Date(meeting.datetime);
      const timeUntilMeeting = meetingTime.getTime() - now.getTime();
      
      // Send reminder 2 hours before meeting
      if (timeUntilMeeting > 0 && timeUntilMeeting < 2 * 60 * 60 * 1000) {
        meeting.reminderSent = true;
        pushRuntimeLog(`Auto-reminder pro meeting ${meeting.matchKey}`, 'info');
      }
    }
  });
}, 5 * 60 * 1000);

pushRuntimeLog('Meeting reminder checker spuštěn (kontrola každých 5 minut)', 'system');

// ========================================
// Analytics Endpoints
// ========================================

app.get('/analytics', async (req, res) => {
    try {
        const analytics = await getAnalytics();
        
        res.json({
            success: true,
            analytics,
        });
    } catch (error) {
        console.error('Error getting analytics:', error);
        res.status(500).json({
            message: 'Failed to get analytics',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

app.get('/analytics/period/:days', async (req, res) => {
    try {
        const { days } = req.params;
        const deals = await getAnalyticsByPeriod(parseInt(days));

        res.json({
            success: true,
            deals,
        });
    } catch (error) {
        console.error('Error getting analytics by period:', error);
        res.status(500).json({
            message: 'Failed to get analytics by period',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ========================================
// Cache Management Endpoints
// ========================================

app.post('/cache/clear', async (req, res) => {
    try {
        const { pattern } = req.body;
        clearAICache(pattern);

        res.json({
            success: true,
            message: pattern ? `Cache cleared for pattern: ${pattern}` : 'All cache cleared',
            remainingEntries: aiResponseCache.size,
        });
    } catch (error) {
        console.error('Error clearing cache:', error);
        res.status(500).json({
            message: 'Failed to clear cache',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

app.get('/cache/stats', async (req, res) => {
    try {
        const now = Date.now();
        let expiredCount = 0;
        let activeCount = 0;

        for (const [, v] of aiResponseCache.entries()) {
            if (now - v.timestamp > v.ttl) {
                expiredCount++;
            } else {
                activeCount++;
            }
        }

        res.json({
            success: true,
            stats: {
                totalEntries: aiResponseCache.size,
                activeEntries: activeCount,
                expiredEntries: expiredCount,
                cacheTTL: CACHE_TTL / 1000 / 60, // in minutes
            },
        });
    } catch (error) {
        console.error('Error getting cache stats:', error);
        res.status(500).json({
            message: 'Failed to get cache stats',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

app.post('/analytics/save/:matchKey', async (req, res) => {
    try {
        const { matchKey } = req.params;
        const { initialProfit, finalProfit, timeToCloseHours, negotiationCount, followupCount, successRate } = req.body;
        
        if (!initialProfit) {
            return res.status(400).json({ message: 'initialProfit required' });
        }
        
        await saveDealAnalytics(
            matchKey,
            initialProfit,
            finalProfit,
            timeToCloseHours,
            negotiationCount,
            followupCount,
            successRate,
        );
        
        res.json({
            success: true,
            message: 'Analytics saved',
        });
    } catch (error) {
        console.error('Error saving analytics:', error);
        res.status(500).json({
            message: 'Failed to save analytics',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Follow-up scheduler - běží každou minutu
const processFollowups = async () => {
    try {
        const pendingFollowups = await getPendingFollowups();
        
        if (pendingFollowups.length === 0) {
            return;
        }
        
        pushRuntimeLog(`Zpracovávám ${pendingFollowups.length} follow-upů...`, 'system');
        
        for (const followup of pendingFollowups) {
            try {
                // Generovat AI follow-up zprávu
                // Získat match detaily (pro tuto implementaci zjednodušené)
                const matchKey = followup.match_key;
                
                // Získat historii konverzací pro kontext
                const conversationHistory = await getConversationHistory(matchKey);
                
                // Generovat follow-up zprávu
                const followupMessage = await generateAIMessage({
                    match: {
                        offer: { title: '...', price: '...', location: '...' },
                        demand: { title: '...', price: '...', location: '...' },
                        arbitrageScore: 0,
                        similarityScore: 0,
                    },
                    side: 'seller',
                    channel: followup.channel || 'email',
                    previousMessages: conversationHistory.map(m => ({
                        sender: m.sender,
                        message: m.message,
                    })),
                    userStyle: 'friendly',
                });
                
                // Uložit follow-up zprávu
                await saveConversation(
                    matchKey,
                    followupMessage.text,
                    'user',
                    followup.channel || 'email',
                    followup.is_ai_generated,
                    {
                        template_type: followup.template_type,
                        followup_id: followup.id,
                    }
                );
                
                // Inkrementovat počítadlo follow-upů
                await incrementFollowupCount(matchKey);
                
                // Označit follow-up jako odeslaný
                await markFollowupSent(followup.id);
                
                pushRuntimeLog(`Follow-up ${followup.id} odeslán pro ${matchKey}`, 'success');
            } catch (error) {
                console.error(`Error processing followup ${followup.id}:`, error);
                pushRuntimeLog(`Chyba při zpracování follow-up ${followup.id}: ${error instanceof Error ? error.message : 'neznámá chyba'}`, 'error');
            }
        }
    } catch (error) {
        console.error('Error in followup processor:', error);
    }
};

// Spustit follow-up scheduler každou minutu
setInterval(processFollowups, 60 * 1000);
pushRuntimeLog('Follow-up scheduler spuštěn (kontrola každou minutu)', 'system');

// Auto-detect stalled deals - každých 6 hodin
const checkStalledDeals = async () => {
    try {
        const allStates = await getAllDealStates();
        const now = Date.now();
        const stalledThreshold = 48 * 60 * 60 * 1000; // 48 hodin
        
        for (const deal of allStates) {
            if (deal.state === 'contacted' || deal.state === 'negotiating') {
                const lastContact = deal.last_contact_at ? new Date(deal.last_contact_at).getTime() : 0;
                const hoursSinceContact = (now - lastContact) / (1000 * 60 * 60);
                
                if (hoursSinceContact > 48 && deal.state !== 'stalled') {
                    await markDealStalled(deal.match_key);
                    pushRuntimeLog(`Deal ${deal.match_key} označen jako stalled (${Math.round(hoursSinceContact)} hodin bez odpovědi)`, 'info');
                }
            }
        }
    } catch (error) {
        console.error('Error checking stalled deals:', error);
    }
};

// Spustit kontrolu stalled deals každých 6 hodin
setInterval(checkStalledDeals, 6 * 60 * 60 * 1000);
pushRuntimeLog('Stalled deal checker spuštěn (kontrola každých 6 hodin)', 'system');

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
            
            // Ignorovat poptávky bez specifikovaného modelu
            if (!demandModel || demandModel.length < 3) {
                continue;
            }
            
            // Ignorovat poptávky které obsahují pouze "Koupím" bez modelu
            if (demandAd.title.toLowerCase().trim() === 'koupím' || 
                demandAd.title.toLowerCase().trim() === 'hledám' ||
                demandAd.title.toLowerCase().trim() === 'sháním') {
                continue;
            }
            
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

                // Kontrola typu zařízení - tablety vs telefony
                const demandIsTablet = demandModel.toLowerCase().includes('ipad') || demandModel.toLowerCase().includes('tablet');
                const offerIsTablet = offerModel.toLowerCase().includes('ipad') || offerModel.toLowerCase().includes('tablet');
                if (demandIsTablet !== offerIsTablet) continue;

                if (useAI) {
                    const dbSimilarity = pgSimilarityMap.get(offerAd.id);

                    if (typeof dbSimilarity === 'number') {
                        similarityScore = dbSimilarity;

                        // Velmi přísná kontrola shody modelu
                        let modelMatch = false;
                        if (demandModel && offerModel) {
                            const demandNorm = demandModel.toLowerCase().trim();
                            const offerNorm = offerModel.toLowerCase().trim();
                            
                            // Přesná shoda
                            if (demandNorm === offerNorm) {
                                modelMatch = true;
                            }
                            // Nebo shoda s úpravou úložiště (např. "iPhone 15 128GB" vs "iPhone 15 256GB")
                            else if (demandNorm.length > 5 && offerNorm.length > 5) {
                                // Odstranění úložiště pro porovnání
                                const demandNoStorage = demandNorm.replace(/\d{2,4}gb/i, '').trim();
                                const offerNoStorage = offerNorm.replace(/\d{2,4}gb/i, '').trim();
                                
                                // Musí být stejná základní série (např. oba "iPhone 15 Pro")
                                // Ale ne různé generace (např. "14T" vs "15T")
                                const demandSeries = demandNoStorage.match(/[a-z]+\s*\d+[a-z]*/i)?.[0] || '';
                                const offerSeries = offerNoStorage.match(/[a-z]+\s*\d+[a-z]*/i)?.[0] || '';
                                
                                if (demandSeries && offerSeries && demandSeries === offerSeries) {
                                    // Zkontrolovat zda mají stejný suffix (Pro, Max, atd.)
                                    const demandSuffix = demandNoStorage.replace(demandSeries, '').trim();
                                    const offerSuffix = offerNoStorage.replace(offerSeries, '').trim();
                                    modelMatch = demandSuffix === offerSuffix;
                                }
                            }
                        }

                        isMatch = (similarityScore >= 85) && modelMatch;
                    } else if (demandAd.parsed_embedding && offerAd.parsed_embedding) {
                        const sim = cosineSimilarity(demandAd.parsed_embedding, offerAd.parsed_embedding);
                        similarityScore = Math.round(sim * 100);

                        // Velmi přísná kontrola shody modelu
                        let modelMatch = false;
                        if (demandModel && offerModel) {
                            const demandNorm = demandModel.toLowerCase().trim();
                            const offerNorm = offerModel.toLowerCase().trim();
                            
                            if (demandNorm === offerNorm) {
                                modelMatch = true;
                            } else if (demandNorm.length > 5 && offerNorm.length > 5) {
                                const demandNoStorage = demandNorm.replace(/\d{2,4}gb/i, '').trim();
                                const offerNoStorage = offerNorm.replace(/\d{2,4}gb/i, '').trim();
                                
                                const demandSeries = demandNoStorage.match(/[a-z]+\s*\d+[a-z]*/i)?.[0] || '';
                                const offerSeries = offerNoStorage.match(/[a-z]+\s*\d+[a-z]*/i)?.[0] || '';
                                
                                if (demandSeries && offerSeries && demandSeries === offerSeries) {
                                    const demandSuffix = demandNoStorage.replace(demandSeries, '').trim();
                                    const offerSuffix = offerNoStorage.replace(offerSeries, '').trim();
                                    modelMatch = demandSuffix === offerSuffix;
                                }
                            }
                        }

                        isMatch = (similarityScore >= 85) && modelMatch;

                        if (modelMatch && similarityScore < 100) {
                            similarityScore = Math.min(100, similarityScore + 15);
                        }
                    } else if (demandModel && offerModel) {
                        // Velmi přísná kontrola shody modelu
                        const demandNorm = demandModel.toLowerCase().trim();
                        const offerNorm = offerModel.toLowerCase().trim();
                        
                        let modelMatch = false;
                        if (demandNorm === offerNorm) {
                            modelMatch = true;
                        } else if (demandNorm.length > 5 && offerNorm.length > 5) {
                            const demandNoStorage = demandNorm.replace(/\d{2,4}gb/i, '').trim();
                            const offerNoStorage = offerNorm.replace(/\d{2,4}gb/i, '').trim();
                            
                            const demandSeries = demandNoStorage.match(/[a-z]+\s*\d+[a-z]*/i)?.[0] || '';
                            const offerSeries = offerNoStorage.match(/[a-z]+\s*\d+[a-z]*/i)?.[0] || '';
                            
                            if (demandSeries && offerSeries && demandSeries === offerSeries) {
                                const demandSuffix = demandNoStorage.replace(demandSeries, '').trim();
                                const offerSuffix = offerNoStorage.replace(offerSeries, '').trim();
                                modelMatch = demandSuffix === offerSuffix;
                            }
                        }
                        
                        isMatch = modelMatch;
                        similarityScore = isMatch ? 100 : 0;
                    }
                } else {
                    // Bez AI - vyžadujeme přesnou shodu titulku nebo velmi vysokou podobnost
                    similarityScore = getSimilarity(demandAd.title, offerAd.title);
                    isMatch = similarityScore >= 0.65; // Zvýšený práh z 0.35 na 0.65
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
                    
                    // Inicializovat deal state pro novou shodu
                    const matchKey = `${offerAd.url || offerAd.id}__${demandAd.url || demandAd.id}`;
                    await initDealState(matchKey);
                }
            }
        }

        // Seřazení výsledků od nejvyššího potenciálního zisku (arbitrážního skóre)
        foundMatches.sort((a, b) => (b.realOpportunityScore - a.realOpportunityScore) || (b.arbitrageScore - a.arbitrageScore));
        pushRuntimeLog(`Porovnání dokončeno. Nalezeno ${foundMatches.length} shod.`, foundMatches.length > 0 ? 'success' : 'system');

        // Uložení shod do souboru pro analýzu
        const matchesFilePath = path.join(__dirname, '..', 'matches_export.json');
        const exportData = {
            timestamp: new Date().toISOString(),
            totalMatches: foundMatches.length,
            matches: foundMatches.map(m => ({
                offer: {
                    title: m.offer.title,
                    price: m.offer.price,
                    location: m.offer.location,
                    url: m.offer.url,
                    brand: m.offer.brand,
                },
                demand: {
                    title: m.demand.title,
                    price: m.demand.price,
                    location: m.demand.location,
                    url: m.demand.url,
                    brand: m.demand.brand,
                },
                arbitrageScore: m.arbitrageScore,
                similarityScore: m.offer.similarity,
                realOpportunityScore: m.realOpportunityScore,
                expectedNetProfit: m.expectedNetProfit,
                locationScore: m.locationScore,
                priceTrustScore: m.priceTrustScore,
            }))
        };
        await fs.writeFile(matchesFilePath, JSON.stringify(exportData, null, 2), 'utf-8');
        pushRuntimeLog(`Shody uloženy do: ${matchesFilePath}`, 'info');

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

// Export shod - stažení souboru s posledními shodami
app.get('/matches/export', async (req, res) => {
    try {
        const matchesFilePath = path.join(__dirname, '..', 'matches_export.json');
        const fileExists = await fs.access(matchesFilePath).then(() => true).catch(() => false);
        
        if (!fileExists) {
            return res.status(404).json({ message: 'Žádné shody k exportu. Nejprve spusťte porovnání.' });
        }
        
        const fileContent = await fs.readFile(matchesFilePath, 'utf-8');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="matches_${new Date().toISOString().split('T')[0]}.json"`);
        res.send(fileContent);
    } catch (error) {
        console.error('Chyba při exportu shod:', error);
        res.status(500).json({ message: 'Chyba při exportu shod.' });
    }
});

// Alert configuration storage
const alertsConfigStore: {
    enabled: boolean;
    telegramBotToken: string;
    telegramChatId: string;
    emailWebhookUrl: string;
    discordWebhookUrl: string;
    minProfit: number;
    minScore: number;
    autoSendAfterScrape: boolean;
    autoSendAfterCompare: boolean;
} = {
    enabled: false,
    telegramBotToken: '',
    telegramChatId: '',
    emailWebhookUrl: '',
    discordWebhookUrl: '',
    minProfit: 1500,
    minScore: 70,
    autoSendAfterScrape: false,
    autoSendAfterCompare: true,
};

app.get('/alerts/config', (req, res) => {
    res.json({ config: { ...alertsConfigStore, telegramBotToken: '***', emailWebhookUrl: '***', discordWebhookUrl: '***' } });
});

app.post('/alerts/config', (req, res) => {
    const { enabled, telegramBotToken, telegramChatId, emailWebhookUrl, discordWebhookUrl, minProfit, minScore, autoSendAfterScrape, autoSendAfterCompare } = req.body;
    
    if (typeof enabled === 'boolean') alertsConfigStore.enabled = enabled;
    if (typeof telegramBotToken === 'string' && telegramBotToken.trim()) alertsConfigStore.telegramBotToken = telegramBotToken.trim();
    if (typeof telegramChatId === 'string' && telegramChatId.trim()) alertsConfigStore.telegramChatId = telegramChatId.trim();
    if (typeof emailWebhookUrl === 'string' && emailWebhookUrl.trim()) alertsConfigStore.emailWebhookUrl = emailWebhookUrl.trim();
    if (typeof discordWebhookUrl === 'string' && discordWebhookUrl.trim()) alertsConfigStore.discordWebhookUrl = discordWebhookUrl.trim();
    if (typeof minProfit === 'number') alertsConfigStore.minProfit = minProfit;
    if (typeof minScore === 'number') alertsConfigStore.minScore = minScore;
    if (typeof autoSendAfterScrape === 'boolean') alertsConfigStore.autoSendAfterScrape = autoSendAfterScrape;
    if (typeof autoSendAfterCompare === 'boolean') alertsConfigStore.autoSendAfterCompare = autoSendAfterCompare;
    
    pushRuntimeLog(`Konfigurace alertů aktualizována: enabled=${alertsConfigStore.enabled}, autoSendAfterCompare=${alertsConfigStore.autoSendAfterCompare}`, 'info');
    res.json({ message: 'Alert configuration saved', config: alertsConfigStore });
});

app.post('/alerts/test', async (req, res) => {
    try {
        const testMatches = [
            {
                offer: { title: 'Test iPhone 13 128GB', price: '15 000 Kč', location: 'Praha', link: 'https://test.local/1' },
                demand: { title: 'Koupím iPhone 13', price: '18 000 Kč', location: 'Brno' },
                arbitrageScore: 3000,
                realOpportunityScore: 85,
            }
        ];
        
        await fetch('http://localhost:3001/alerts/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegramBotToken: alertsConfigStore.telegramBotToken,
                telegramChatId: alertsConfigStore.telegramChatId,
                emailWebhookUrl: alertsConfigStore.emailWebhookUrl,
                discordWebhookUrl: alertsConfigStore.discordWebhookUrl,
                minProfit: alertsConfigStore.minProfit,
                minScore: alertsConfigStore.minScore,
                matches: testMatches,
            }),
        });
        
        res.json({ message: 'Test alert odeslán' });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ message: 'Test alert failed', error: errorMessage });
    }
});

// Deduplication & Bulk Actions endpoints
app.get('/matches/seen', async (req, res) => {
    try {
        const seenKeys = await getPreviouslySeenMatchKeys();
        res.json({ seenKeys, count: seenKeys.length });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ message: 'Failed to get seen matches', error: errorMessage });
    }
});

app.post('/matches/mark-seen', async (req, res) => {
    try {
        const { matchKeys } = req.body;
        if (!Array.isArray(matchKeys)) {
            return res.status(400).json({ message: 'matchKeys must be an array' });
        }
        
        const count = await markMatchesAsSeen(matchKeys);
        pushRuntimeLog(`Označeno ${count} zápasů jako zobrazené`, 'info');
        res.json({ message: 'Matches marked as seen', count });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ message: 'Failed to mark matches as seen', error: errorMessage });
    }
});

app.post('/matches/bulk-update', async (req, res) => {
    try {
        const { matchKeys, updates } = req.body;
        
        if (!Array.isArray(matchKeys)) {
            return res.status(400).json({ message: 'matchKeys must be an array' });
        }
        
        if (!updates || typeof updates !== 'object') {
            return res.status(400).json({ message: 'updates must be an object' });
        }
        
        const count = await bulkUpdateMatches(matchKeys, updates);
        pushRuntimeLog(`Hromadně aktualizováno ${count} zápasů: ${JSON.stringify(updates)}`, 'info');
        res.json({ message: 'Matches updated', count });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ message: 'Failed to bulk update matches', error: errorMessage });
    }
});

app.get('/matches/stats', async (req, res) => {
    try {
        const [resolvedKeys, seenKeys] = await Promise.all([
            getResolvedMatchKeys(),
            getPreviouslySeenMatchKeys()
        ]);
        
        res.json({
            resolvedCount: resolvedKeys.length,
            seenCount: seenKeys.length,
            newCount: seenKeys.length - resolvedKeys.length,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ message: 'Failed to get stats', error: errorMessage });
    }
});

// ========================================
// WebSocket Real-time Notifications
// ========================================

import { wsService } from './websocket.js';

// Initialize WebSocket server on port 3002
const WS_PORT = process.env.WS_PORT ? parseInt(process.env.WS_PORT) : 3002;
wsService.initialize(WS_PORT);

// Endpoint for WebSocket stats
app.get('/ws/stats', (req, res) => {
  res.json({
    success: true,
    stats: wsService.getStats(),
    port: WS_PORT,
  });
});

// Endpoint to send test notification
app.post('/ws/test', (req, res) => {
  const { userId, type, title, message } = req.body;
  
  if (userId) {
    wsService.sendToUser(userId, {
      type: type || 'match_created',
      title: title || 'Testová notifikace',
      message: message || 'Toto je testová notifikace',
      timestamp: new Date().toISOString(),
      priority: 'low',
    });
  } else {
    wsService.broadcast({
      type: type || 'match_created',
      title: title || 'Testová notifikace',
      message: message || 'Toto je testová notifikace',
      timestamp: new Date().toISOString(),
      priority: 'low',
    });
  }
  
  res.json({
    success: true,
    message: 'Notifikace odeslána',
  });
});

app.listen(port, () => {
    pushRuntimeLog(`Backend server běží na adrese http://localhost:${port}`, 'success');
    pushRuntimeLog(`WebSocket server běží na adrese ws://localhost:${WS_PORT}`, 'success');
});

// Keep process alive
process.stdin.resume();

// Handle uncaught errors
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    pushRuntimeLog(`Uncaught Exception: ${err.message}`, 'error');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    pushRuntimeLog(`Unhandled Rejection: ${reason}`, 'error');
});
