/**
 * Settings Controller - Správa nastavení aplikace
 */

import type { Request, Response } from 'express';
import { ollamaManager } from '../utils/ollama-manager.js';

export const get = (req: Request, res: Response): void => {
  res.json({
    ollamaUrl: ollamaManager.getBaseUrl(),
    ollamaModel: ollamaManager.getModel(),
  });
};

export const save = (req: Request, res: Response): void => {
  const requestedModel = typeof req.body?.ollamaModel === 'string' ? req.body.ollamaModel.trim() : '';

  if (!requestedModel) {
    res.status(400).json({ message: 'Model Ollama je povinný.' });
    return;
  }

  ollamaManager.setModel(requestedModel);
  
  res.json({
    message: `Model Ollama byl uložen: ${ollamaManager.getModel()}`,
    ollamaModel: ollamaManager.getModel(),
  });
};
