/**
 * BaseScraper - Abstraktní základní třída pro všechny scrapery
 * 
 * Poskytuje společnou funkcionalitu:
 * - HTTP requesty s rotací User-Agent
 * - Rate limiting s jitter
 * - Retry logika s exponenciálním backoff
 * - Anti-detection mechanismy
 * - Logging
 */

import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import { type Ad, type AdSource, type ScraperResult, type ScraperConfig } from '../../../types.js';

export interface ScrapingOptions {
  stopOnKnownAd: boolean;
  maxAdsPerTypePerBrand: number;
  delay?: number;
  jitter?: number;
}

export interface ScrapingProgress {
  currentPage: number;
  totalAdsFound: number;
  adsSaved: number;
  warnings: string[];
}

export abstract class BaseScraper {
  protected readonly source: AdSource;
  protected readonly baseUrl: string;
  protected readonly config: ScraperConfig;
  protected axiosInstance: AxiosInstance;
  protected seenUrls: Set<string> = new Set();
  protected progress: ScrapingProgress = {
    currentPage: 0,
    totalAdsFound: 0,
    adsSaved: 0,
    warnings: [],
  };

  // User-Agent rotation
  protected readonly userAgents: string[] = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  ];

  constructor(source: AdSource, baseUrl: string, config?: Partial<ScraperConfig>) {
    this.source = source;
    this.baseUrl = baseUrl;
    this.config = this.getDefaultConfig();
    
    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.axiosInstance = this.createAxiosInstance();
  }

  /**
   * Vytvoří Axios instanci s výchozím nastavením
   */
  protected createAxiosInstance(): AxiosInstance {
    const instance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'User-Agent': this.getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
      },
    });

    // Response interceptor pro logging
    instance.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error(`[Scraper:${this.source}] Request error:`, error.message);
        return Promise.reject(error);
      }
    );

    return instance;
  }

  /**
   * Vrátí náhodný User-Agent pro rotaci
   */
  protected getRandomUserAgent(): string {
    const idx = Math.floor(Math.random() * this.userAgents.length);
    return this.userAgents[idx] ?? this.userAgents[0]!;
  }

  /**
   * Náhodná prodleva s jitter
   */
  protected async randomDelay(minMs: number = 1000, maxMs: number = 3000): Promise<void> {
    const baseDelay = this.config.scrapingOptions.delay || minMs;
    const jitter = this.config.scrapingOptions.jitter || 500;
    const randomJitter = Math.random() * jitter;
    const delay = baseDelay + randomJitter;
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * HTTP GET request s retry logikou
   */
  protected async getWithRetry(
    url: string, 
    retries: number = 3,
    backoffMs: number = 1000
  ): Promise<AxiosResponse<string>> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Rotovat User-Agent pro každý request
        this.axiosInstance.defaults.headers['User-Agent'] = this.getRandomUserAgent();

        const response = await this.axiosInstance.get(url, {
          responseType: 'text',
        });

        return response;
      } catch (error: any) {
        lastError = error;
        
        // 429 Too Many Requests - počkat déle
        if (error.response?.status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after']) || (backoffMs * attempt * 2);
          console.log(`[Scraper:${this.source}] Rate limit (429), čekám ${retryAfter}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryAfter));
          continue;
        }

        // 5xx chyby - retry s exponenciálním backoff
        if (error.response?.status >= 500) {
          const waitTime = backoffMs * Math.pow(2, attempt - 1);
          console.log(`[Scraper:${this.source}] Server error (${error.response.status}), retry za ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        // Ostatní chyby - okamžitý retry
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    throw lastError || new Error(`Request failed after ${retries} attempts`);
  }

  /**
   * Načte HTML stránku
   */
  protected async fetchPage(url: string): Promise<string> {
    const response = await this.getWithRetry(url);
    return response.data;
  }

  /**
   * Extrahuje data z HTML pomocí Cheerio
   */
  protected abstract parseAds(html: string, adType: 'nabidka' | 'poptavka'): Promise<Ad[]>;

  /**
   * Hlavní scrapovací metoda
   */
  async scrape(
    adType: 'nabidka' | 'poptavka',
    options: ScrapingOptions
  ): Promise<ScraperResult> {
    const warnings: string[] = [];
    const allAds: Ad[] = [];
    let pagesScraped = 0;
    let stopEarly = false;

    console.log(`[Scraper:${this.source}] Začínám scrapování: ${adType}`);

    const urls = adType === 'nabidka' 
      ? this.config.categories.nabidka 
      : this.config.categories.poptavka;

    for (const url of urls) {
      if (stopEarly) break;

      try {
        const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
        const html = await this.fetchPage(fullUrl);
        pagesScraped++;

        const ads = await this.parseAds(html, adType);
        console.log(`[Scraper:${this.source}] Nalezeno ${ads.length} inzerátů na stránce ${pagesScraped}`);

        for (const ad of ads) {
          // Kontrola duplicity
          if (this.seenUrls.has(ad.url)) {
            continue;
          }
          this.seenUrls.add(ad.url);

          // Kontrola známého inzerátu (checkpoint)
          if (options.stopOnKnownAd && this.isKnownAd(ad)) {
            console.log(`[Scraper:${this.source}] Nalezen známý inzerát, končím`);
            stopEarly = true;
            break;
          }

          allAds.push(ad);
          this.progress.adsSaved++;

          // Limit počtu inzerátů
          if (allAds.length >= options.maxAdsPerTypePerBrand) {
            console.log(`[Scraper:${this.source}] Dosažen limit ${options.maxAdsPerTypePerBrand} inzerátů`);
            stopEarly = true;
            break;
          }
        }

        // Delay mezi stránkami
        if (!stopEarly && urls.length > 1) {
          await this.randomDelay();
        }

      } catch (error: any) {
        const errorMsg = `Chyba při scrapování ${url}: ${error.message}`;
        console.error(`[Scraper:${this.source}] ${errorMsg}`);
        warnings.push(errorMsg);
      }
    }

    this.progress.totalAdsFound = allAds.length;
    this.progress.warnings = warnings;

    console.log(`[Scraper:${this.source}] Dokončeno: ${allAds.length} inzerátů, ${pagesScraped} stránek`);

    return {
      ads: allAds,
      savedAdsCount: allAds.length,
      warnings,
      metadata: {
        scrapedAt: new Date().toISOString(),
        source: this.source,
        pagesScraped,
        totalAdsFound: allAds.length,
      },
    };
  }

  /**
   * Zkontroluje zda je inzerát již známý (pro checkpointy)
   * Tuto metodu je třeba implementovat v potomcích podle specifického zdroje
   */
  protected abstract isKnownAd(ad: Ad): boolean;

  /**
   * Vrátí výchozí konfiguraci
   */
  protected getDefaultConfig(): ScraperConfig {
    return {
      enabled: true,
      source: this.source,
      baseUrl: this.baseUrl,
      categories: {
        nabidka: [],
        poptavka: [],
      },
      selectors: {
        adList: '',
        adItem: '',
        title: '',
        price: '',
        link: '',
      },
      scrapingOptions: {
        delay: 1500,
        jitter: 500,
        maxPages: 10,
        maxAdsPerType: 50,
        stopOnKnownAd: true,
        userAgents: this.userAgents,
      },
    };
  }

  /**
   * Vyčistí cache a seen URLs
   */
  clearCache(): void {
    this.seenUrls.clear();
    this.progress = {
      currentPage: 0,
      totalAdsFound: 0,
      adsSaved: 0,
      warnings: [],
    };
  }

  /**
   * Zkontroluje zda URL již byla viděna
   */
  protected hasSeenUrl(url: string): boolean {
    return this.seenUrls.has(url);
  }

  /**
   * Přidá URL do seznamu viděných
   */
  protected addSeenUrl(url: string): void {
    this.seenUrls.add(url);
  }

  /**
   * Vrátí aktuální progress
   */
  getProgress(): ScrapingProgress {
    return { ...this.progress };
  }

  /**
   * Vrátí zdroj scraperu
   */
  getSource(): AdSource {
    return this.source;
  }
}
