/**
 * Ads Repository
 * 
 * Database operations for the 'ads' table
 */

import { getSqliteDb, getPgPool, usingPostgres } from '../connection.js';
import type { AdRow } from '../types.js';

export interface AdInput {
  id: string;
  title: string;
  price: string;
  link?: string | undefined;
  url?: string | undefined;
  date_posted: string;
  brand: string;
  ad_type: string;
  scraped_at: string;
  description?: string | undefined;
  location?: string | undefined;
  image_url?: string | undefined;
  source?: string | undefined;
  external_id?: string | undefined;
  posted_at?: string | undefined;
  seller?: Record<string, any> | undefined;
  metadata?: Record<string, any> | undefined;
}

/**
 * Save an ad to the database
 */
export const saveAd = async (ad: AdInput): Promise<boolean> => {
  const rawPrice = ad.price ? parseFloat(ad.price.replace(/[^0-9,-]+/g, '').replace(',', '.')) : null;
  const safePriceValue = rawPrice !== null && !isNaN(rawPrice) ? rawPrice : null;

  const source = ad.source || 'bazos_cz';
  const externalId = ad.external_id || ad.id;
  const postedAt = ad.posted_at || ad.date_posted;
  const sellerInfo = ad.seller ? JSON.stringify(ad.seller) : null;
  const metadata = ad.metadata ? JSON.stringify(ad.metadata) : null;

  if (usingPostgres()) {
    const pool = getPgPool();
    const result = await pool.query(
      `INSERT INTO ads (id, title, price, price_value, location, description, date_posted, url, image_url, ad_type, brand, scraped_at, model_ai, embedding, source, external_id, posted_at, seller_info, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       ON CONFLICT (url, ad_type) DO UPDATE SET
         source = EXCLUDED.source,
         seller_info = EXCLUDED.seller_info,
         metadata = EXCLUDED.metadata,
         scraped_at = EXCLUDED.scraped_at
       RETURNING id`,
      [
        ad.id,
        ad.title,
        ad.price,
        safePriceValue,
        ad.location || null,
        ad.description || null,
        ad.date_posted,
        ad.link || ad.url,
        ad.image_url || '',
        ad.ad_type,
        ad.brand,
        ad.scraped_at,
        '',
        null,
        source,
        externalId,
        postedAt,
        sellerInfo,
        metadata,
      ],
    );
    return result.rowCount > 0;
  }

  const db = await getSqliteDb();
  const result = await db.run(
    `INSERT OR IGNORE INTO ads (id, title, price, price_value, location, description, date_posted, url, image_url, ad_type, brand, scraped_at, model_ai, embedding, source, external_id, posted_at, seller_info, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ad.id,
      ad.title,
      ad.price,
      safePriceValue,
      ad.location || null,
      ad.description || null,
      ad.date_posted,
      ad.link || ad.url,
      ad.image_url || '',
      ad.ad_type,
      ad.brand,
      ad.scraped_at,
      '',
      null,
      source,
      externalId,
      postedAt,
      sellerInfo,
      metadata,
    ],
  );
  return (result.changes ?? 0) > 0;
};

/**
 * Get all ads ordered by scraped_at
 */
export const getAllAds = async (limit = 1000): Promise<AdRow[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query('SELECT * FROM ads ORDER BY scraped_at DESC LIMIT $1', [limit]);
    return res.rows as AdRow[];
  }

  const db = await getSqliteDb();
  return db.all<AdRow[]>('SELECT * FROM ads ORDER BY scraped_at DESC LIMIT ?', [limit]);
};

/**
 * Get ads by type (nabidka/poptavka)
 */
export const getAdsByType = async (adType: string, limit = 1000): Promise<AdRow[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query('SELECT * FROM ads WHERE ad_type = $1 ORDER BY scraped_at DESC LIMIT $2', [adType, limit]);
    return res.rows as AdRow[];
  }

  const db = await getSqliteDb();
  return db.all<AdRow[]>('SELECT * FROM ads WHERE ad_type = ? ORDER BY scraped_at DESC LIMIT ?', [adType, limit]);
};

/**
 * Get recent scraped URLs for a brand and type
 */
export const getRecentScrapedUrls = async (brand: string, adType: string, limit = 10): Promise<string[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query('SELECT url FROM ads WHERE brand = $1 AND ad_type = $2 ORDER BY scraped_at DESC LIMIT $3', [brand, adType, limit]);
    return (res.rows as Array<{ url: string }>).map((r: { url: string }) => r.url);
  }

  const db = await getSqliteDb();
  const rows = await db.all<{ url: string }[]>('SELECT url FROM ads WHERE brand = ? AND ad_type = ? ORDER BY scraped_at DESC LIMIT ?', [brand, adType, limit]);
  return rows.map((r) => r.url);
};

/**
 * Update ad model_ai field
 */
export const updateAdModelAi = async (id: string, model: string): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query('UPDATE ads SET model_ai = $1 WHERE id = $2', [model, id]);
    return;
  }

  const db = await getSqliteDb();
  await db.run('UPDATE ads SET model_ai = ? WHERE id = ?', [model, id]);
};

/**
 * Update ad embedding field
 */
export const updateAdEmbedding = async (id: string, embedding: string): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query('UPDATE ads SET embedding = $1 WHERE id = $2', [embedding, id]);
    return;
  }

  const db = await getSqliteDb();
  await db.run('UPDATE ads SET embedding = ? WHERE id = ?', [embedding, id]);
};

/**
 * Get ads by brand
 */
export const getAdsByBrand = async (brand: string, adType?: string, limit = 1000): Promise<AdRow[]> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    if (adType) {
      const res = await pool.query('SELECT * FROM ads WHERE brand = $1 AND ad_type = $2 ORDER BY scraped_at DESC LIMIT $3', [brand, adType, limit]);
      return res.rows as AdRow[];
    }
    const res = await pool.query('SELECT * FROM ads WHERE brand = $1 ORDER BY scraped_at DESC LIMIT $2', [brand, limit]);
    return res.rows as AdRow[];
  }

  const db = await getSqliteDb();
  if (adType) {
    return db.all<AdRow[]>('SELECT * FROM ads WHERE brand = ? AND ad_type = ? ORDER BY scraped_at DESC LIMIT ?', [brand, adType, limit]);
  }
  return db.all<AdRow[]>('SELECT * FROM ads WHERE brand = ? ORDER BY scraped_at DESC LIMIT ?', [brand, limit]);
};

/**
 * Get ad by URL
 */
export const getAdByUrl = async (url: string): Promise<AdRow | null> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query('SELECT * FROM ads WHERE url = $1', [url]);
    const row = (res.rows as AdRow[])[0];
    return row !== undefined ? row : null;
  }

  const db = await getSqliteDb();
  const row = await db.get<AdRow>('SELECT * FROM ads WHERE url = ?', [url]);
  return row !== undefined ? row : null;
};

/**
 * Get ad by ID
 */
export const getAdById = async (id: string): Promise<AdRow | null> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    const res = await pool.query('SELECT * FROM ads WHERE id = $1', [id]);
    const row = (res.rows as AdRow[])[0];
    return row !== undefined ? row : null;
  }

  const db = await getSqliteDb();
  const row = await db.get<AdRow>('SELECT * FROM ads WHERE id = ?', [id]);
  return row !== undefined ? row : null;
};

/**
 * Delete all ads
 */
export const deleteAllAds = async (): Promise<void> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    await pool.query('DELETE FROM ads');
    return;
  }

  const db = await getSqliteDb();
  await db.run('DELETE FROM ads');
};

/**
 * Get ads count
 */
export const getAdsCount = async (adType?: string): Promise<number> => {
  if (usingPostgres()) {
    const pool = getPgPool();
    if (adType) {
      const res = await pool.query('SELECT COUNT(*) as count FROM ads WHERE ad_type = $1', [adType]);
      return parseInt(res.rows[0]?.count || '0', 10);
    }
    const res = await pool.query('SELECT COUNT(*) as count FROM ads');
    return parseInt(res.rows[0]?.count || '0', 10);
  }

  const db = await getSqliteDb();
  if (adType) {
    const result = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM ads WHERE ad_type = ?', [adType]);
    return result?.count || 0;
  }
  const result = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM ads');
  return result?.count || 0;
};
