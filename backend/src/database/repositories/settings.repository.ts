/**
 * Settings Repository
 * 
 * Database operations for settings tables:
 * - email_settings
 * - email_templates
 * - message_templates
 * - priority_weights
 * - user_capacity
 */

import { getSqliteDb, getPgPool, usingPostgres } from '../connection.js';
import type { EmailSettingsRow, EmailTemplateRow, MessageTemplateRow, PriorityWeightsRow } from '../types.js';

export interface EmailSettingsInput {
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;
  fromEmail?: string;
  fromName?: string;
  enabled?: boolean;
}

export interface EmailTemplateInput {
  name: string;
  subject: string;
  body: string;
}

export interface MessageTemplateInput {
  name: string;
  channel: 'bazos' | 'sms' | 'email';
  side: 'seller' | 'buyer';
  subject?: string;
  body: string;
  isDefault?: boolean;
}

// ========================================
// Email Settings
// ========================================

/**
 * Save email settings
 */
export const saveEmailSettings = async (settings: EmailSettingsInput): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO email_settings (id, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, from_email, from_name, enabled, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (id) DO UPDATE SET
       smtp_host = EXCLUDED.smtp_host,
       smtp_port = EXCLUDED.smtp_port,
       smtp_user = EXCLUDED.smtp_user,
       smtp_pass = EXCLUDED.smtp_pass,
       smtp_secure = EXCLUDED.smtp_secure,
       from_email = EXCLUDED.from_email,
       from_name = EXCLUDED.from_name,
       enabled = EXCLUDED.enabled,
       updated_at = NOW()`,
      [
        settings.smtpHost || null,
        settings.smtpPort || 587,
        settings.smtpUser || null,
        settings.smtpPass || null,
        settings.smtpSecure ? 1 : 0,
        settings.fromEmail || null,
        settings.fromName || 'Inzerty Bot',
        settings.enabled ? 1 : 0,
      ],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `INSERT INTO email_settings (id, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, from_email, from_name, enabled, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
     smtp_host = excluded.smtp_host,
     smtp_port = excluded.smtp_port,
     smtp_user = excluded.smtp_user,
     smtp_pass = excluded.smtp_pass,
     smtp_secure = excluded.smtp_secure,
     from_email = excluded.from_email,
     from_name = excluded.from_name,
     enabled = excluded.enabled,
     updated_at = excluded.updated_at`,
    [
      settings.smtpHost || null,
      settings.smtpPort || 587,
      settings.smtpUser || null,
      settings.smtpPass || null,
      settings.smtpSecure ? 1 : 0,
      settings.fromEmail || null,
      settings.fromName || 'Inzerty Bot',
      settings.enabled ? 1 : 0,
    ],
  );
};

/**
 * Get email settings
 */
export const getEmailSettings = async (): Promise<EmailSettingsRow | null> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(`SELECT * FROM email_settings WHERE id = 1`);
    const row = (res.rows as EmailSettingsRow[])[0];
    return row !== undefined ? row : null;
  }

  const db = await getSqliteDb();
  const row = await db.get<EmailSettingsRow>(`SELECT * FROM email_settings WHERE id = 1`);
  return row !== undefined ? row : null;
};

// ========================================
// Email Templates
// ========================================

/**
 * Save email template
 */
export const saveEmailTemplate = async (template: EmailTemplateInput): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO email_templates (name, subject, body, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (name) DO UPDATE SET
       subject = EXCLUDED.subject,
       body = EXCLUDED.body,
       updated_at = NOW()`,
      [template.name, template.subject, template.body],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `INSERT INTO email_templates (name, subject, body, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(name) DO UPDATE SET
     subject = excluded.subject,
     body = excluded.body,
     updated_at = excluded.updated_at`,
    [template.name, template.subject, template.body],
  );
};

/**
 * Get email template
 */
export const getEmailTemplate = async (name: string): Promise<EmailTemplateRow | null> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(`SELECT * FROM email_templates WHERE name = $1`, [name]);
    const row = (res.rows as EmailTemplateRow[])[0];
    return row !== undefined ? row : null;
  }

  const db = await getSqliteDb();
  const row = await db.get<EmailTemplateRow>(`SELECT * FROM email_templates WHERE name = ?`, [name]);
  return row !== undefined ? row : null;
};

/**
 * Get all email templates
 */
export const getAllEmailTemplates = async (): Promise<EmailTemplateRow[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(`SELECT * FROM email_templates ORDER BY name`);
    return res.rows as EmailTemplateRow[];
  }

  const db = await getSqliteDb();
  return db.all<EmailTemplateRow[]>(`SELECT * FROM email_templates ORDER BY name`);
};

// ========================================
// Message Templates
// ========================================

/**
 * Save message template
 */
export const saveMessageTemplate = async (template: MessageTemplateInput): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO message_templates (name, channel, side, subject, body, is_default, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (name, channel, side) DO UPDATE SET
       subject = EXCLUDED.subject,
       body = EXCLUDED.body,
       is_default = EXCLUDED.is_default,
       updated_at = NOW()`,
      [template.name, template.channel, template.side, template.subject || null, template.body, template.isDefault ? 1 : 0],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `INSERT INTO message_templates (name, channel, side, subject, body, is_default, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT(name, channel, side) DO UPDATE SET
     subject = excluded.subject,
     body = excluded.body,
     is_default = excluded.is_default,
     updated_at = excluded.updated_at`,
    [template.name, template.channel, template.side, template.subject || null, template.body, template.isDefault ? 1 : 0],
  );
};

/**
 * Get message template
 */
export const getMessageTemplate = async (
  channel: string,
  side: string
): Promise<MessageTemplateRow | null> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(
      `SELECT * FROM message_templates WHERE channel = $1 AND side = $2 AND is_default = TRUE`,
      [channel, side],
    );
    const row = (res.rows as MessageTemplateRow[])[0];
    return row !== undefined ? row : null;
  }

  const db = await getSqliteDb();
  const row = await db.get<MessageTemplateRow>(
    `SELECT * FROM message_templates WHERE channel = ? AND side = ? AND is_default = 1`,
    [channel, side],
  );
  return row !== undefined ? row : null;
};

/**
 * Get all message templates
 */
export const getAllMessageTemplates = async (): Promise<MessageTemplateRow[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(`SELECT * FROM message_templates ORDER BY channel, side`);
    return res.rows as MessageTemplateRow[];
  }

  const db = await getSqliteDb();
  return db.all<MessageTemplateRow[]>(`SELECT * FROM message_templates ORDER BY channel, side`);
};

// ========================================
// Priority Weights
// ========================================

/**
 * Save priority weights
 */
export const savePriorityWeights = async (weights: {
  profitability: number;
  trustworthiness: number;
  urgency: number;
  marketTrend: number;
  capacity: number;
}): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO priority_weights (id, profitability_weight, trustworthiness_weight, urgency_weight, market_trend_weight, capacity_weight, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, NOW())
       ON CONFLICT (id) DO UPDATE SET
       profitability_weight = EXCLUDED.profitability_weight,
       trustworthiness_weight = EXCLUDED.trustworthiness_weight,
       urgency_weight = EXCLUDED.urgency_weight,
       market_trend_weight = EXCLUDED.market_trend_weight,
       capacity_weight = EXCLUDED.capacity_weight,
       updated_at = NOW()`,
      [weights.profitability, weights.trustworthiness, weights.urgency, weights.marketTrend, weights.capacity],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `INSERT INTO priority_weights (id, profitability_weight, trustworthiness_weight, urgency_weight, market_trend_weight, capacity_weight, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
     profitability_weight = excluded.profitability_weight,
     trustworthiness_weight = excluded.trustworthiness_weight,
     urgency_weight = excluded.urgency_weight,
     market_trend_weight = excluded.market_trend_weight,
     capacity_weight = excluded.capacity_weight,
     updated_at = excluded.updated_at`,
    [weights.profitability, weights.trustworthiness, weights.urgency, weights.marketTrend, weights.capacity],
  );
};

/**
 * Get priority weights
 */
export const getPriorityWeights = async (): Promise<PriorityWeightsRow | null> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(`SELECT * FROM priority_weights WHERE id = 1`);
    const row = (res.rows as PriorityWeightsRow[])[0];
    return row !== undefined ? row : null;
  }

  const db = await getSqliteDb();
  const row = await db.get<PriorityWeightsRow>(`SELECT * FROM priority_weights WHERE id = 1`);
  return row !== undefined ? row : null;
};

// ========================================
// Log Email Notification
// ========================================

/**
 * Log email notification
 */
export const logEmailNotification = async (
  recipientEmail: string,
  subject: string,
  body: string,
  status: string = 'pending',
  errorMessage?: string
): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO email_notifications_log (recipient_email, subject, body, status, error_message, sent_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [recipientEmail, subject, body, status, errorMessage || null],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `INSERT INTO email_notifications_log (recipient_email, subject, body, status, error_message, sent_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [recipientEmail, subject, body, status, errorMessage || null],
  );
};
