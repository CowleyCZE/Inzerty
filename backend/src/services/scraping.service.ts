/**
 * Scraping Service - Orchestrace scrapingu
 * 
 * Poskytuje hlavní scraping logiku s:
 * - Multi-brand scraping
 * - Nabídky a poptávky
 * - Inkrementální scraping s checkpointy
 * - Deduplikace inzerátů
 * - Ukládání do databáze
 */

import { randomUUID } from 'crypto';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { saveAd, getRecentScrapedUrls, getScrapeCheckpoint, updateScrapeCheckpoint } from '../database.js';
import { pushRuntimeLog } from '../utils/logger.js';

export interface ScrapingOptions {
  stopOnKnownAd: boolean;
  maxAdsPerTypePerBrand: number;
}

export interface ScrapingResult {
  ads: any[];
  savedAdsCount: number;
}

export interface ScrapingSummary {
  nabidkaCount: number;
  poptavkaCount: number;
  savedNabidkaCount: number;
  savedPoptavkaCount: number;
}

/**
 * Hlavní scraping orchestrace pro všechny brandy
 */
export const scrapeAllBrands = async (
  selectors: any,
  options: ScrapingOptions,
  brands: string[] = DEFAULT_BRANDS
): Promise<{
  message: string;
  data: ScrapingSummary;
}> => {
  const effectiveOptions = {
    stopOnKnownAd: options.stopOnKnownAd !== false,
    maxAdsPerTypePerBrand: Math.max(1, Math.min(500, Number(options.maxAdsPerTypePerBrand || 50))),
  };

  pushRuntimeLog(
    `Nastavení scrapování: stopOnKnownAd=${effectiveOptions.stopOnKnownAd}, maxAdsPerTypePerBrand=${effectiveOptions.maxAdsPerTypePerBrand}`,
    'system'
  );

  let totalOffers = 0;
  let totalDemands = 0;
  let totalSavedOffers = 0;
  let totalSavedDemands = 0;

  for (const brand of brands) {
    pushRuntimeLog(`Scrapuji inzeráty pro ${brand}`, 'system');
    const brandUrlSegment = getBrandSegment(brand);

    // 1. Scrapování nabídek
    pushRuntimeLog(`  Scrapuji nabídky pro ${brand}`, 'info');
    const offerUrl = getBazosBrandUrls(brand, brandUrlSegment, 'nabidka')[0] || 
                     `https://mobil.bazos.cz/${brandUrlSegment}/`;
    const offerResult = await scrapeUrl(offerUrl, brand, 'nabidka', selectors, effectiveOptions);

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
        ...effectiveOptions,
        stopOnKnownAd: false,
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

    // Pro poptávky musíme detekovat typ
    const actualDemands = demandAds.filter(ad => ad.ad_type === 'poptavka');
    const accidentalOffers = demandAds.filter(ad => ad.ad_type === 'nabidka');

    if (accidentalOffers.length > 0) {
      pushRuntimeLog(`    Vyřazeno ${accidentalOffers.length} nabídek z výsledků poptávek (špatný typ)`, 'info');
    }

    totalDemands += actualDemands.length;
    totalSavedDemands += demandSavedCount;

    pushRuntimeLog(
      `  Výsledek pro ${brand}: Nabídky=${offerResult.ads.length} (uloženo: ${offerResult.savedAdsCount}), ` +
      `Poptávky=${actualDemands.length} (uloženo: ${demandSavedCount})`,
      'success'
    );
  }

  const totalSaved = totalSavedOffers + totalSavedDemands;
  const message = totalDemands === 0
    ? `Scrapování dokončeno! Načteno ${totalOffers} nabídek. Žádné poptávky nenalezeny - zkuste jiná klíčová slova.`
    : `Scrapování dokončeno! Načteno ${totalOffers} nabídek a ${totalDemands} poptávek; do DB uloženo ${totalSaved} inzerátů.`;

  return {
    message,
    data: {
      nabidkaCount: totalOffers,
      poptavkaCount: totalDemands,
      savedNabidkaCount: totalSavedOffers,
      savedPoptavkaCount: totalSavedDemands,
    },
  };
};

/**
 * Scrapuje jednu stránku s inzeráty
 */
export const scrapeUrl = async (
  url: string,
  brand: string,
  adType: string,
  selectors: any,
  options?: ScrapingOptions
): Promise<ScrapingResult> => {
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

  // Mock mode pro testování
  if (process.env.MOCK_SCRAPE === '1') {
    for (let i = 0; i < Math.min(maxAdsPerTypePerBrand, 3); i++) {
      const mockUrl = `https://mock.local/${adType}/${brand.toLowerCase()}/${i + 1}`;
      const ad = {
        id: mockUrl,  // Použít URL jako ID
        title: `${brand} test ${adType} ${i + 1}`,
        price: `${2000 + (i * 100)} Kč`,
        link: mockUrl,
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

        const finalAdType = adType === 'nabidka' ? 'nabidka' : detectAdType(adTitle, adDescription);

        // Extrakce skutečné značky z titulku (důležité pro kategorii "Ostatní")
        const extractedBrand = extractBrandFromTitle(adTitle);

        // Použít URL jako ID pro konzistenci s databází
        const adId = fullLink || randomUUID();

        const ad = {
          id: adId,
          title: adTitle,
          price: $(element).find(selectors.price).text().trim(),
          link: fullLink,
          date_posted: adDateStr,
          posted_at: adDate ? adDate.toISOString() : undefined, // ISO formát pro Postgres TIMESTAMPTZ
          brand: extractedBrand,  // Použít extrahovanou značku
          ad_type: finalAdType,
          scraped_at: new Date().toISOString(),
          description: adDescription,
          location: $(element).find(selectors.location).text().trim(),
          image_url: $(element).find(selectors.image).attr('src') || '', // Přidáno pro úplnost
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

  // Update checkpointu
  if (latestSeenUrl || latestSeenDate) {
    await updateScrapeCheckpoint(brand, adType, latestSeenUrl, latestSeenDate);
  }

  pushRuntimeLog(`Úspěšně načteno ${scrapedAds.length} inzerátů (${savedAdsCount} nových v DB).`, 'success');
  return { ads: scrapedAds, savedAdsCount };
};

// ========================================
// Helper funkce
// ========================================

const DEFAULT_BRANDS = [
  // Značky které mají vlastní kategorii na Bazos.cz
  'Apple',
  'Samsung',
  'Google',
  'Huawei',
  'Motorola',
  'Nokia',
  'Realme',
  'Sony',
  'Xiaomi',
  'Ostatní',  // Všechny ostatní značky (OnePlus, Honor, Oppo, atd.)
];

const getBrandSegment = (brand: string): string => {
  let segment = brand.toLowerCase().replace(/ /g, '-');
  
  // Speciální případy pro Bazos.cz URL segmenty
  if (brand === 'Sony') {
    segment = 'ericsson';  // Sony Ericsson sekce
  } else if (brand === 'Ostatní') {
    segment = 'mobily';  // Všechny ostatní značky
  }
  
  return segment;
};

const getBazosBrandUrls = (
  brand: string,
  brandSegment: string,
  adType: 'nabidka' | 'poptavka'
): string[] => {
  if (adType === 'nabidka') {
    // Nabídky - scrapování všech stránek s inzeráty
    const urls: string[] = [];
    
    // První stránka
    urls.push(`https://mobil.bazos.cz/${brandSegment}/`);
    
    // Další stránky (20, 40, 60, 80, 100 - celkem 5 stran = 100 inzerátů max na stránce)
    for (let page = 20; page <= 100; page += 20) {
      urls.push(`https://mobil.bazos.cz/${brandSegment}/${page}/`);
    }
    
    return urls;
  }

  // Poptávky - používáme vyhledávání s klíčovými slovy pro koupě
  // Používáme slova BEZ diakritiky pro lepší výsledky hledání
  const demandKeywords = ['koupim', 'shanim', 'hledam'];
  const urls: string[] = [];

  for (const keyword of demandKeywords) {
    // Pouze první stránka výsledků - poptávky jsou obvykle všechny na jedné stránce
    urls.push(
      `https://mobil.bazos.cz/${brandSegment}/?hledat=${encodeURIComponent(keyword)}&rubriky=mobil&hlokalita=&humkreis=25&cenaod=&cenado=&Submit=Hledat&order=&crp=&kitx=ano`
    );
  }

  return urls;
};

const detectAdType = (title: string, description: string): 'nabidka' | 'poptavka' => {
  // Normalizovat text - odstranit diakritiku pro lepší porovnávání
  const text = (title + ' ' + description).toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Klíčová slova pro poptávky (koupě) - bez diakritiky
  const demandKeywords = [
    'koupim', 'hledam', 'shanim',
    'chci koupit', 'chci kupit', 'poptavam',
    'zajem o koupi', 'mate na prodej', 'hledam ke koupi',
  ];

  // Klíčová slova pro nabídky (prodej) - bez diakritiky
  const offerKeywords = [
    'prodam', 'nabizim', 'na prodej',
    'prodavam', 'k dispozici', 'skladem',
    'ihned k odberu', 'ihned k prevzeti',
  ];

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

/**
 * Extrakce značky z titulku inzerátu
 * Používá se pro inzeráty z kategorie "Ostatní" (mobily)
 */
export const extractBrandFromTitle = (title: string): string => {
  const normalizedTitle = title.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Seznam značek k detekci (včetně těch které nemají vlastní kategorii)
  const brandPatterns = [
    { pattern: /\boppo\b/i, brand: 'Oppo' },
    { pattern: /\boneplus\b/i, brand: 'OnePlus' },
    { pattern: /\bhonor\b/i, brand: 'Honor' },
    { pattern: /\bnothing\b/i, brand: 'Nothing' },
    { pattern: /\bfairphone\b/i, brand: 'Fairphone' },
    { pattern: /\basus\b/i, brand: 'Asus' },
    { pattern: /\bblackview\b/i, brand: 'Blackview' },
    { pattern: /\bulefone\b/i, brand: 'Ulefone' },
    { pattern: /\bdoogee\b/i, brand: 'Doogee' },
    { pattern: /\brealme\b/i, brand: 'Realme' },
    { pattern: /\bxiaomi\b/i, brand: 'Xiaomi' },
    { pattern: /\bhuawei\b/i, brand: 'Huawei' },
    { pattern: /\bsamsung\b/i, brand: 'Samsung' },
    { pattern: /\bapple\b|\biphone\b/i, brand: 'Apple' },
    { pattern: /\bgoogle\b|\bpixel\b/i, brand: 'Google' },
    { pattern: /\bmotorola\b|\bmoto\b/i, brand: 'Motorola' },
    { pattern: /\bnokia\b/i, brand: 'Nokia' },
    { pattern: /\bsony\b|\bxperia\b/i, brand: 'Sony' },
  ];

  for (const { pattern, brand } of brandPatterns) {
    if (pattern.test(normalizedTitle)) {
      return brand;
    }
  }

  return 'Ostatní';  // Neznámá značka
};

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;

  const now = new Date();
  const str = dateStr.toLowerCase().trim();

  if (str.includes('dnes') || str.includes('today')) {
    return now;
  }

  if (str.includes('včera') || str.includes('yesterday')) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }

  // Pro formát Bazos: "[25.1. 2026]" nebo "- [25.1. 2026]" nebo "25.1. 2026"
  const dateMatch = str.match(/(\d+)\.(\d+)\.\s*(\d{4})/);
  if (dateMatch?.[1] && dateMatch?.[2] && dateMatch?.[3]) {
    const day = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10) - 1; // 0-indexed month
    const year = parseInt(dateMatch[3], 10);
    
    // Nastavit čas na půlnoc, abychom se vyhnuli problémům s časovými pásmy během dne
    return new Date(year, month, day, 12, 0, 0);
  }

  if (str.includes('před')) {
    const match = str.match(/před\s+(\d+)\s*(dny|dnem|dny|týdny|týdnem|hodinami|hodinou)/);
    if (match?.[1] && match?.[2]) {
      const value = parseInt(match[1], 10);
      const unit = match[2];
      
      if (unit.includes('hodin')) {
        const date = new Date(now);
        date.setHours(date.getHours() - value);
        return date;
      }
      
      if (unit.includes('týdn')) {
        const date = new Date(now);
        date.setDate(date.getDate() - value * 7);
        return date;
      }
      
      if (unit.includes('dn')) {
        const date = new Date(now);
        date.setDate(date.getDate() - value);
        return date;
      }
    }
  }

  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
};

const fetchPageWithRetry = async (
  url: string,
  retries: number = 3,
  backoffMs: number = 1000
): Promise<any> => {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  ];

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const ua = userAgents[Math.floor(Math.random() * userAgents.length)]!;
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.8',
        },
      });
      return response;
    } catch (error: any) {
      if (error.response?.status === 429) {
        const retryAfter = parseInt(error.response.headers['retry-after']) || (backoffMs * attempt * 2);
        pushRuntimeLog(`Rate limit (429), čekám ${retryAfter}ms...`, 'system');
        await new Promise(resolve => setTimeout(resolve, retryAfter));
        continue;
      }

      if (error.response?.status >= 500) {
        const waitTime = backoffMs * Math.pow(2, attempt - 1);
        pushRuntimeLog(`Server error (${error.response.status}), retry za ${waitTime}ms...`, 'system');
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw new Error(`Failed to fetch ${url} after ${retries} attempts`);
};
