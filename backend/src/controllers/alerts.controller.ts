/**
 * Alerts Controller - Správa alertů a notifikací
 */

import type { Request, Response } from 'express';

// Mock implementation - actual implementation would use notification services
const alertsConfig: any = {
  telegramBotToken: '',
  telegramChatId: '',
  emailWebhookUrl: '',
  discordWebhookUrl: '',
  minProfit: 1500,
  minScore: 70,
  enabled: false,
  autoSendAfterCompare: true,
};

export const getConfig = (req: Request, res: Response): void => {
  res.json({ config: alertsConfig });
};

export const saveConfig = (req: Request, res: Response): void => {
  Object.assign(alertsConfig, req.body);
  res.json({ success: true, config: alertsConfig });
};

export const test = async (req: Request, res: Response): Promise<void> => {
  // Send test notification
  res.json({ success: true, message: 'Testovací alert odeslán' });
};

export const notify = async (req: Request, res: Response): Promise<void> => {
  const { matches, minProfit, minScore } = req.body;
  
  // Filter top matches
  const topMatches = matches.filter((m: any) => 
    (m.arbitrageScore || 0) >= minProfit && (m.realOpportunityScore || 0) >= minScore
  );

  // Send notifications via Telegram, Email, Discord
  // Implementation would go here
  
  res.json({ success: true, sent: topMatches.length });
};
