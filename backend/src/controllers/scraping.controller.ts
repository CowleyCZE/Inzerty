/**
 * Scraping Controller - Scrapování inzerátů
 */

import type { Request, Response } from 'express';
import { scrapeAllBrands } from '../services/scraping.service.js';
import { pushRuntimeLog } from '../utils/logger.js';
import { ScraperFactory } from '../scrapers/index.js';
import type { AdSource } from '../../../types.js';

export const scrapeAll = async (req: Request, res: Response): Promise<void> => {
  const { selectors, scrapingOptions } = req.body;

  if (!selectors) {
    res.status(400).json({ message: 'Chybí povinná konfigurace.' });
    return;
  }

  try {
    const result = await scrapeAllBrands(selectors, scrapingOptions || {});
    
    res.json({
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    pushRuntimeLog(`Chyba scrapování: ${error instanceof Error ? error.message : 'neznámá chyba'}`, 'error');
    console.error('Během scrapování došlo k chybě:', error);
    const errorMessage = error instanceof Error ? error.message : 'Došlo k neznámé chybě';
    res.status(500).json({ message: 'Během scrapování došlo k chybě.', error: errorMessage });
  }
};

export const scrapeAllMulti = async (req: Request, res: Response): Promise<void> => {
  const { enabledPlatforms, scrapingOptions } = req.body;

  const platforms: string[] = enabledPlatforms || ['bazos_cz'];

  if (!Array.isArray(platforms) || platforms.length === 0) {
    res.status(400).json({ message: 'enabledPlatforms musí být neprázdné pole' });
    return;
  }

  try {
    let totalOffers = 0;
    let totalDemands = 0;
    let totalSaved = 0;
    const platformResults: Record<string, any> = {};
    const successPlatforms: string[] = [];
    
    const opts = scrapingOptions || {};
    const safeOptions = {
      stopOnKnownAd: opts.stopOnKnownAd !== false,
      maxAdsPerTypePerBrand: Math.max(1, Math.min(500, Number(opts.maxAdsPerTypePerBrand || 50))),
    };

    for (const platform of platforms) {
      try {
        pushRuntimeLog(`Začínám scrape pro platformu ${platform}`, 'system');
        const scraper = ScraperFactory.create(platform as AdSource);

        const offerResult = await scraper.scrape('nabidka', safeOptions);
        const demandResult = await scraper.scrape('poptavka', safeOptions);

        const offers = offerResult.ads.length;
        const demands = demandResult.ads.length;
        const savedOffers = offerResult.savedAdsCount || 0;
        const savedDemands = demandResult.savedAdsCount || 0;
        const saved = savedOffers + savedDemands;

        totalOffers += offers;
        totalDemands += demands;
        totalSaved += saved;

        platformResults[platform] = {
          offers,
          demands,
          saved
        };
        successPlatforms.push(platform);
        pushRuntimeLog(`Platforma ${platform} dokončena: Nabídky: ${offers}, Poptávky: ${demands}`, 'success');
      } catch (err: any) {
        pushRuntimeLog(`Chyba scrapování platformy ${platform}: ${err.message}`, 'error');
        console.error(`Během scrapování platformy ${platform} došlo k chybě:`, err);
      }
    }

    res.json({
      message: `Scrapování dokončeno! Načteno ${totalOffers} nabídek a ${totalDemands} poptávek; do DB uloženo ${totalSaved} inzerátů z platforem: ${successPlatforms.join(', ')}.`,
      data: {
        totalAds: totalOffers + totalDemands,
        totalSaved: totalSaved,
        platformResults,
        successPlatforms,
      },
    });
  } catch (error) {
    pushRuntimeLog(`Chyba multi-platform scrapování: ${error instanceof Error ? error.message : 'neznámá chyba'}`, 'error');
    console.error('Během multi-platform scrapování došlo k chybě:', error);
    const errorMessage = error instanceof Error ? error.message : 'Došlo k neznámé chybě';
    res.status(500).json({ message: 'Během multi-platform scrapování došlo k chybě.', error: errorMessage });
  }
};
