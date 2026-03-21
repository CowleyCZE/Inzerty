/**
 * Analytics Repository
 * 
 * Database operations for analytics tables:
 * - deal_analytics
 */

import { getSqliteDb, getPgPool, usingPostgres } from '../connection.js';
import type { DealAnalyticsRow } from '../types.js';

export interface DealAnalyticsInput {
  matchKey: string;
  initialProfit: number;
  finalProfit?: number;
  timeToCloseHours?: number;
  negotiationCount?: number;
  followupCount?: number;
  successRate?: number;
}

/**
 * Save deal analytics
 */
export const saveDealAnalytics = async (input: DealAnalyticsInput): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO deal_analytics 
       (match_key, initial_profit, final_profit, time_to_close_hours, negotiation_count, followup_count, success_rate, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (match_key) DO UPDATE SET
       initial_profit = EXCLUDED.initial_profit,
       final_profit = EXCLUDED.final_profit,
       time_to_close_hours = EXCLUDED.time_to_close_hours,
       negotiation_count = EXCLUDED.negotiation_count,
       followup_count = EXCLUDED.followup_count,
       success_rate = EXCLUDED.success_rate,
       updated_at = NOW()`,
      [
        input.matchKey,
        input.initialProfit,
        input.finalProfit || null,
        input.timeToCloseHours || null,
        input.negotiationCount || 0,
        input.followupCount || 0,
        input.successRate || null,
      ],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `INSERT INTO deal_analytics 
     (match_key, initial_profit, final_profit, time_to_close_hours, negotiation_count, followup_count, success_rate, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(match_key) DO UPDATE SET
     initial_profit = excluded.initial_profit,
     final_profit = excluded.final_profit,
     time_to_close_hours = excluded.time_to_close_hours,
     negotiation_count = excluded.negotiation_count,
     followup_count = excluded.followup_count,
     success_rate = excluded.success_rate`,
    [
      input.matchKey,
      input.initialProfit,
      input.finalProfit || null,
      input.timeToCloseHours || null,
      input.negotiationCount || 0,
      input.followupCount || 0,
      input.successRate || null,
    ],
  );
};

/**
 * Get all analytics
 */
export const getAnalytics = async (): Promise<{
  total_deals: number;
  closed_deals: number;
  avg_profit: number;
  avg_time_to_close: number;
  total_revenue: number;
  avg_success_rate: number;
}> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(`
      SELECT
        COUNT(*) as total_deals,
        COUNT(*) FILTER (WHERE closed_at IS NOT NULL) as closed_deals,
        AVG(final_profit) FILTER (WHERE closed_at IS NOT NULL) as avg_profit,
        AVG(time_to_close_hours) FILTER (WHERE closed_at IS NOT NULL) as avg_time_to_close,
        SUM(final_profit) FILTER (WHERE closed_at IS NOT NULL AND final_profit > 0) as total_revenue,
        AVG(success_rate) FILTER (WHERE closed_at IS NOT NULL) as avg_success_rate
      FROM deal_analytics
    `);
    const row = res.rows[0] as any;
    return {
      total_deals: parseInt(row.total_deals || '0', 10),
      closed_deals: parseInt(row.closed_deals || '0', 10),
      avg_profit: parseFloat(row.avg_profit || '0'),
      avg_time_to_close: parseFloat(row.avg_time_to_close || '0'),
      total_revenue: parseFloat(row.total_revenue || '0'),
      avg_success_rate: parseFloat(row.avg_success_rate || '0'),
    };
  }

  const db = await getSqliteDb();
  const row = await db.get<any>(`
    SELECT
      COUNT(*) as total_deals,
      COUNT(*) FILTER (WHERE closed_at IS NOT NULL) as closed_deals,
      AVG(final_profit) FILTER (WHERE closed_at IS NOT NULL) as avg_profit,
      AVG(time_to_close_hours) FILTER (WHERE closed_at IS NOT NULL) as avg_time_to_close,
      SUM(final_profit) FILTER (WHERE closed_at IS NOT NULL AND final_profit > 0) as total_revenue,
      AVG(success_rate) FILTER (WHERE closed_at IS NOT NULL) as avg_success_rate
    FROM deal_analytics
  `);
  return {
    total_deals: row?.total_deals || 0,
    closed_deals: row?.closed_deals || 0,
    avg_profit: parseFloat(row?.avg_profit || '0'),
    avg_time_to_close: parseFloat(row?.avg_time_to_close || '0'),
    total_revenue: parseFloat(row?.total_revenue || '0'),
    avg_success_rate: parseFloat(row?.avg_success_rate || '0'),
  };
};

/**
 * Get analytics by period
 */
export const getAnalyticsByPeriod = async (days: number = 30): Promise<DealAnalyticsRow[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(
      `SELECT * FROM deal_analytics
       WHERE closed_at >= NOW() - INTERVAL '${days} days'
       ORDER BY closed_at DESC`,
    );
    return res.rows as DealAnalyticsRow[];
  }

  const db = await getSqliteDb();
  return db.all<DealAnalyticsRow[]>(
    `SELECT * FROM deal_analytics
     WHERE closed_at >= datetime('now', '-' || ? || ' days')
     ORDER BY closed_at DESC`,
    [days],
  );
};

/**
 * Update deal as closed
 */
export const closeDeal = async (
  matchKey: string,
  finalProfit: number,
  timeToCloseHours: number,
  successRate: number
): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `UPDATE deal_analytics SET
       final_profit = $1,
       time_to_close_hours = $2,
       success_rate = $3,
       closed_at = NOW()
       WHERE match_key = $4`,
      [finalProfit, timeToCloseHours, successRate, matchKey],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `UPDATE deal_analytics SET
     final_profit = ?,
     time_to_close_hours = ?,
     success_rate = ?,
     closed_at = datetime('now')
     WHERE match_key = ?`,
    [finalProfit, timeToCloseHours, successRate, matchKey],
  );
};

/**
 * Increment negotiation count
 */
export const incrementNegotiationCount = async (matchKey: string): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `UPDATE deal_analytics SET negotiation_count = negotiation_count + 1 WHERE match_key = $1`,
      [matchKey],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `UPDATE deal_analytics SET negotiation_count = negotiation_count + 1 WHERE match_key = ?`,
    [matchKey],
  );
};

/**
 * Increment followup count
 */
export const incrementFollowupCount = async (matchKey: string): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `UPDATE deal_analytics SET followup_count = followup_count + 1 WHERE match_key = $1`,
      [matchKey],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `UPDATE deal_analytics SET followup_count = followup_count + 1 WHERE match_key = ?`,
    [matchKey],
  );
};
