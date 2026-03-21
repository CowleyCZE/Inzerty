/**
 * Conversations Repository
 * 
 * Database operations for conversations table
 */

import { getSqliteDb, getPgPool, usingPostgres } from '../connection.js';
import type { ConversationRow } from '../types.js';

export interface ConversationInput {
  matchKey: string;
  message: string;
  sender: 'user' | 'counterpart';
  channel?: 'bazos' | 'sms' | 'email';
  isAiGenerated?: boolean;
  contextSnapshot?: any;
}

/**
 * Save a conversation message
 */
export const saveConversation = async (input: ConversationInput): Promise<void> => {
  const now = new Date().toISOString();

  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO conversations (match_key, message, sender, channel, sent_at, is_ai_generated, context_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [input.matchKey, input.message, input.sender, input.channel || 'bazos', now, input.isAiGenerated ? 1 : 0, input.contextSnapshot ? JSON.stringify(input.contextSnapshot) : null],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `INSERT INTO conversations (match_key, message, sender, channel, sent_at, is_ai_generated, context_snapshot)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [input.matchKey, input.message, input.sender, input.channel || 'bazos', now, input.isAiGenerated ? 1 : 0, input.contextSnapshot ? JSON.stringify(input.contextSnapshot) : null],
  );
};

/**
 * Get conversation history for a match
 */
export const getConversationHistory = async (matchKey: string): Promise<ConversationRow[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(
      `SELECT * FROM conversations WHERE match_key = $1 ORDER BY sent_at ASC`,
      [matchKey],
    );
    return res.rows as ConversationRow[];
  }

  const db = await getSqliteDb();
  return db.all<ConversationRow[]>(
    `SELECT * FROM conversations WHERE match_key = ? ORDER BY sent_at ASC`,
    [matchKey],
  );
};

/**
 * Get last conversation message for a match
 */
export const getLastConversation = async (matchKey: string): Promise<ConversationRow | null> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(
      `SELECT * FROM conversations WHERE match_key = $1 ORDER BY sent_at DESC LIMIT 1`,
      [matchKey],
    );
    const row = (res.rows as ConversationRow[])[0];
    return row !== undefined ? row : null;
  }

  const db = await getSqliteDb();
  const row = await db.get<ConversationRow>(
    `SELECT * FROM conversations WHERE match_key = ? ORDER BY sent_at DESC LIMIT 1`,
    [matchKey],
  );
  return row !== undefined ? row : null;
};

/**
 * Get conversation statistics for a match
 */
export const getConversationStats = async (matchKey: string): Promise<{
  totalMessages: number;
  userMessages: number;
  counterpartMessages: number;
  aiGeneratedMessages: number;
  lastMessageAt: string | null;
}> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(
      `SELECT
        COUNT(*) as total_messages,
        COUNT(*) FILTER (WHERE sender = 'user') as user_messages,
        COUNT(*) FILTER (WHERE sender = 'counterpart') as counterpart_messages,
        COUNT(*) FILTER (WHERE is_ai_generated = true) as ai_generated_messages,
        MAX(sent_at) as last_message_at
       FROM conversations
       WHERE match_key = $1`,
      [matchKey],
    );
    const row = res.rows[0] as any;
    return {
      totalMessages: parseInt(row.total_messages || '0', 10),
      userMessages: parseInt(row.user_messages || '0', 10),
      counterpartMessages: parseInt(row.counterpart_messages || '0', 10),
      aiGeneratedMessages: parseInt(row.ai_generated_messages || '0', 10),
      lastMessageAt: row.last_message_at,
    };
  }

  const db = await getSqliteDb();
  const row = await db.get<any>(
    `SELECT
      COUNT(*) as total_messages,
      SUM(CASE WHEN sender = 'user' THEN 1 ELSE 0 END) as user_messages,
      SUM(CASE WHEN sender = 'counterpart' THEN 1 ELSE 0 END) as counterpart_messages,
      SUM(CASE WHEN is_ai_generated = 1 THEN 1 ELSE 0 END) as ai_generated_messages,
      MAX(sent_at) as last_message_at
     FROM conversations
     WHERE match_key = ?`,
    [matchKey],
  );
  return {
    totalMessages: row?.total_messages || 0,
    userMessages: row?.user_messages || 0,
    counterpartMessages: row?.counterpart_messages || 0,
    aiGeneratedMessages: row?.ai_generated_messages || 0,
    lastMessageAt: row?.last_message_at,
  };
};

/**
 * Get conversations by channel
 */
export const getConversationsByChannel = async (
  channel: string,
  limit = 100
): Promise<ConversationRow[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(
      `SELECT * FROM conversations WHERE channel = $1 ORDER BY sent_at DESC LIMIT $2`,
      [channel, limit],
    );
    return res.rows as ConversationRow[];
  }

  const db = await getSqliteDb();
  return db.all<ConversationRow[]>(
    `SELECT * FROM conversations WHERE channel = ? ORDER BY sent_at DESC LIMIT ?`,
    [channel, limit],
  );
};

/**
 * Delete conversations for a match
 */
export const deleteConversations = async (matchKey: string): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(`DELETE FROM conversations WHERE match_key = $1`, [matchKey]);
    return;
  }

  const db = await getSqliteDb();
  await db.run(`DELETE FROM conversations WHERE match_key = ?`, [matchKey]);
};
