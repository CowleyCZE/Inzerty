/**
 * Match Meta Controller - Správa metadat matchů
 */

import type { Request, Response } from 'express';
import { saveMatchMeta, getDailyMetaStats } from '../database.js';

export const save = async (req: Request, res: Response): Promise<void> => {
  try {
    const { matchKey, ...meta } = req.body;
    if (!matchKey) {
      res.status(400).json({ message: 'matchKey is required' });
      return;
    }
    await saveMatchMeta({ matchKey, ...meta });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error saving match meta' });
  }
};

export const dailyReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getDailyMetaStats();
    res.json(stats);
  } catch (error) {
    res.json({ newCount: 0, contactedCount: 0, closedCount: 0 });
  }
};
