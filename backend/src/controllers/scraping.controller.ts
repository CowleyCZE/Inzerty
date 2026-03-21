/**
 * Scraping Controller - Scrapování inzerátů
 */

import type { Request, Response } from 'express';
import { scrapeAllBrands } from '../services/scraping.service.js';
import { pushRuntimeLog } from '../utils/logger.js';

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
    // TODO: Implement multi-platform scraping using ScraperFactory
    // For now, use the existing scrapeAllBrands
    const result = await scrapeAllBrands({}, scrapingOptions || {});

    res.json({
      message: result.message,
      data: {
        totalAds: result.data.nabidkaCount + result.data.poptavkaCount,
        totalSaved: result.data.savedNabidkaCount + result.data.savedPoptavkaCount,
        platformResults: {
          bazos_cz: {
            offers: result.data.nabidkaCount,
            demands: result.data.poptavkaCount,
            saved: result.data.savedNabidkaCount + result.data.savedPoptavkaCount,
          },
        },
        successPlatforms: ['bazos_cz'],
      },
    });
  } catch (error) {
    pushRuntimeLog(`Chyba multi-platform scrapování: ${error instanceof Error ? error.message : 'neznámá chyba'}`, 'error');
    console.error('Během multi-platform scrapování došlo k chybě:', error);
    const errorMessage = error instanceof Error ? error.message : 'Došlo k neznámé chybě';
    res.status(500).json({ message: 'Během multi-platform scrapování došlo k chybě.', error: errorMessage });
  }
};
