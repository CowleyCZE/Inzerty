/**
 * Ollama Controller - Správa Ollama serveru
 */

import type { Request, Response } from 'express';
import { ollamaManager } from '../utils/ollama-manager.js';
import { pushRuntimeLog } from '../utils/logger.js';

export const toggle = async (req: Request, res: Response): Promise<void> => {
  const { action } = req.body;
  console.log('[TOGGLE] Request received:', action);

  try {
    if (action === 'start') {
      const alreadyRunning = await ollamaManager.checkStatus();
      if (alreadyRunning) {
        console.log('[TOGGLE] Ollama already running');
        res.json({ message: 'Ollama již běží.', status: true });
        return;
      }

      if (!ollamaManager.isLocal()) {
        console.log('[TOGGLE] Remote Ollama cannot start');
        res.json({
          message: `Nelze spustit vzdálený Ollama.`,
          status: false,
        });
        return;
      }

      console.log('[TOGGLE] Starting Ollama...');
      ollamaManager.start().catch(console.error);

      res.json({
        message: 'Ollama se spouští...',
        status: false,
      });
    } else {
      // action === 'stop'
      console.log('[TOGGLE] Stopping Ollama');
      const result = await ollamaManager.stop();
      res.json(result);
    }
  } catch (error) {
    console.error('[TOGGLE] Error:', error);
    res.status(500).json({
      message: 'Chyba: ' + (error instanceof Error ? error.message : 'Neznámá'),
      status: false,
    });
  }
};

export const getStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const running = await ollamaManager.checkStatus();
    res.json({ status: running });
  } catch (error) {
    res.json({ status: false });
  }
};
