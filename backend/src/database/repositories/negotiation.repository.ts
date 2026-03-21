/**
 * Negotiation Repository
 * 
 * Database operations for negotiation_history table and related functions
 */

import { getSqliteDb, getPgPool, usingPostgres } from '../connection.js';
import type { NegotiationHistoryRow } from '../types.js';

export interface NegotiationInput {
  matchKey: string;
  offerPrice?: number | undefined;
  counterPrice?: number | undefined;
  finalPrice?: number | undefined;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  aiSuggested?: boolean | undefined;
}

export interface NegotiationStats {
  totalNegotiations: number;
  successfulNegotiations: number;
  avgSavings: number;
  avgRounds: number;
}

/**
 * Save a negotiation record
 */
export const saveNegotiation = async (input: NegotiationInput): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO negotiation_history 
       (match_key, offer_price, counter_price, final_price, status, ai_suggested, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        input.matchKey,
        input.offerPrice || null,
        input.counterPrice || null,
        input.finalPrice || null,
        input.status,
        input.aiSuggested ? 1 : 0,
      ],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `INSERT INTO negotiation_history 
     (match_key, offer_price, counter_price, final_price, status, ai_suggested, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      input.matchKey,
      input.offerPrice || null,
      input.counterPrice || null,
      input.finalPrice || null,
      input.status,
      input.aiSuggested ? 1 : 0,
    ],
  );
};

/**
 * Update negotiation status
 */
export const updateNegotiation = async (
  negotiationId: number,
  status: string,
  finalPrice?: number
): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    if (finalPrice !== undefined) {
      await pool.query(
        `UPDATE negotiation_history SET status = $1, final_price = $2, responded_at = NOW() WHERE id = $3`,
        [status, finalPrice, negotiationId],
      );
    } else {
      await pool.query(
        `UPDATE negotiation_history SET status = $1, responded_at = NOW() WHERE id = $2`,
        [status, negotiationId],
      );
    }
    return;
  }

  const db = await getSqliteDb();
  if (finalPrice !== undefined) {
    await db.run(
      `UPDATE negotiation_history SET status = ?, final_price = ?, responded_at = datetime('now') WHERE id = ?`,
      [status, finalPrice, negotiationId],
    );
  } else {
    await db.run(
      `UPDATE negotiation_history SET status = ?, responded_at = datetime('now') WHERE id = ?`,
      [status, negotiationId],
    );
  }
};

/**
 * Get negotiation history for a match
 */
export const getNegotiationHistory = async (matchKey: string): Promise<NegotiationHistoryRow[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(
      `SELECT * FROM negotiation_history WHERE match_key = $1 ORDER BY created_at DESC`,
      [matchKey],
    );
    return res.rows as NegotiationHistoryRow[];
  }

  const db = await getSqliteDb();
  return db.all<NegotiationHistoryRow[]>(
    `SELECT * FROM negotiation_history WHERE match_key = ? ORDER BY created_at DESC`,
    [matchKey],
  );
};

/**
 * Get negotiation statistics
 */
export const getNegotiationStats = async (): Promise<NegotiationStats> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(`
      SELECT
        COUNT(*) as total_negotiations,
        COUNT(*) FILTER (WHERE status = 'accepted') as successful_negotiations,
        AVG(offer_price - final_price) FILTER (WHERE status = 'accepted' AND final_price IS NOT NULL) as avg_savings,
        AVG(
          CASE
            WHEN counter_price IS NOT NULL AND offer_price IS NOT NULL THEN 2
            WHEN final_price IS NOT NULL AND offer_price IS NOT NULL THEN 3
            ELSE 1
          END
        ) FILTER (WHERE status = 'accepted') as avg_rounds
      FROM negotiation_history
    `);
    const row = res.rows[0] as any;
    return {
      totalNegotiations: parseInt(row.total_negotiations || '0', 10),
      successfulNegotiations: parseInt(row.successful_negotiations || '0', 10),
      avgSavings: parseFloat(row.avg_savings || '0'),
      avgRounds: parseFloat(row.avg_rounds || '0'),
    };
  }

  const db = await getSqliteDb();
  const row = await db.get<any>(`
    SELECT
      COUNT(*) as total_negotiations,
      SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as successful_negotiations,
      AVG(offer_price - final_price) as avg_savings,
      AVG(
        CASE
          WHEN counter_price IS NOT NULL AND offer_price IS NOT NULL THEN 2
          WHEN final_price IS NOT NULL AND offer_price IS NOT NULL THEN 3
          ELSE 1
        END
      ) as avg_rounds
    FROM negotiation_history
    WHERE status = 'accepted'
  `);
  return {
    totalNegotiations: row?.total_negotiations || 0,
    successfulNegotiations: row?.successful_negotiations || 0,
    avgSavings: parseFloat(row?.avg_savings || '0'),
    avgRounds: parseFloat(row?.avg_rounds || '0'),
  };
};

/**
 * Save negotiation message (for conversation tracking)
 */
export const saveNegotiationMessage = async (
  matchKey: string,
  message: string,
  sender: 'user' | 'counterpart',
  price?: number,
  messageType: 'offer' | 'counter' | 'accept' | 'reject' = 'offer'
): Promise<void> => {
  // This would typically be saved to conversations table
  // For now, we'll just save the negotiation record
  const statusMap: Record<string, 'pending' | 'accepted' | 'rejected' | 'cancelled'> = {
    offer: 'pending',
    counter: 'pending',
    accept: 'accepted',
    reject: 'rejected',
  };

  await saveNegotiation({
    matchKey,
    offerPrice: messageType === 'offer' ? price : undefined,
    counterPrice: messageType === 'counter' ? price : undefined,
    finalPrice: messageType === 'accept' ? price : undefined,
    status: statusMap[messageType] || 'pending',
    aiSuggested: false,
  });
};

/**
 * Get pending negotiations
 */
export const getPendingNegotiations = async (): Promise<NegotiationHistoryRow[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(
      `SELECT * FROM negotiation_history WHERE status = 'pending' ORDER BY created_at ASC`,
    );
    return res.rows as NegotiationHistoryRow[];
  }

  const db = await getSqliteDb();
  return db.all<NegotiationHistoryRow[]>(
    `SELECT * FROM negotiation_history WHERE status = 'pending' ORDER BY created_at ASC`,
  );
};

/**
 * Get negotiations by status
 */
export const getNegotiationsByStatus = async (
  status: string,
  limit = 100
): Promise<NegotiationHistoryRow[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(
      `SELECT * FROM negotiation_history WHERE status = $1 ORDER BY created_at DESC LIMIT $2`,
      [status, limit],
    );
    return res.rows as NegotiationHistoryRow[];
  }

  const db = await getSqliteDb();
  return db.all<NegotiationHistoryRow[]>(
    `SELECT * FROM negotiation_history WHERE status = ? ORDER BY created_at DESC LIMIT ?`,
    [status, limit],
  );
};

/**
 * Cancel a negotiation
 */
export const cancelNegotiation = async (negotiationId: number): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `UPDATE negotiation_history SET status = 'cancelled', responded_at = NOW() WHERE id = $1`,
      [negotiationId],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `UPDATE negotiation_history SET status = 'cancelled', responded_at = datetime('now') WHERE id = ?`,
    [negotiationId],
  );
};
