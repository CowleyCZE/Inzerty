/**
 * Negotiation Patterns Repository
 * 
 * Database operations for negotiation_patterns table
 */

import { getSqliteDb, getPgPool, usingPostgres } from '../connection.js';
import type { NegotiationPatternRow } from '../types.js';

export interface NegotiationPatternInput {
  patternType: 'opening_offer' | 'counter_offer' | 'final_offer' | 'acceptance' | 'rejection';
  patternData: any;
  successRate?: number;
  usageCount?: number;
}

/**
 * Save negotiation pattern
 */
export const saveNegotiationPattern = async (input: NegotiationPatternInput): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO negotiation_patterns (pattern_type, pattern_data, success_rate, usage_count, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (pattern_type) DO UPDATE SET
       pattern_data = EXCLUDED.pattern_data,
       success_rate = EXCLUDED.success_rate,
       usage_count = negotiation_patterns.usage_count + 1,
       updated_at = NOW()`,
      [
        input.patternType,
        input.patternData ? JSON.stringify(input.patternData) : null,
        input.successRate || 0,
        input.usageCount || 0,
      ],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `INSERT INTO negotiation_patterns (pattern_type, pattern_data, success_rate, usage_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT(pattern_type) DO UPDATE SET
     pattern_data = excluded.pattern_data,
     success_rate = excluded.success_rate,
     usage_count = negotiation_patterns.usage_count + 1,
     updated_at = excluded.updated_at`,
    [
      input.patternType,
      input.patternData ? JSON.stringify(input.patternData) : null,
      input.successRate || 0,
      input.usageCount || 0,
    ],
  );
};

/**
 * Get negotiation patterns
 */
export const getNegotiationPatterns = async (
  patternType?: string
): Promise<NegotiationPatternRow[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    if (patternType) {
      const res = await pool.query(
        `SELECT * FROM negotiation_patterns WHERE pattern_type = $1`,
        [patternType],
      );
      return res.rows as NegotiationPatternRow[];
    }
    const res = await pool.query(
      `SELECT * FROM negotiation_patterns ORDER BY success_rate DESC`,
    );
    return res.rows as NegotiationPatternRow[];
  }

  const db = await getSqliteDb();
  if (patternType) {
    return db.all<NegotiationPatternRow[]>(
      `SELECT * FROM negotiation_patterns WHERE pattern_type = ?`,
      [patternType],
    );
  }
  return db.all<NegotiationPatternRow[]>(
    `SELECT * FROM negotiation_patterns ORDER BY success_rate DESC`,
  );
};

/**
 * Get pattern by type
 */
export const getNegotiationPattern = async (
  patternType: string
): Promise<NegotiationPatternRow | null> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(
      `SELECT * FROM negotiation_patterns WHERE pattern_type = $1`,
      [patternType],
    );
    const row = (res.rows as NegotiationPatternRow[])[0];
    return row !== undefined ? row : null;
  }

  const db = await getSqliteDb();
  const row = await db.get<NegotiationPatternRow>(
    `SELECT * FROM negotiation_patterns WHERE pattern_type = ?`,
    [patternType],
  );
  return row !== undefined ? row : null;
};

/**
 * Update pattern usage
 */
export const updatePatternUsage = async (
  patternType: string,
  wasSuccessful: boolean
): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `UPDATE negotiation_patterns 
       SET usage_count = usage_count + 1,
           success_rate = (
             CASE 
               WHEN usage_count = 0 THEN ${wasSuccessful ? 100 : 0}
               ELSE ((success_rate * usage_count) + ${wasSuccessful ? 100 : 0}) / (usage_count + 1)
             END
           ),
           updated_at = NOW()
       WHERE pattern_type = $1`,
      [patternType],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `UPDATE negotiation_patterns 
     SET usage_count = usage_count + 1,
         success_rate = (
           CASE 
             WHEN usage_count = 0 THEN ${wasSuccessful ? 100 : 0}
             ELSE ((success_rate * usage_count) + ${wasSuccessful ? 100 : 0}) / (usage_count + 1)
           END
         ),
         updated_at = datetime('now')
     WHERE pattern_type = ?`,
    [patternType],
  );
};

/**
 * Get most successful patterns
 */
export const getMostSuccessfulPatterns = async (
  minUsageCount = 10,
  limit = 10
): Promise<NegotiationPatternRow[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(
      `SELECT * FROM negotiation_patterns 
       WHERE usage_count >= $1 
       ORDER BY success_rate DESC, usage_count DESC 
       LIMIT $2`,
      [minUsageCount, limit],
    );
    return res.rows as NegotiationPatternRow[];
  }

  const db = await getSqliteDb();
  return db.all<NegotiationPatternRow[]>(
    `SELECT * FROM negotiation_patterns 
     WHERE usage_count >= ? 
     ORDER BY success_rate DESC, usage_count DESC 
     LIMIT ?`,
    [minUsageCount, limit],
  );
};

/**
 * Delete negotiation pattern
 */
export const deleteNegotiationPattern = async (
  patternType: string
): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `DELETE FROM negotiation_patterns WHERE pattern_type = $1`,
      [patternType],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `DELETE FROM negotiation_patterns WHERE pattern_type = ?`,
    [patternType],
  );
};

/**
 * Get pattern statistics
 */
export const getPatternStats = async (): Promise<{
  totalPatterns: number;
  avgSuccessRate: number;
  totalUsageCount: number;
  byType: Record<string, { count: number; avgSuccessRate: number }>;
}> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(`
      SELECT
        COUNT(*) as total_patterns,
        AVG(success_rate) as avg_success_rate,
        SUM(usage_count) as total_usage_count
      FROM negotiation_patterns
    `);
    const row = res.rows[0] as any;
    
    const byTypeRes = await pool.query(`
      SELECT
        pattern_type,
        COUNT(*) as count,
        AVG(success_rate) as avg_success_rate
      FROM negotiation_patterns
      GROUP BY pattern_type
    `);
    
    const byType: Record<string, { count: number; avgSuccessRate: number }> = {};
    for (const typeRow of byTypeRes.rows) {
      byType[typeRow.pattern_type] = {
        count: parseInt(typeRow.count || '0', 10),
        avgSuccessRate: parseFloat(typeRow.avg_success_rate || '0'),
      };
    }
    
    return {
      totalPatterns: parseInt(row.total_patterns || '0', 10),
      avgSuccessRate: parseFloat(row.avg_success_rate || '0'),
      totalUsageCount: parseInt(row.total_usage_count || '0', 10),
      byType,
    };
  }

  const db = await getSqliteDb();
  const row = await db.get<any>(`
    SELECT
      COUNT(*) as total_patterns,
      AVG(success_rate) as avg_success_rate,
      SUM(usage_count) as total_usage_count
    FROM negotiation_patterns
  `);
  
  const byTypeRows = await db.all<any>(`
    SELECT
      pattern_type,
      COUNT(*) as count,
      AVG(success_rate) as avg_success_rate
    FROM negotiation_patterns
    GROUP BY pattern_type
  `);
  
  const byType: Record<string, { count: number; avgSuccessRate: number }> = {};
  for (const typeRow of byTypeRows) {
    byType[typeRow.pattern_type] = {
      count: typeRow.count || 0,
      avgSuccessRate: parseFloat(typeRow.avg_success_rate || '0'),
    };
  }
  
  return {
    totalPatterns: row?.total_patterns || 0,
    avgSuccessRate: parseFloat(row?.avg_success_rate || '0'),
    totalUsageCount: row?.total_usage_count || 0,
    byType,
  };
};
