/**
 * BazosCZScraper - Implementace scraperu pro Bazoš.cz
 * 
 * Struktura:
 * - Nabídky: https://mobil.bazos.cz/inzerce.php
 * - Poptávky: https://mobil.bazos.cz/poptavka.php
 */

import * as cheerio from 'cheerio';
import { type Ad, type AdSource } from '../../../types.js';
import { BaseScraper } from './BaseScraper.js';

export class BazosCZScraper extends BaseScraper {
  constructor() {
    super('bazos_cz', 'https://mobil.bazos.cz', {
      categories: {
        nabidka: ['/inzerce.php'],
        poptavka: ['/poptavka.php'],
      },
      selectors: {
        adList: '.rubrika',
        adItem: '.inzerat',
        title: '.nadpis',
        price: '.cena',
        link: 'a',
        description: '.popis',
        location: '.misto',
        date: '.datum',
        image: 'img',
      },
      scrapingOptions: {
        delay: 2000,
        jitter: 1000,
        maxPages: 20,
        maxAdsPerType: 50,
        stopOnKnownAd: true,
        userAgents: [],
      },
    });
  }

  /**
   * Parseování inzerátů z HTML
   */
  async parseAds(html: string, adType: 'nabidka' | 'poptavka'): Promise<Ad[]> {
    const $ = cheerio.load(html);
    const ads: Ad[] = [];

    // Bazoš používá třídu .inzerat pro jednotlivé inzeráty
    $('.inzerat').each((_, element) => {
      try {
        const $el = $(element);
        const $nadpis = $el.find('.nadpis');
        const $a = $nadpis.find('a');
        
        const title = $a.text().trim();
        const url = $a.attr('href') || '';
        const fullUrl = url.startsWith('http') ? url : `https://mobil.bazos.cz${url}`;
        
        // Cena - může být v .cena nebo přímo v textu
        let price = $el.find('.cena').text().trim() || '';
        if (!price) {
          // Zkusit najít cenu v popisu
          const popis = $el.find('.popis').text().trim();
          const priceMatch = popis.match(/(\d+(?:[\s.,]\d+)*)\s*(?:Kč|CZK|€|EUR)?/i);
          price = priceMatch?.[1]?.replace(/[\s.,]/g, '') || '0';
        }

        // Lokalita
        const locationText = ($el.find('.misto').text() || '').trim();

        // Datum
        const datePosted = $el.find('.datum').text().trim() || new Date().toISOString();

        // Popis
        const descriptionText = $el.find('.popis').text().trim() || '';

        // Obrázek
        const imageUrl = $el.find('img').attr('src') || '';
        const fullImageUrl = imageUrl && imageUrl.startsWith('http')
          ? imageUrl
          : imageUrl ? `https://mobil.bazos.cz${imageUrl}` : '';

        // ID z URL
        const urlParts = fullUrl.split('/');
        const filename = urlParts[urlParts.length - 1] ?? '';
        const match = filename.match(/(\d+)/);
        const id = match ? match[1] : fullUrl;

        // Značka - extrahovat z titulku
        const brand = this.extractBrand(title);

        const ad: Ad = {
          id: id || fullUrl,
          title: title || '',
          price: price || '0',
          location: locationText || '',
          description: descriptionText || '',
          date_posted: datePosted || new Date().toISOString(),
          url: fullUrl,
          image_url: fullImageUrl || '',
          ad_type: adType,
          brand: brand || 'Jiné',
          scraped_at: new Date().toISOString(),
          views: '0',
          is_top: $el.hasClass('inzerat_top') || false,
          link: fullUrl,
          source: 'bazos_cz',
          external_id: id || fullUrl,
        };

        ads.push(ad);
      } catch (error) {
        console.error('[BazosCZScraper] Error parsing ad:', error);
      }
    });

    return ads;
  }

  /**
   * Extrakce značky z titulku
   */
  protected extractBrand(title: string): string {
    const brands = [
      'Apple', 'iPhone', 'Samsung', 'Huawei', 'Xiaomi', 'Oppo', 'OnePlus', 
      'Google', 'Pixel', 'Sony', 'Motorola', 'Nokia', 'Realme', 'Honor',
      'Nothing', 'Fairphone', 'Asus', 'ROG', 'Blackview', 'Ulefone', 'Doogee'
    ];

    const lowerTitle = title.toLowerCase();
    
    for (const brand of brands) {
      if (lowerTitle.includes(brand.toLowerCase())) {
        return brand;
      }
    }

    return 'Jiné';
  }

  /**
   * Kontrola známého inzerátu podle URL
   */
  protected isKnownAd(ad: Ad): boolean {
    return this.hasSeenUrl(ad.url);
  }
}
