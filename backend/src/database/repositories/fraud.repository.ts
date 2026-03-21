/**
 * Fraud Repository
 * 
 * Database operations for fraud detection tables:
 * - fraud_flags
 * - seller_watchlist
 * - fraud_analysis_history
 * - fraud_thresholds
 */

import { getSqliteDb, getPgPool, usingPostgres } from '../connection.js';
import type { FraudFlagRow, SellerWatchlistRow, FraudAnalysisHistoryRow, FraudThresholdsRow } from '../types.js';

export interface FraudFlagInput {
  adUrl: string;
  adTitle: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  flags: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    evidence: string;
  }>;
}

export interface WatchlistInput {
  sellerIdentifier: string;
  reason: string;
  riskScore: number;
  expiresAt?: string;
  notes?: string;
}

/**
 * Save a fraud flag
 */
export const saveFraudFlag = async (input: FraudFlagInput): Promise<void> => {
  const now = new Date().toISOString();

  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO fraud_flags (ad_url, ad_title, risk_level, risk_score, flags, detected_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [input.adUrl, input.adTitle, input.riskLevel, input.riskScore, JSON.stringify(input.flags), now],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `INSERT INTO fraud_flags (ad_url, ad_title, risk_level, risk_score, flags, detected_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [input.adUrl, input.adTitle, input.riskLevel, input.riskScore, JSON.stringify(input.flags), now],
  );
};

/**
 * Get fraud flags
 */
export const getFraudFlags = async (adUrl?: string, unresolvedOnly = true): Promise<FraudFlagRow[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    if (adUrl) {
      const res = await pool.query(
        `SELECT * FROM fraud_flags WHERE ad_url = $1 ORDER BY detected_at DESC`,
        [adUrl],
      );
      return res.rows as FraudFlagRow[];
    }
    if (unresolvedOnly) {
      const res = await pool.query(
        `SELECT * FROM fraud_flags WHERE is_resolved = FALSE ORDER BY risk_score DESC, detected_at DESC`,
      );
      return res.rows as FraudFlagRow[];
    }
    const res = await pool.query(`SELECT * FROM fraud_flags ORDER BY risk_score DESC, detected_at DESC`);
    return res.rows as FraudFlagRow[];
  }

  const db = await getSqliteDb();
  if (adUrl) {
    return db.all<FraudFlagRow[]>(
      `SELECT * FROM fraud_flags WHERE ad_url = ? ORDER BY detected_at DESC`,
      [adUrl],
    );
  }
  if (unresolvedOnly) {
    return db.all<FraudFlagRow[]>(
      `SELECT * FROM fraud_flags WHERE is_resolved = 0 ORDER BY risk_score DESC, detected_at DESC`,
    );
  }
  return db.all<FraudFlagRow[]>(`SELECT * FROM fraud_flags ORDER BY risk_score DESC, detected_at DESC`);
};

/**
 * Resolve a fraud flag
 */
export const resolveFraudFlag = async (fraudId: number): Promise<void> => {
  const now = new Date().toISOString();

  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `UPDATE fraud_flags SET is_resolved = TRUE, resolved_at = $1 WHERE id = $2`,
      [now, fraudId],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `UPDATE fraud_flags SET is_resolved = 1, resolved_at = ? WHERE id = ?`,
    [now, fraudId],
  );
};

/**
 * Add seller to watchlist
 */
export const addToWatchlist = async (input: WatchlistInput): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO seller_watchlist (seller_identifier, reason, risk_score, expires_at, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (seller_identifier) DO UPDATE SET
       risk_score = EXCLUDED.risk_score,
       incident_count = seller_watchlist.incident_count + 1,
       notes = EXCLUDED.notes,
       is_active = TRUE`,
      [input.sellerIdentifier, input.reason, input.riskScore, input.expiresAt || null, input.notes || null],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `INSERT INTO seller_watchlist (seller_identifier, reason, risk_score, expires_at, notes)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (seller_identifier) DO UPDATE SET
     risk_score = excluded.risk_score,
     incident_count = seller_watchlist.incident_count + 1,
     notes = excluded.notes,
     is_active = 1`,
    [input.sellerIdentifier, input.reason, input.riskScore, input.expiresAt || null, input.notes || null],
  );
};

/**
 * Get watchlist
 */
export const getWatchlist = async (isActiveOnly = true): Promise<SellerWatchlistRow[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    if (isActiveOnly) {
      const res = await pool.query(
        `SELECT * FROM seller_watchlist WHERE is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY risk_score DESC`,
      );
      return res.rows as SellerWatchlistRow[];
    }
    const res = await pool.query(`SELECT * FROM seller_watchlist ORDER BY risk_score DESC`);
    return res.rows as SellerWatchlistRow[];
  }

  const db = await getSqliteDb();
  if (isActiveOnly) {
    return db.all<SellerWatchlistRow[]>(
      `SELECT * FROM seller_watchlist WHERE is_active = 1 AND (expires_at IS NULL OR expires_at > datetime('now'))
       ORDER BY risk_score DESC`,
    );
  }
  return db.all<SellerWatchlistRow[]>(`SELECT * FROM seller_watchlist ORDER BY risk_score DESC`);
};

/**
 * Check if seller is on watchlist
 */
export const isSellerOnWatchlist = async (sellerIdentifier: string): Promise<boolean> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(
      `SELECT 1 FROM seller_watchlist
       WHERE seller_identifier = $1 AND is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())`,
      [sellerIdentifier],
    );
    return res.rows.length > 0;
  }

  const db = await getSqliteDb();
  const row = await db.get(
    `SELECT 1 FROM seller_watchlist
     WHERE seller_identifier = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > datetime('now'))`,
    [sellerIdentifier],
  );
  return !!row;
};

/**
 * Remove seller from watchlist
 */
export const removeFromWatchlist = async (sellerIdentifier: string): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `UPDATE seller_watchlist SET is_active = FALSE WHERE seller_identifier = $1`,
      [sellerIdentifier],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `UPDATE seller_watchlist SET is_active = 0 WHERE seller_identifier = ?`,
    [sellerIdentifier],
  );
};

/**
 * Save fraud analysis
 */
export const saveFraudAnalysis = async (
  matchKey: string,
  offerUrl: string,
  demandUrl: string,
  riskLevel: string,
  riskScore: number,
  flags: any[],
  recommendation: string
): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO fraud_analysis_history 
       (match_key, offer_url, demand_url, risk_level, risk_score, flags, recommendation, analyzed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [matchKey, offerUrl, demandUrl, riskLevel, riskScore, JSON.stringify(flags), recommendation],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `INSERT INTO fraud_analysis_history 
     (match_key, offer_url, demand_url, risk_level, risk_score, flags, recommendation, analyzed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [matchKey, offerUrl, demandUrl, riskLevel, riskScore, JSON.stringify(flags), recommendation],
  );
};

/**
 * Get fraud analysis history
 */
export const getFraudAnalysisHistory = async (matchKey?: string, limit = 50): Promise<FraudAnalysisHistoryRow[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    if (matchKey) {
      const res = await pool.query(
        `SELECT * FROM fraud_analysis_history WHERE match_key = $1 ORDER BY analyzed_at DESC LIMIT $2`,
        [matchKey, limit],
      );
      return res.rows as FraudAnalysisHistoryRow[];
    }
    const res = await pool.query(
      `SELECT * FROM fraud_analysis_history ORDER BY analyzed_at DESC LIMIT $1`,
      [limit],
    );
    return res.rows as FraudAnalysisHistoryRow[];
  }

  const db = await getSqliteDb();
  if (matchKey) {
    return db.all<FraudAnalysisHistoryRow[]>(
      `SELECT * FROM fraud_analysis_history WHERE match_key = ? ORDER BY analyzed_at DESC LIMIT ?`,
      [matchKey, limit],
    );
  }
  return db.all<FraudAnalysisHistoryRow[]>(
    `SELECT * FROM fraud_analysis_history ORDER BY analyzed_at DESC LIMIT ?`,
    [limit],
  );
};

/**
 * Get fraud analysis stats
 */
export const getFraudAnalysisStats = async (): Promise<{
  total: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
  resolved: number;
}> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE risk_level = 'low') as low,
        COUNT(*) FILTER (WHERE risk_level = 'medium') as medium,
        COUNT(*) FILTER (WHERE risk_level = 'high') as high,
        COUNT(*) FILTER (WHERE risk_level = 'critical') as critical,
        COUNT(*) FILTER (WHERE is_resolved = true) as resolved
      FROM fraud_analysis_history
    `);
    const row = res.rows[0] as any;
    return {
      total: parseInt(row.total || '0', 10),
      low: parseInt(row.low || '0', 10),
      medium: parseInt(row.medium || '0', 10),
      high: parseInt(row.high || '0', 10),
      critical: parseInt(row.critical || '0', 10),
      resolved: parseInt(row.resolved || '0', 10),
    };
  }

  const db = await getSqliteDb();
  const row = await db.get<any>(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN risk_level = 'low' THEN 1 ELSE 0 END) as low,
      SUM(CASE WHEN risk_level = 'medium' THEN 1 ELSE 0 END) as medium,
      SUM(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END) as high,
      SUM(CASE WHEN risk_level = 'critical' THEN 1 ELSE 0 END) as critical,
      SUM(CASE WHEN is_resolved = 1 THEN 1 ELSE 0 END) as resolved
    FROM fraud_analysis_history
  `);
  return {
    total: row?.total || 0,
    low: row?.low || 0,
    medium: row?.medium || 0,
    high: row?.high || 0,
    critical: row?.critical || 0,
    resolved: row?.resolved || 0,
  };
};

/**
 * Save fraud thresholds
 */
export const saveFraudThresholds = async (thresholds: {
  lowRiskMax: number;
  mediumRiskMax: number;
  highRiskMax: number;
  criticalRiskMin: number;
  autoWatchlistThreshold: number;
  enabled: boolean;
}): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO fraud_thresholds (id, low_risk_max, medium_risk_max, high_risk_max, critical_risk_min, auto_watchlist_threshold, enabled, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (id) DO UPDATE SET
       low_risk_max = EXCLUDED.low_risk_max,
       medium_risk_max = EXCLUDED.medium_risk_max,
       high_risk_max = EXCLUDED.high_risk_max,
       critical_risk_min = EXCLUDED.critical_risk_min,
       auto_watchlist_threshold = EXCLUDED.auto_watchlist_threshold,
       enabled = EXCLUDED.enabled,
       updated_at = NOW()`,
      [thresholds.lowRiskMax, thresholds.mediumRiskMax, thresholds.highRiskMax, thresholds.criticalRiskMin, thresholds.autoWatchlistThreshold, thresholds.enabled ? 1 : 0],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `INSERT INTO fraud_thresholds (id, low_risk_max, medium_risk_max, high_risk_max, critical_risk_min, auto_watchlist_threshold, enabled, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
     low_risk_max = excluded.low_risk_max,
     medium_risk_max = excluded.medium_risk_max,
     high_risk_max = excluded.high_risk_max,
     critical_risk_min = excluded.critical_risk_min,
     auto_watchlist_threshold = excluded.auto_watchlist_threshold,
     enabled = excluded.enabled,
     updated_at = excluded.updated_at`,
    [thresholds.lowRiskMax, thresholds.mediumRiskMax, thresholds.highRiskMax, thresholds.criticalRiskMin, thresholds.autoWatchlistThreshold, thresholds.enabled ? 1 : 0],
  );
};

/**
 * Get fraud thresholds
 */
export const getFraudThresholds = async (): Promise<FraudThresholdsRow | null> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(`SELECT * FROM fraud_thresholds WHERE id = 1`);
    const row = (res.rows as FraudThresholdsRow[])[0];
    return row !== undefined ? row : null;
  }

  const db = await getSqliteDb();
  const row = await db.get<FraudThresholdsRow>(`SELECT * FROM fraud_thresholds WHERE id = 1`);
  return row !== undefined ? row : null;
};

/**
 * Get risk level from score
 */
export const getRiskLevel = (score: number): 'low' | 'medium' | 'high' | 'critical' => {
  if (score < 25) return 'low';
  if (score < 50) return 'medium';
  if (score < 80) return 'high';
  return 'critical';
};
