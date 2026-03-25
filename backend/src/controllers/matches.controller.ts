/**
 * Matches Controller - Porovnávání a správa matches
 */

import type { Request, Response } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { findMatches } from '../services/matching.service.js';
import {
  getResolvedMatchKeys,
  getPreviouslySeenMatchKeys,
  markMatchesAsSeen,
  bulkUpdateMatches,
  getDailyMetaStats,
} from '../database.js';
import { pushRuntimeLog } from '../utils/logger.js';

export const compare = async (req: Request, res: Response): Promise<void> => {
  try {
    const options = {
      comparisonMethod: req.body.comparisonMethod || 'auto',
      filterRules: req.body.filterRules || {},
      hideResolved: req.body.hideResolved !== false,
    };

    const result = await findMatches(options);

    // Uložení shod do souboru pro analýzu
    const matchesFilePath = path.join(__dirname, '..', 'matches_export.json');
    const exportData = {
      timestamp: new Date().toISOString(),
      totalMatches: result.data.length,
      matches: result.data.map((m) => ({
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
        similarityScore: m.similarityScore,
        realOpportunityScore: m.realOpportunityScore,
        expectedNetProfit: m.expectedNetProfit,
        locationScore: m.locationScore,
        priceTrustScore: m.priceTrustScore,
      })),
    };
    await fs.writeFile(matchesFilePath, JSON.stringify(exportData, null, 2), 'utf-8');
    pushRuntimeLog(`Shody uloženy do: ${matchesFilePath}`, 'info');

    res.json({
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    pushRuntimeLog(`Chyba porovnávání: ${error instanceof Error ? error.message : 'neznámá chyba'}`, 'error');
    console.error('Během porovnávání došlo k chybě:', error);
    const errorMessage = error instanceof Error ? error.message : 'Došlo k neznámé chybě';
    res.status(500).json({ message: 'Během porovnávání došlo k chybě.', error: errorMessage });
  }
};

export const exportMatches = async (req: Request, res: Response): Promise<void> => {
  try {
    const matchesFilePath = path.join(__dirname, '..', 'matches_export.json');
    const fileExists = await fs
      .access(matchesFilePath)
      .then(() => true)
      .catch(() => false);

    if (!fileExists) {
      res.status(404).json({ message: 'Žádné shody k exportu. Nejprve spusťte porovnání.' });
      return;
    }

    const fileContent = await fs.readFile(matchesFilePath, 'utf-8');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="matches_${new Date().toISOString().split('T')[0]}.json"`);
    res.send(fileContent);
  } catch (error) {
    console.error('Chyba při exportu shod:', error);
    res.status(500).json({ message: 'Chyba při exportu shod.' });
  }
};

export const getSeen = async (req: Request, res: Response): Promise<void> => {
  try {
    const seenKeys = await getPreviouslySeenMatchKeys();
    res.json({ seenKeys });
  } catch (error) {
    res.json({ seenKeys: [] });
  }
};

export const markSeen = async (req: Request, res: Response): Promise<void> => {
  try {
    const { matchKeys } = req.body;
    if (!Array.isArray(matchKeys)) {
      res.status(400).json({ message: 'matchKeys must be an array' });
      return;
    }
    await markMatchesAsSeen(matchKeys);
    res.json({ success: true, count: matchKeys.length });
  } catch (error) {
    res.status(500).json({ message: 'Error marking matches as seen' });
  }
};

export const bulkUpdate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { matchKeys, updates } = req.body;
    if (!Array.isArray(matchKeys) || !updates) {
      res.status(400).json({ message: 'Invalid request' });
      return;
    }
    await bulkUpdateMatches(matchKeys, updates);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error updating matches' });
  }
};

export const getStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getDailyMetaStats();
    res.json(stats);
  } catch (error) {
    res.json({ resolvedCount: 0, newCount: 0, contactedCount: 0 });
  }
};
