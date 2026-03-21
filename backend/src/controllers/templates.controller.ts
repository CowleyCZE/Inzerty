/**
 * Templates Controller - Správa šablon zpráv
 */

import type { Request, Response } from 'express';

// Mock storage for templates
const messageTemplates: any = {};

export const getMessages = (req: Request, res: Response): void => {
  res.json({ templates: messageTemplates });
};

export const saveMessages = (req: Request, res: Response): void => {
  const { channel, side, template } = req.body;
  if (!channel || !side || !template) {
    res.status(400).json({ message: 'Missing required fields' });
    return;
  }
  
  const key = `${channel}_${side}`;
  messageTemplates[key] = template;
  
  res.json({ success: true, template });
};
