import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type DbClient = 'sqlite' | 'postgres';
const DB_CLIENT: DbClient = process.env.DB_CLIENT === 'postgres' ? 'postgres' : 'sqlite';

let sqliteDb: Database | null = null;
let postgresPool: any = null;
let isInitialized = false;
let pgVectorReady = false;

const getSqliteDb = async () => {
  if (sqliteDb) return sqliteDb;

  sqliteDb = await open({
    filename: path.join(__dirname, '..', 'inzerty.db'),
    driver: sqlite3.Database,
  });

  await sqliteDb.exec('PRAGMA foreign_keys = ON;');
  return sqliteDb;
};

const getPgPool = () => {
  if (postgresPool) return postgresPool;

  let Pool: any;
  try {
    ({ Pool } = require('pg'));
  } catch (error) {
    throw new Error('PostgreSQL mode requires the "pg" package to be installed.');
  }

  postgresPool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/inzerty',
  });
  return postgresPool;
};


const ensurePostgresColumns = async (pool: any) => {
  await pool.query('ALTER TABLE ads ADD COLUMN IF NOT EXISTS model_ai TEXT');
  await pool.query('ALTER TABLE ads ADD COLUMN IF NOT EXISTS embedding TEXT');
  await pool.query('ALTER TABLE ads ADD COLUMN IF NOT EXISTS price_value DOUBLE PRECISION');
  await pool.query('ALTER TABLE ads ADD COLUMN IF NOT EXISTS location TEXT');
  await pool.query('ALTER TABLE ads ADD COLUMN IF NOT EXISTS description TEXT');
  await pool.query('ALTER TABLE ads ADD COLUMN IF NOT EXISTS date_posted TEXT');
  await pool.query('ALTER TABLE ads ADD COLUMN IF NOT EXISTS image_url TEXT');
  await pool.query('ALTER TABLE ads ADD COLUMN IF NOT EXISTS ad_type TEXT');
  await pool.query('ALTER TABLE ads ADD COLUMN IF NOT EXISTS brand TEXT');
  await pool.query('ALTER TABLE ads ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ');
};

const ensureSqliteColumns = async (db: Database, tableName: string, requiredColumns: Array<{ name: string; ddl: string }>) => {
  const rows = await db.all<Array<{ name: string }>>(`PRAGMA table_info(${tableName})`);
  const existing = new Set(rows.map((r) => r.name));

  for (const column of requiredColumns) {
    if (!existing.has(column.name)) {
      await db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${column.ddl}`);
    }
  }
};

const ensurePostgresAdUniqueness = async (pool: any) => {
  await pool.query('ALTER TABLE ads DROP CONSTRAINT IF EXISTS ads_url_key');
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS ads_url_ad_type_unique_idx ON ads(url, ad_type)');
};

const rebuildSqliteAdsForCompositeUnique = async (db: Database) => {
  const indexRows = await db.all<Array<{ name: string; unique: number; origin: string }>>('PRAGMA index_list(ads)');
  const hasUrlOnlyUnique = indexRows.some((row) => row.unique === 1 && row.origin === 'u');
  if (!hasUrlOnlyUnique) return;

  await db.exec('PRAGMA foreign_keys = OFF;');
  await db.exec('BEGIN TRANSACTION;');
  try {
    await db.exec(`
      CREATE TABLE ads_new (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        price TEXT,
        price_value REAL,
        location TEXT,
        description TEXT,
        date_posted TEXT,
        url TEXT,
        image_url TEXT,
        ad_type TEXT,
        brand TEXT,
        scraped_at TEXT,
        model_ai TEXT,
        embedding TEXT,
        UNIQUE(url, ad_type)
      );
    `);

    await db.exec(`
      INSERT OR IGNORE INTO ads_new (id, title, price, price_value, location, description, date_posted, url, image_url, ad_type, brand, scraped_at, model_ai, embedding)
      SELECT id, title, price, price_value, location, description, date_posted, url, image_url, ad_type, brand, scraped_at, model_ai, embedding
      FROM ads
      ORDER BY scraped_at DESC
    `);

    await db.exec('DROP TABLE ads;');
    await db.exec('ALTER TABLE ads_new RENAME TO ads;');
    await db.exec('COMMIT;');
  } catch (error) {
    await db.exec('ROLLBACK;');
    throw error;
  } finally {
    await db.exec('PRAGMA foreign_keys = ON;');
  }
};

const ensureSqliteAdUniqueness = async (db: Database) => {
  await rebuildSqliteAdsForCompositeUnique(db);
  await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_ads_url_ad_type ON ads(url, ad_type)');
};

export const usingPostgres = () => DB_CLIENT === 'postgres';

export const initDb = async () => {
  if (isInitialized) return;

  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ads (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        price TEXT,
        price_value DOUBLE PRECISION,
        location TEXT,
        description TEXT,
        date_posted TEXT,
        url TEXT,
        image_url TEXT,
        ad_type TEXT,
        brand TEXT,
        scraped_at TIMESTAMPTZ,
        model_ai TEXT,
        embedding TEXT
      );

      CREATE TABLE IF NOT EXISTS matches (
        id BIGSERIAL PRIMARY KEY,
        offer_id TEXT,
        demand_id TEXT,
        similarity_score DOUBLE PRECISION,
        is_ai_match BOOLEAN,
        created_at TIMESTAMPTZ,
        UNIQUE(offer_id, demand_id),
        FOREIGN KEY(offer_id) REFERENCES ads(id),
        FOREIGN KEY(demand_id) REFERENCES ads(id)
      );

      CREATE TABLE IF NOT EXISTS scrape_checkpoints (
        brand TEXT NOT NULL,
        ad_type TEXT NOT NULL,
        last_seen_url TEXT,
        last_seen_date TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (brand, ad_type)
      );

      CREATE TABLE IF NOT EXISTS match_meta (
        match_key TEXT PRIMARY KEY,
        status TEXT,
        note TEXT,
        priority TEXT,
        last_action_at TEXT,
        resolved BOOLEAN DEFAULT FALSE,
        follow_up_at TEXT,
        follow_up_state TEXT,
        checklist_json TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await ensurePostgresColumns(pool);
    await ensurePostgresAdUniqueness(pool);

    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
      await pool.query('ALTER TABLE ads ADD COLUMN IF NOT EXISTS embedding_vector vector(2048)');
      pgVectorReady = true;
    } catch (error) {
      pgVectorReady = false;
      console.warn('pgvector extension is not available. Falling back to JS cosine similarity.', error);
    }

    isInitialized = true;
    console.log('PostgreSQL database initialized');
    return;
  }

  const db = await getSqliteDb();
  await db.exec(`
      CREATE TABLE IF NOT EXISTS ads (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        price TEXT,
        price_value REAL,
        location TEXT,
        description TEXT,
        date_posted TEXT,
        url TEXT,
        image_url TEXT,
        ad_type TEXT,
        brand TEXT,
        scraped_at TEXT,
        model_ai TEXT,
        embedding TEXT
      );

      CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        offer_id TEXT,
        demand_id TEXT,
        similarity_score REAL,
        is_ai_match BOOLEAN,
        created_at TEXT,
        UNIQUE(offer_id, demand_id),
        FOREIGN KEY(offer_id) REFERENCES ads(id),
        FOREIGN KEY(demand_id) REFERENCES ads(id)
      );

      CREATE TABLE IF NOT EXISTS scrape_checkpoints (
        brand TEXT NOT NULL,
        ad_type TEXT NOT NULL,
        last_seen_url TEXT,
        last_seen_date TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (brand, ad_type)
      );

      CREATE TABLE IF NOT EXISTS match_meta (
        match_key TEXT PRIMARY KEY,
        status TEXT,
        note TEXT,
        priority TEXT,
        last_action_at TEXT,
        resolved INTEGER DEFAULT 0,
        follow_up_at TEXT,
        follow_up_state TEXT,
        checklist_json TEXT,
        updated_at TEXT NOT NULL
      );
  `);

  await ensureSqliteColumns(db, 'ads', [
    { name: 'price_value', ddl: 'price_value REAL' },
    { name: 'location', ddl: 'location TEXT' },
    { name: 'description', ddl: 'description TEXT' },
    { name: 'date_posted', ddl: 'date_posted TEXT' },
    { name: 'image_url', ddl: 'image_url TEXT' },
    { name: 'ad_type', ddl: 'ad_type TEXT' },
    { name: 'brand', ddl: 'brand TEXT' },
    { name: 'scraped_at', ddl: 'scraped_at TEXT' },
    { name: 'model_ai', ddl: 'model_ai TEXT' },
    { name: 'embedding', ddl: 'embedding TEXT' },
  ]);

  await ensureSqliteAdUniqueness(db);

  await ensureSqliteColumns(db, 'match_meta', [
    { name: 'priority', ddl: 'priority TEXT' },
    { name: 'last_action_at', ddl: 'last_action_at TEXT' },
    { name: 'resolved', ddl: 'resolved INTEGER DEFAULT 0' },
    { name: 'follow_up_at', ddl: 'follow_up_at TEXT' },
    { name: 'follow_up_state', ddl: 'follow_up_state TEXT' },
    { name: 'checklist_json', ddl: 'checklist_json TEXT' },
    { name: 'updated_at', ddl: "updated_at TEXT NOT NULL DEFAULT ''" },
  ]);

  isInitialized = true;
  console.log('SQLite database initialized');
};

export const isPgVectorAvailable = () => usingPostgres() && pgVectorReady;

export const saveAd = async (ad: any): Promise<boolean> => {
  await initDb();

  const rawPrice = ad.price ? parseFloat(ad.price.replace(/[^0-9,-]+/g, '').replace(',', '.')) : null;
  const safePriceValue = rawPrice !== null && !isNaN(rawPrice) ? rawPrice : null;

  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    const result = await pool.query(
      `INSERT INTO ads (id, title, price, price_value, location, description, date_posted, url, image_url, ad_type, brand, scraped_at, model_ai, embedding)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (url, ad_type) DO NOTHING`,
      [
        ad.id,
        ad.title,
        ad.price,
        safePriceValue,
        ad.location,
        ad.description,
        ad.date_posted,
        ad.link,
        ad.image_url || '',
        ad.ad_type,
        ad.brand,
        ad.scraped_at,
        '',
        null,
      ],
    );
    return result.rowCount > 0;
  }

  const db = await getSqliteDb();
  const result = await db.run(
    `INSERT OR IGNORE INTO ads (id, title, price, price_value, location, description, date_posted, url, image_url, ad_type, brand, scraped_at, model_ai, embedding)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ad.id,
      ad.title,
      ad.price,
      safePriceValue,
      ad.location,
      ad.description,
      ad.date_posted,
      ad.link,
      ad.image_url || '',
      ad.ad_type,
      ad.brand,
      ad.scraped_at,
      '',
      null,
    ],
  );
  return (result.changes ?? 0) > 0;
};

export const getAllAds = async () => {
  await initDb();
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    const res = await pool.query('SELECT * FROM ads ORDER BY scraped_at DESC LIMIT 1000');
    return res.rows;
  }

  const db = await getSqliteDb();
  return db.all('SELECT * FROM ads ORDER BY scraped_at DESC LIMIT 1000');
};

export const getAllAdsByType = async (adType: string) => {
  await initDb();
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    const res = await pool.query('SELECT * FROM ads WHERE ad_type = $1 ORDER BY scraped_at DESC LIMIT 1000', [adType]);
    return res.rows;
  }

  const db = await getSqliteDb();
  return db.all('SELECT * FROM ads WHERE ad_type = ? ORDER BY scraped_at DESC LIMIT 1000', [adType]);
};

export const getRecentScrapedUrls = async (brand: string, adType: string, limit = 10): Promise<string[]> => {
  await initDb();

  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    const res = await pool.query('SELECT url FROM ads WHERE brand = $1 AND ad_type = $2 ORDER BY scraped_at DESC LIMIT $3', [brand, adType, limit]);
    return (res.rows as Array<{ url: string }>).map((r: { url: string }) => r.url);
  }

  const db = await getSqliteDb();
  const rows = await db.all<{ url: string }[]>('SELECT url FROM ads WHERE brand = ? AND ad_type = ? ORDER BY scraped_at DESC LIMIT ?', [brand, adType, limit]);
  return rows.map((r) => r.url);
};

export const getScrapeCheckpoint = async (brand: string, adType: string): Promise<{ lastSeenUrl: string | null; lastSeenDate: string | null } | null> => {
  await initDb();

  if (DB_CLIENT === 'postgres') {
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
  const row = await db.get<{ last_seen_url: string | null; last_seen_date: string | null }>('SELECT last_seen_url, last_seen_date FROM scrape_checkpoints WHERE brand = ? AND ad_type = ?', [brand, adType]);
  if (!row) return null;

  return {
    lastSeenUrl: row.last_seen_url,
    lastSeenDate: row.last_seen_date,
  };
};

export const updateScrapeCheckpoint = async (brand: string, adType: string, lastSeenUrl: string | null, lastSeenDate: string | null) => {
  await initDb();

  if (DB_CLIENT === 'postgres') {
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

export const updateAdModelAi = async (id: string, model: string) => {
  await initDb();

  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    await pool.query('UPDATE ads SET model_ai = $1 WHERE id = $2', [model, id]);
    return;
  }

  const db = await getSqliteDb();
  await db.run('UPDATE ads SET model_ai = ? WHERE id = ?', [model, id]);
};

export const updateAdEmbedding = async (id: string, embedding: string) => {
  await initDb();

  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();

    if (pgVectorReady) {
      await pool.query('UPDATE ads SET embedding = $1, embedding_vector = $2::vector WHERE id = $3', [embedding, embedding, id]);
      return;
    }

    await pool.query('UPDATE ads SET embedding = $1 WHERE id = $2', [embedding, id]);
    return;
  }

  const db = await getSqliteDb();
  await db.run('UPDATE ads SET embedding = ? WHERE id = ?', [embedding, id]);
};

export const saveMatch = async (offerId: string, demandId: string, score: number, isAi: boolean) => {
  await initDb();
  const createdAt = new Date().toISOString();

  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO matches (offer_id, demand_id, similarity_score, is_ai_match, created_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (offer_id, demand_id) DO UPDATE SET
      similarity_score = excluded.similarity_score,
      is_ai_match = excluded.is_ai_match,
      created_at = excluded.created_at`,
      [offerId, demandId, score, isAi, createdAt],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `INSERT INTO matches (offer_id, demand_id, similarity_score, is_ai_match, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (offer_id, demand_id) DO UPDATE SET
      similarity_score = excluded.similarity_score,
      is_ai_match = excluded.is_ai_match,
      created_at = excluded.created_at`,
    [offerId, demandId, score, isAi ? 1 : 0, createdAt],
  );
};

export const getPgVectorSimilarities = async (demandAdId: string, threshold = 0.8) => {
  await initDb();
  if (!isPgVectorAvailable()) return [];

  const pool = getPgPool();
  const res = await pool.query(
    `SELECT offer.id AS offer_id,
            1 - (offer.embedding_vector <=> demand.embedding_vector) AS similarity
     FROM ads AS demand
     JOIN ads AS offer ON offer.brand = demand.brand
     WHERE demand.id = $1
       AND demand.embedding_vector IS NOT NULL
       AND offer.embedding_vector IS NOT NULL
       AND demand.ad_type = 'poptavka'
       AND offer.ad_type = 'nabidka'
       AND offer.url <> demand.url
       AND (1 - (offer.embedding_vector <=> demand.embedding_vector)) >= $2
     ORDER BY similarity DESC
     LIMIT 100`,
    [demandAdId, threshold],
  );

  return res.rows as Array<{ offer_id: string; similarity: number }>;
};


export const saveMatchMeta = async (payload: any) => {
  await initDb();
  const now = new Date().toISOString();
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO match_meta (match_key, status, note, priority, last_action_at, resolved, follow_up_at, follow_up_state, checklist_json, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
       ON CONFLICT (match_key) DO UPDATE SET
       status = excluded.status, note = excluded.note, priority = excluded.priority, last_action_at = excluded.last_action_at,
       resolved = excluded.resolved, follow_up_at = excluded.follow_up_at, follow_up_state = excluded.follow_up_state, checklist_json = excluded.checklist_json, updated_at = NOW()`,
      [payload.matchKey, payload.status, payload.note, payload.priority, payload.lastActionAt, !!payload.resolved, payload.followUpAt || '', payload.followUpState || 'none', JSON.stringify(payload.checklist || {})],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `INSERT INTO match_meta (match_key, status, note, priority, last_action_at, resolved, follow_up_at, follow_up_state, checklist_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(match_key) DO UPDATE SET
     status=excluded.status, note=excluded.note, priority=excluded.priority, last_action_at=excluded.last_action_at,
     resolved=excluded.resolved, follow_up_at=excluded.follow_up_at, follow_up_state=excluded.follow_up_state, checklist_json=excluded.checklist_json, updated_at=excluded.updated_at`,
    [payload.matchKey, payload.status, payload.note, payload.priority, payload.lastActionAt, payload.resolved ? 1 : 0, payload.followUpAt || '', payload.followUpState || 'none', JSON.stringify(payload.checklist || {}), now],
  );
};

export const getAllMatchMeta = async () => {
  await initDb();
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    const res = await pool.query('SELECT * FROM match_meta');
    return res.rows;
  }
  const db = await getSqliteDb();
  return db.all('SELECT * FROM match_meta');
};

export const getResolvedMatchKeys = async (): Promise<string[]> => {
  await initDb();
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    const res = await pool.query('SELECT match_key FROM match_meta WHERE resolved = true');
    return (res.rows as Array<{match_key: string}>).map(r => r.match_key);
  }
  const db = await getSqliteDb();
  const rows = await db.all<{match_key: string}[]>('SELECT match_key FROM match_meta WHERE resolved = 1');
  return rows.map(r => r.match_key);
};

export const getDailyMetaStats = async () => {
  await initDb();
  const today = new Date().toISOString().slice(0,10);
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    const res = await pool.query(`SELECT
      COUNT(*) FILTER (WHERE status='new' AND DATE(updated_at)=CURRENT_DATE) AS new_count,
      COUNT(*) FILTER (WHERE status='contacted' AND DATE(updated_at)=CURRENT_DATE) AS contacted_count,
      COUNT(*) FILTER (WHERE status='closed' AND DATE(updated_at)=CURRENT_DATE) AS closed_count
      FROM match_meta`);
    return res.rows[0] || { new_count: 0, contacted_count: 0, closed_count: 0 };
  }

  const db = await getSqliteDb();
  const row = await db.get<any>(`SELECT
    SUM(CASE WHEN status='new' AND substr(updated_at,1,10)=? THEN 1 ELSE 0 END) AS new_count,
    SUM(CASE WHEN status='contacted' AND substr(updated_at,1,10)=? THEN 1 ELSE 0 END) AS contacted_count,
    SUM(CASE WHEN status='closed' AND substr(updated_at,1,10)=? THEN 1 ELSE 0 END) AS closed_count
    FROM match_meta`, [today, today, today]);
  return row || { new_count: 0, contacted_count: 0, closed_count: 0 };
};
