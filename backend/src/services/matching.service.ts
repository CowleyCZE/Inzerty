/**
 * Matching Service - Porovnávání inzerátů a arbitráž
 * 
 * Poskytuje matching logiku s:
 * - AI embedding matching (PostgreSQL pgvector)
 * - Keyword-based matching
 * - Cosine similarity výpočty
 * - Opportunity score výpočty
 * - Filtrace podle blacklist/whitelist
 */

import {
  getAllAdsByType,
  saveMatch,
  saveMatchMeta,
  initDealState,
  getResolvedMatchKeys,
  updateAdModelAi,
  updateAdEmbedding,
  usingPostgres,
  isPgVectorAvailable,
  getPgVectorSimilarities,
} from '../database.js';
import { pushRuntimeLog } from '../utils/logger.js';
import { ollamaManager, getAICacheKey, getCachedAIResponse, setCachedAIResponse } from '../utils/index.js';
import axios from 'axios';

export interface MatchResult {
  offer: any;
  demand: any;
  arbitrageScore: number;
  opportunityScore: number;
  realOpportunityScore: number;
  expectedNetProfit: number;
  locationScore: number;
  priceTrustScore: number;
  similarityScore: number;
}

export interface MatchingOptions {
  comparisonMethod?: 'auto' | 'ollama' | 'local-keyword';
  filterRules?: {
    blacklistTerms?: string[];
    whitelistModels?: string[];
    minPrice?: number | null;
    maxPrice?: number | null;
    minStorageGb?: number | null;
  };
  hideResolved?: boolean;
}

export interface MatchingSummary {
  totalMatches: number;
  message: string;
  useAI: boolean;
}

let isMatchingActive = false;

/**
 * Hlavní matching orchestrace
 */
export const findMatches = async (
  options: MatchingOptions = {}
): Promise<{
  message: string;
  data: MatchResult[];
  summary: MatchingSummary;
}> => {
  if (isMatchingActive) {
    throw new Error('Porovnávání již probíhá. Prosím počkejte na dokončení.');
  }

  try {
    isMatchingActive = true;
    const foundMatches: MatchResult[] = [];
    pushRuntimeLog('Porovnávání spuštěno.', 'system');
    const seenMatches = new Set<string>();

    const comparisonMethod = options.comparisonMethod || 'auto';
    const filterRules = options.filterRules || {};
    const hideResolved = options.hideResolved !== false;
    const resolvedMatchKeys = hideResolved ? new Set(await getResolvedMatchKeys()) : new Set<string>();

    // Zjistit zda použít AI
    let useAI = false;
    if (comparisonMethod === 'ollama') {
      useAI = await ollamaManager.checkStatus();
    } else if (comparisonMethod === 'auto') {
      useAI = await ollamaManager.checkStatus();
    }

    const allOffers = await getAllAdsByType('nabidka');
    const allDemands = await getAllAdsByType('poptavka');

    pushRuntimeLog(
      `Načtená data pro porovnání: nabídky=${allOffers.length}, poptávky=${allDemands.length}`,
      'system'
    );

    if (allOffers.length === 0 || allDemands.length === 0) {
      return {
        message: 'Porovnání dokončeno! V databázi není dostatek dat pro porovnání.',
        data: [],
        summary: {
          totalMatches: 0,
          message: 'Nedostatek dat',
          useAI: false,
        },
      };
    }

    // Obohatit data o AI embeddingy
    const enrichedOffers = useAI
      ? await enrichWithAI(allOffers)
      : allOffers;
    const enrichedDemands = useAI
      ? await enrichWithAI(allDemands)
      : allDemands;

    const useDatabaseVectorSearch = useAI && usingPostgres() && isPgVectorAvailable();

    // Porovnání
    let processedDemands = 0;
    for (const demandAd of enrichedDemands) {
      processedDemands += 1;
      if (processedDemands % 50 === 0) {
        pushRuntimeLog(
          `Průběh porovnání: zpracováno ${processedDemands}/${enrichedDemands.length} poptávek, shod=${foundMatches.length}`,
          'system'
        );
      }

      const demandPrice = parsePrice(demandAd.price);
      if (demandPrice === null) continue;

      const demandModel = useAI ? demandAd.model_ai || '' : '';
      const demandStorage = extractStorage(demandAd.title + ' ' + demandAd.description) || 
                            extractStorage(demandModel);

      // Ignorovat poptávky bez specifikovaného modelu
      if (!demandModel || demandModel.length < 3) continue;

      // Ignorovat obecné poptávky
      if (['koupím', 'hledám', 'sháním'].includes(demandAd.title.toLowerCase().trim())) continue;

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

        // Cenová logika
        if (demandPrice <= offerPrice) continue;
        if (demandPrice > offerPrice * 1.6) continue;

        // Blacklist kontrola
        const fullText = `${demandAd.title} ${demandAd.description} ${offerAd.title} ${offerAd.description}`.toLowerCase();
        const blacklistTerms: string[] = Array.isArray(filterRules.blacklistTerms) ? filterRules.blacklistTerms : [];
        if (blacklistTerms.some(term => term && fullText.includes(String(term).toLowerCase()))) continue;

        // Whitelist kontrola
        const whitelistModels: string[] = Array.isArray(filterRules.whitelistModels) ? filterRules.whitelistModels : [];
        if (whitelistModels.length > 0) {
          const modelText = `${demandAd.title} ${offerAd.title}`.toLowerCase();
          if (!whitelistModels.some(m => modelText.includes(String(m).toLowerCase()))) continue;
        }

        // Cenové filtry
        const minPrice = typeof filterRules.minPrice === 'number' ? filterRules.minPrice : null;
        const maxPrice = typeof filterRules.maxPrice === 'number' ? filterRules.maxPrice : null;
        if (minPrice !== null && offerPrice < minPrice) continue;
        if (maxPrice !== null && offerPrice > maxPrice) continue;

        // Úložiště
        const offerStorage = extractStorage(offerAd.title + ' ' + offerAd.description) || 
                            extractStorage(offerAd.model_ai || '');
        if (demandStorage && offerStorage && demandStorage !== offerStorage) continue;

        // Tablet vs telefon kontrola
        const offerModel = useAI ? offerAd.model_ai || '' : '';
        const demandIsTablet = demandModel.toLowerCase().includes('ipad') || demandModel.toLowerCase().includes('tablet');
        const offerIsTablet = offerModel.toLowerCase().includes('ipad') || offerModel.toLowerCase().includes('tablet');
        if (demandIsTablet !== offerIsTablet) continue;

        // Matching logika
        let isMatch = false;
        let similarityScore = 0;

        // Title cross-check: reject if titles clearly reference different phone models
        const titleMatch = titleContainsSamePhone(demandAd.title, offerAd.title);
        if (!titleMatch) continue;

        if (useAI) {
          const dbSimilarity = pgSimilarityMap.get(offerAd.id);

          if (typeof dbSimilarity === 'number') {
            similarityScore = dbSimilarity;
            const modelMatch = checkModelMatch(demandModel, offerModel);
            isMatch = similarityScore >= 85 && modelMatch;
          } else if (demandAd.parsed_embedding && offerAd.parsed_embedding) {
            const sim = cosineSimilarity(demandAd.parsed_embedding, offerAd.parsed_embedding);
            similarityScore = Math.round(sim * 100);
            const modelMatch = checkModelMatch(demandModel, offerModel);
            isMatch = similarityScore >= 85 && modelMatch;

            if (modelMatch && similarityScore < 100) {
              similarityScore = Math.min(100, similarityScore + 15);
            }
          } else {
            const modelMatch = checkModelMatch(demandModel, offerModel);
            isMatch = modelMatch;
            similarityScore = isMatch ? 100 : 0;
          }
        } else {
          // Bez AI - keyword matching
          similarityScore = getSimilarity(demandAd.title, offerAd.title);
          isMatch = similarityScore >= 0.65;
          similarityScore = Math.round(similarityScore * 100);
        }

        if (isMatch) {
          const dedupKey = `${offerAd.url || offerAd.id}__${demandAd.url || demandAd.id}`;
          if (seenMatches.has(dedupKey)) continue;
          seenMatches.add(dedupKey);

          const arbitrageScore = demandPrice - offerPrice;
          const opportunityScore = computeOpportunityScore(
            arbitrageScore,
            similarityScore,
            demandAd.date_posted || '',
            offerAd.date_posted || ''
          );
          const locScore = locationSimilarity(demandAd.location || '', offerAd.location || '');
          const baseline = median(offerPricesByBrand[demandAd.brand] || []);
          const trustScore = priceTrustScore(offerPrice, baseline);
          const realOpportunityScore = computeRealOpportunityScore(
            arbitrageScore,
            demandPrice,
            offerPrice,
            similarityScore,
            demandAd.date_posted || '',
            offerAd.date_posted || '',
            locScore,
            trustScore
          );

          if (resolvedMatchKeys.has(dedupKey)) continue;

          const matchObj: MatchResult = {
            offer: { ...offerAd, similarity: similarityScore, ai: useAI },
            demand: demandAd,
            arbitrageScore,
            opportunityScore,
            realOpportunityScore,
            expectedNetProfit: Math.max(0, Math.round(arbitrageScore - 400)),
            locationScore: locScore,
            priceTrustScore: trustScore,
            similarityScore,
          };

          foundMatches.push(matchObj);
          await saveMatch(offerAd.id, demandAd.id, similarityScore, useAI);

          // Inicializovat match_meta (FK pro deal_states)
          await saveMatchMeta({ matchKey: dedupKey });
          // Inicializovat deal state
          await initDealState(dedupKey);
        }
      }
    }

    // Seřazení výsledků
    foundMatches.sort(
      (a, b) => (b.realOpportunityScore - a.realOpportunityScore) || (b.arbitrageScore - a.arbitrageScore)
    );

    pushRuntimeLog(
      `Porovnání dokončeno. Nalezeno ${foundMatches.length} shod.`,
      foundMatches.length > 0 ? 'success' : 'system'
    );

    return {
      message: `Porovnání dokončeno! Nalezeno ${foundMatches.length} shod. ${useAI ? '(AI embeddingy)' : '(Klíčová slova)'}`,
      data: foundMatches,
      summary: {
        totalMatches: foundMatches.length,
        message: useAI ? 'AI embedding matching' : 'Keyword matching',
        useAI,
      },
    };
  } finally {
    isMatchingActive = false;
  }
};

// ========================================
// Helper funkce pro AI enrichment
// ========================================

const enrichWithAI = async (ads: any[]): Promise<any[]> => {
  const enriched: any[] = [];
  const needingModel = ads.filter(a => !a.model_ai).length;
  const needingEmbedding = ads.filter(a => !a.embedding).length;
  
  pushRuntimeLog(`Zpracovávám ${ads.length} inzerátů pomocí AI (z toho ${needingModel} nových modelů a ${needingEmbedding} embeddingů)...`, 'system');
  
  let processed = 0;
  for (const ad of ads) {
    processed++;
    if (!ad.model_ai || !ad.embedding) {
      if (processed % 5 === 0 || processed === 1) {
         pushRuntimeLog(`Postup AI zpracování: ${processed}/${ads.length} inzerátů (probíhá Ollama)...`, 'system');
      }
    } else if (processed % 50 === 0) {
      pushRuntimeLog(`Skenováno: ${processed}/${ads.length} inzerátů (zpracováno v DB)...`, 'system');
    }

    const model = ad.model_ai || await extractModelWithAI(ad.title, ad.description);
    if (model && !ad.model_ai) {
      await updateAdModelAi(ad.id, model);
    }

    let embeddingData = ad.embedding ? JSON.parse(ad.embedding) : null;
    if (!embeddingData) {
      embeddingData = await getEmbeddingFromOllama(`${ad.title} ${ad.description}`);
      if (embeddingData) {
        await updateAdEmbedding(ad.id, JSON.stringify(embeddingData));
      }
    }
    enriched.push({ ...ad, model_ai: model, parsed_embedding: embeddingData });
  }

  return enriched;
};

const extractModelWithAI = async (title: string, description: string): Promise<string> => {
  const ollamaModel = ollamaManager.getModel();
  
  if (isEmbeddingOnlyModel(ollamaModel)) {
    return extractModelHeuristic(title, description);
  }

  try {
    const prompt = `Extract only the specific mobile phone model name and its storage capacity (in GB) from this ad.
Format: "Model Name GB". Exclude brand.
If it's an iPhone, include the number and Pro/Max/Plus.
Title: "${title}"
Description: "${description.substring(0, 100)}"
Model:`;

    const cacheKey = getAICacheKey(prompt, ollamaModel);
    const cached = getCachedAIResponse(cacheKey);
    if (cached) return cached;

    const response = await axios.post(
      ollamaManager.createUrl('/api/generate'),
      {
        model: ollamaModel,
        prompt: prompt,
        stream: false,
        options: {
          num_ctx: 2048,
          temperature: 0.1,
        },
      },
      { timeout: 90000 }
    );

    const result = response.data.response.trim();
    setCachedAIResponse(cacheKey, result);
    return result;
  } catch (error: any) {
    const details = String(error.response?.data?.error || '').toLowerCase();
    if (details.includes('does not support generate')) {
      return extractModelHeuristic(title, description);
    }
    console.error('AI Extraction failed:', error.message);
    return extractModelHeuristic(title, description);
  }
};

const extractModelHeuristic = (title: string, description: string): string => {
  const text = `${title} ${description}`.toLowerCase();
  
  // iPhone pattern
  const iphoneMatch = text.match(/iphone\s*(\d+)\s*(pro|max|plus)?\s*(\d{2,3})?gb/i);
  if (iphoneMatch) {
    return `iPhone ${iphoneMatch[1]}${iphoneMatch[2] ? ' ' + iphoneMatch[2] : ''}${iphoneMatch[3] ? ' ' + iphoneMatch[3] + 'GB' : ''}`.trim();
  }

  // Samsung pattern
  const samsungMatch = text.match(/galaxy\s*(s|a|z|note)\s*(\d+[a-z]?)\s*(\d{2,3})?gb/i);
  if (samsungMatch) {
    return `Galaxy ${samsungMatch[1]}${samsungMatch[2]}${samsungMatch[3] ? ' ' + samsungMatch[3] + 'GB' : ''}`.trim();
  }

  // Generic pattern
  const genericMatch = text.match(/([a-z]+\s*\d+[a-z]?(?:\s*pro|\s*max|\s*plus)?)(?:\s+(\d{2,3})gb)?/i);
  if (genericMatch) {
    return `${genericMatch[1]}${genericMatch[2] ? ' ' + genericMatch[2] + 'GB' : ''}`.trim();
  }

  return title.substring(0, 50);
};

const getEmbeddingFromOllama = async (text: string): Promise<number[] | null> => {
  try {
    const ollamaModel = ollamaManager.getModel();
    const cacheKey = getAICacheKey(`embedding:${text}`, ollamaModel);
    const cached = getCachedAIResponse(cacheKey);
    if (cached) return cached;

    const response = await axios.post(
      ollamaManager.createUrl('/api/embeddings'),
      {
        model: ollamaModel,
        prompt: text,
        options: {
          num_ctx: 2048,
        },
      },
      { timeout: 120000 }
    );

    const embedding = response.data.embedding || null;
    if (embedding) {
      setCachedAIResponse(cacheKey, embedding);
    }
    return embedding;
  } catch (error) {
    console.error('Embedding failed:', error);
    return null;
  }
};

const isEmbeddingOnlyModel = (model: string): boolean => {
  const embeddingOnlyModels = ['all-minilm', 'mxbai-embed', 'nomic-embed', 'bge-m3', 'bge-large'];
  return embeddingOnlyModels.some(m => model.toLowerCase().includes(m));
};

// ========================================
// Scoring funkce
// ========================================

const computeOpportunityScore = (
  arbitrageScore: number,
  similarityScore: number,
  demandDate: string,
  offerDate: string
): number => {
  const profitComponent = Math.min(100, (arbitrageScore - 400) / 70);
  const similarityComponent = similarityScore;
  const freshnessComponent = computeFreshnessScore(demandDate, offerDate);
  
  return Math.round(
    profitComponent * 0.4 +
    similarityComponent * 0.35 +
    freshnessComponent * 0.25
  );
};

const computeRealOpportunityScore = (
  arbitrageScore: number,
  demandPrice: number,
  offerPrice: number,
  similarityScore: number,
  demandDate: string,
  offerDate: string,
  locationScore: number,
  priceTrustScore: number
): number => {
  const netProfit = Math.max(0, arbitrageScore - 400);
  const profitComponent = Math.min(100, (netProfit - 400) / 70);
  const marginComponent = Math.min(100, ((demandPrice - offerPrice) / demandPrice) * 100);
  const freshnessComponent = computeFreshnessScore(demandDate, offerDate);

  return Math.round(
    profitComponent * 0.28 +
    similarityScore * 0.23 +
    marginComponent * 0.16 +
    freshnessComponent * 0.13 +
    locationScore * 0.10 +
    priceTrustScore * 0.10
  );
};

const computeFreshnessScore = (demandDate: string, offerDate: string): number => {
  const now = new Date();
  const demandParsed = parseDate(demandDate) || now;
  const offerParsed = parseDate(offerDate) || now;

  const demandAge = (now.getTime() - demandParsed.getTime()) / (1000 * 60 * 60 * 24);
  const offerAge = (now.getTime() - offerParsed.getTime()) / (1000 * 60 * 60 * 24);

  const demandFreshness = Math.max(0, 100 - demandAge * 10);
  const offerFreshness = Math.max(0, 100 - offerAge * 10);

  return Math.round((demandFreshness + offerFreshness) / 2);
};

const checkModelMatch = (demandModel: string, offerModel: string): boolean => {
  const demandNorm = demandModel.toLowerCase().trim();
  const offerNorm = offerModel.toLowerCase().trim();

  if (!demandNorm || !offerNorm) return false;
  if (demandNorm.length < 3 || offerNorm.length < 3) return false;

  // Exact match (ignoring storage)
  const stripStorage = (s: string) => s.replace(/\d{2,4}\s*gb/gi, '').replace(/\d+\s*tb/gi, '').trim();
  const demandBase = stripStorage(demandNorm);
  const offerBase = stripStorage(offerNorm);

  if (demandBase === offerBase) return true;

  // iPhone specific matching — must match generation number AND suffix (Pro/Max/Plus)
  const iphonePattern = /iphone\s*(\d+)\s*(pro\s*max|pro|plus|mini)?/i;
  const demandIphone = demandNorm.match(iphonePattern);
  const offerIphone = offerNorm.match(iphonePattern);
  if (demandIphone && offerIphone) {
    const demandGen = demandIphone[1];
    const offerGen = offerIphone[1];
    const demandSuffix = (demandIphone[2] || '').replace(/\s+/g, ' ').trim();
    const offerSuffix = (offerIphone[2] || '').replace(/\s+/g, ' ').trim();
    // Generation MUST match exactly (16 ≠ 17)
    if (demandGen !== offerGen) return false;
    // Suffix MUST match (Pro ≠ Pro Max)
    if (demandSuffix !== offerSuffix) return false;
    return true;
  }
  // One is iPhone and other is not → no match
  if (demandIphone || offerIphone) return false;

  // Samsung Galaxy specific matching
  const galaxyPattern = /galaxy\s*(s|a|z|note|fold|flip)\s*(\d+)\s*(\+|plus|ultra|fe)?/i;
  const demandGalaxy = demandNorm.match(galaxyPattern);
  const offerGalaxy = offerNorm.match(galaxyPattern);
  if (demandGalaxy && offerGalaxy) {
    if (demandGalaxy[1]!.toLowerCase() !== offerGalaxy[1]!.toLowerCase()) return false;
    if (demandGalaxy[2] !== offerGalaxy[2]) return false;
    const demandSuffix = (demandGalaxy[3] || '').toLowerCase().replace('plus', '+');
    const offerSuffix = (offerGalaxy[3] || '').toLowerCase().replace('plus', '+');
    if (demandSuffix !== offerSuffix) return false;
    return true;
  }
  if (demandGalaxy || offerGalaxy) return false;

  // Generic model matching — extract brand+number pattern and compare strictly
  const genericPattern = /([a-z]+)\s*(\d+)\s*([a-z]*)/i;
  const demandGeneric = demandBase.match(genericPattern);
  const offerGeneric = offerBase.match(genericPattern);
  if (demandGeneric && offerGeneric) {
    // Name must match
    if (demandGeneric[1]!.toLowerCase() !== offerGeneric[1]!.toLowerCase()) return false;
    // Number must match
    if (demandGeneric[2] !== offerGeneric[2]) return false;
    // Suffix must match
    if ((demandGeneric[3] || '').toLowerCase() !== (offerGeneric[3] || '').toLowerCase()) return false;
    return true;
  }

  return false;
};

/**
 * Extract phone identity from ad title for cross-checking
 */
const titleContainsSamePhone = (demandTitle: string, offerTitle: string): boolean => {
  const normalize = (t: string) => t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const dt = normalize(demandTitle);
  const ot = normalize(offerTitle);

  // iPhone: extract generation + suffix
  const iphoneRe = /iphone\s*(\d+)\s*(pro\s*max|pro|plus|mini)?/i;
  const dm = dt.match(iphoneRe);
  const om = ot.match(iphoneRe);
  if (dm && om) {
    if (dm[1] !== om[1]) return false;
    const ds = (dm[2] || '').replace(/\s+/g, ' ').trim();
    const os = (om[2] || '').replace(/\s+/g, ' ').trim();
    return ds === os;
  }
  if (dm || om) return false; // one mentions iPhone, other doesn't

  // Galaxy
  const galaxyRe = /galaxy\s*(s|a|z|note|fold|flip)\s*(\d+)\s*(\+|plus|ultra|fe)?/i;
  const dg = dt.match(galaxyRe);
  const og = ot.match(galaxyRe);
  if (dg && og) {
    if (dg[1]!.toLowerCase() !== og[1]!.toLowerCase()) return false;
    if (dg[2] !== og[2]) return false;
    const dSuf = (dg[3] || '').toLowerCase().replace('plus', '+');
    const oSuf = (og[3] || '').toLowerCase().replace('plus', '+');
    return dSuf === oSuf;
  }
  if (dg || og) return false;

  return true; // For non-iPhone/Galaxy, defer to embedding/model check
};

// ========================================
// Utility funkce
// ========================================

const parsePrice = (priceStr: string): number | null => {
  if (!priceStr) return null;
  const cleaned = priceStr.replace(/[^0-9,-]+/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
};

const extractStorage = (text: string): number | null => {
  const match = text.match(/(\d{2,4})\s*gb/i);
  return match?.[1] ? parseInt(match[1], 10) : null;
};

const cosineSimilarity = (a: number[], b: number[]): number => {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    dotProduct += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
};

const getSimilarity = (s1: string, s2: string): number => {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1.0;
  
  const costs = new Array(shorter.length + 1);
  for (let i = 0; i <= shorter.length; i++) costs[i] = i;
  
  for (let i = 1; i <= longer.length; i++) {
    let prev = costs[0];
    costs[0] = i;
    for (let j = 1; j <= shorter.length; j++) {
      const temp = costs[j];
      if (longer.charAt(i - 1) === shorter.charAt(j - 1)) {
        costs[j] = prev;
      } else {
        costs[j] = Math.min(Math.min(costs[j - 1], prev), costs[j]) + 1;
      }
      prev = temp;
    }
  }
  
  const distance = costs[shorter.length];
  return 1.0 - (distance / longer.length);
};

const locationSimilarity = (loc1: string, loc2: string): number => {
  const a = loc1.toLowerCase().trim();
  const b = loc2.toLowerCase().trim();
  if (!a || !b) return 55;
  if (a === b) return 100;
  
  const tokenA = new Set(a.split(/[\s,.-]+/).filter(Boolean));
  const tokenB = new Set(b.split(/[\s,.-]+/).filter(Boolean));
  let inter = 0;
  tokenA.forEach(t => { if (tokenB.has(t)) inter += 1; });
  const denom = Math.max(1, Math.max(tokenA.size, tokenB.size));
  return Math.round(Math.max(35, Math.min(100, (inter / denom) * 100)));
};

const median = (nums: number[]): number => {
  const filtered = nums.filter(n => n != null && !isNaN(n));
  if (!filtered.length) return 0;
  const arr = [...filtered].sort((a, b) => a - b);
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid]! : ((arr[mid - 1] ?? 0) + (arr[mid] ?? 0)) / 2;
};

const priceTrustScore = (price: number, baseline: number): number => {
  if (!baseline || baseline <= 0) return 60;
  const deviation = Math.abs(price - baseline) / baseline;
  if (deviation < 0.1) return 100;
  if (deviation < 0.2) return 80;
  if (deviation < 0.3) return 60;
  if (deviation < 0.5) return 40;
  return 20;
};

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const now = new Date();
  const str = dateStr.toLowerCase().trim();

  if (str.includes('dnes') || str.includes('today')) return now;
  if (str.includes('včera') || str.includes('yesterday')) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }

  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
};

// Cache pro ceny podle brandu
const offerPricesByBrand: Record<string, number[]> = {};
