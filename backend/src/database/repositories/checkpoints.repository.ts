/**
 * Checkpoints Repository
 * 
 * Database operations for scrape checkpoints
 */

import { getSqliteDb, getPgPool, usingPostgres } from '../connection.js';
import type { ScrapeCheckpointRow } from '../types.js';

/**
 * Get scrape checkpoint
 */
export const getScrapeCheckpoint = async (
  brand: string,
  adType: string
): Promise<{ lastSeenUrl: string | null; lastSeenDate: string | null } | null> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query(
      'SELECT last_seen_url, last_seen_date FROM scrape_checkpoints WHERE brand = $1 AND ad_type = $2',
      [brand, adType],
    ) as { rows: Array<{ last_seen_url: string | null; last_seen_date: string | null }> };

    if (res.rows.length === 0) return null;
    return {
      lastSeenUrl: res.rows[0]?.last_seen_url ?? null,
      lastSeenDate: res.rows[0]?.last_seen_date ?? null,
    };
  }

  const db = await getSqliteDb();
  const row = await db.get<{ last_seen_url: string | null; last_seen_date: string | null }>(
    'SELECT last_seen_url, last_seen_date FROM scrape_checkpoints WHERE brand = ? AND ad_type = ?',
    [brand, adType],
  );
  
  if (!row) return null;

  return {
    lastSeenUrl: row.last_seen_url,
    lastSeenDate: row.last_seen_date,
  };
};

/**
 * Update scrape checkpoint
 */
export const updateScrapeCheckpoint = async (
  brand: string,
  adType: string,
  lastSeenUrl: string | null,
  lastSeenDate: string | null
): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO scrape_checkpoints (brand, ad_type, last_seen_url, last_seen_date, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (brand, ad_type) DO UPDATE SET
         last_seen_url = excluded.last_seen_url,
         last_seen_date = excluded.last_seen_date,
         updated_at = NOW()`,
      [brand, adType, lastSeenUrl, lastSeenDate],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `INSERT INTO scrape_checkpoints (brand, ad_type, last_seen_url, last_seen_date, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(brand, ad_type) DO UPDATE SET
        last_seen_url = excluded.last_seen_url,
        last_seen_date = excluded.last_seen_date,
        updated_at = excluded.updated_at`,
    [brand, adType, lastSeenUrl, lastSeenDate, new Date().toISOString()],
  );
};

/**
 * Get all checkpoints
 */
export const getAllCheckpoints = async (): Promise<ScrapeCheckpointRow[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query('SELECT * FROM scrape_checkpoints ORDER BY brand, ad_type');
    return res.rows as ScrapeCheckpointRow[];
  }

  const db = await getSqliteDb();
  return db.all<ScrapeCheckpointRow[]>('SELECT * FROM scrape_checkpoints ORDER BY brand, ad_type');
};

/**
 * Delete checkpoint
 */
export const deleteCheckpoint = async (brand: string, adType: string): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query(
      'DELETE FROM scrape_checkpoints WHERE brand = $1 AND ad_type = $2',
      [brand, adType],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    'DELETE FROM scrape_checkpoints WHERE brand = ? AND ad_type = ?',
    [brand, adType],
  );
};

/**
 * Clear all checkpoints
 */
export const clearAllCheckpoints = async (): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query('DELETE FROM scrape_checkpoints');
    return;
  }

  const db = await getSqliteDb();
  await db.run('DELETE FROM scrape_checkpoints');
};
