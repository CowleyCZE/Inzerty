/**
 * Database Controller - Správa databáze
 */

import type { Request, Response } from 'express';
import { clearDatabase } from '../database.js';
import { pushRuntimeLog } from '../utils/logger.js';

export const clear = async (req: Request, res: Response): Promise<void> => {
  try {
    await clearDatabase();
    pushRuntimeLog('Databáze byla vymazána.', 'success');
    res.json({ message: 'Databáze byla vymazána.' });
  } catch (error) {
    pushRuntimeLog(`Chyba při mazání databáze: ${error instanceof Error ? error.message : 'Neznámá chyba'}`, 'error');
    res.status(500).json({ message: 'Mazání databáze selhalo.' });
  }
};
