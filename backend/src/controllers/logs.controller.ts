/**
 * Logs Controller - Správa runtime logů
 */

import type { Request, Response } from 'express';
import { getRuntimeLogs, clearRuntimeLogs } from '../utils/logger.js';

export const get = (req: Request, res: Response): void => {
  const logs = getRuntimeLogs();
  res.json({ logs });
};

export const clear = (req: Request, res: Response): void => {
  clearRuntimeLogs();
  res.json({ message: 'Logy vymazány' });
};
