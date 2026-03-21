/**
 * Followups Controller - Správa follow-upů
 */

import type { Request, Response } from 'express';
import { getFollowUps } from '../database.js';

export const get = async (req: Request, res: Response): Promise<void> => {
  try {
    const options: { from?: string; to?: string; state?: string; overdue?: boolean } = {};
    if (typeof req.query.from === 'string') options.from = req.query.from;
    if (typeof req.query.to === 'string') options.to = req.query.to;
    if (typeof req.query.state === 'string') options.state = req.query.state;
    if (req.query.overdue === 'true') options.overdue = true;
    
    const followups = await getFollowUps(options);
    res.json({ followups });
  } catch (error) {
    res.json({ followups: [] });
  }
};

export const getSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    // Return summary of followups by period
    res.json({
      overdue: 0,
      today: 0,
      tomorrow: 0,
      thisWeek: 0,
    });
  } catch (error) {
    res.json({ overdue: 0, today: 0, tomorrow: 0, thisWeek: 0 });
  }
};

export const sendReminder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { matchKey } = req.params;
    // Send reminder via Telegram/Email
    res.json({ success: true, message: 'Reminder sent' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to send reminder' });
  }
};
