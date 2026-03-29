/**
 * ScraperFactory - Factory pattern pro vytváření scraperů
 * 
 * Použití:
 * const scraper = ScraperFactory.create('bazos_cz');
 * const result = await scraper.scrape('nabidka', options);
 */

import { type AdSource, type ScraperConfig } from '../../../types.js';
import { BaseScraper } from './BaseScraper.js';
import { BazosCZScraper } from './BazosCZScraper.js';
import { BazosSKScraper } from './BazosSKScraper.js';

// Import dalších scraperů (až budou vytvořeny)
// import { SbazarScraper } from './SbazarScraper';
// import { MobilnetScraper } from './MobilnetScraper';

export class ScraperFactory {
  private static scrapers: Map<AdSource, BaseScraper> = new Map();

  /**
   * Vytvoří nebo vrátí existující scraper pro daný zdroj
   */
  static create(source: AdSource, config?: Partial<ScraperConfig>): BaseScraper {
    // Pokud již existuje instance, vrátíme ji
    if (this.scrapers.has(source)) {
      const existing = this.scrapers.get(source)!;
      if (config) {
        // Aktualizujeme konfiguraci existující instance
        existing.updateConfig(config);
      }
      return existing;
    }

    // Vytvořit novou instanci
    const scraper = this.createScraper(source, config);
    this.scrapers.set(source, scraper);
    return scraper;
  }

  /**
   * Vytvoří konkrétní scraper podle zdroje
   */
  private static createScraper(source: AdSource, config?: Partial<ScraperConfig>): BaseScraper {
    switch (source) {
      case 'bazos_cz':
        return new BazosCZScraper();
      
      case 'bazos_sk':
        return new BazosSKScraper();
      
      // Pokud budou implementovány další scrapery, přidat je zde:
      // case 'sbazar':
      //   return new SbazarScraper();
      
      // case 'mobilnet':
      //   return new MobilnetScraper();
      
      // case 'aukro':
      //   return new AukroScraper();

      default:
        throw new Error(`Scraper pro zdroj "${source}" není implementován`);
    }
  }

  /**
   * Vrátí všechny dostupné zdroje
   * Zahrnuje jen ty scrapery, které jsou aktuálně implementovány
   */
  static getAvailableSources(): AdSource[] {
    return ['bazos_cz', 'bazos_sk'];
    // Rozšíření je možné po implementaci dalších scraperů:
    // return ['bazos_cz', 'bazos_sk', 'sbazar', 'mobilnet', 'aukro'];
  }

  /**
   * Vyčistí všechny cache scraperů
   */
  static clearAllCaches(): void {
    this.scrapers.forEach(scraper => scraper.clearCache());
  }

  /**
   * Odstraní scraper z cache (pro uvolnění paměti)
   */
  static remove(source: AdSource): void {
    this.scrapers.delete(source);
  }

  /**
   * Vrátí všechny aktivní scrapery
   */
  static getAllScrapers(): Map<AdSource, BaseScraper> {
    return new Map(this.scrapers);
  }
}

// Export helper function pro snadné použití
export function getScraper(source: AdSource, config?: Partial<ScraperConfig>): BaseScraper {
  return ScraperFactory.create(source, config);
}
