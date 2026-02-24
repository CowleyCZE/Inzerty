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

export const usingPostgres = () => DB_CLIENT === 'postgres';


const ensureSqliteColumn = async (db: Database, tableName: string, columnName: string, columnDefinition: string) => {
  const columns = await db.all<Array<{ name: string }>>(`PRAGMA table_info(${tableName})`);
  const exists = columns.some((column) => column.name === columnName);
  if (!exists) {
    await db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
  }
};

const runSqliteMigrations = async (db: Database) => {
  await ensureSqliteColumn(db, 'ads', 'price_value', 'REAL');
  await ensureSqliteColumn(db, 'ads', 'location', 'TEXT');
  await ensureSqliteColumn(db, 'ads', 'description', 'TEXT');
  await ensureSqliteColumn(db, 'ads', 'date_posted', 'TEXT');
  await ensureSqliteColumn(db, 'ads', 'url', 'TEXT');
  await ensureSqliteColumn(db, 'ads', 'image_url', 'TEXT');
  await ensureSqliteColumn(db, 'ads', 'ad_type', 'TEXT');
  await ensureSqliteColumn(db, 'ads', 'brand', 'TEXT');
  await ensureSqliteColumn(db, 'ads', 'scraped_at', 'TEXT');
  await ensureSqliteColumn(db, 'ads', 'model_ai', 'TEXT');
  await ensureSqliteColumn(db, 'ads', 'embedding', 'TEXT');
};


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
        url TEXT UNIQUE,
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
    `);

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
        url TEXT UNIQUE,
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
  `);

  await runSqliteMigrations(db);
  isInitialized = true;
  console.log('SQLite database initialized');
};

export const isPgVectorAvailable = () => usingPostgres() && pgVectorReady;

export const saveAd = async (ad: any) => {
  await initDb();

  const rawPrice = ad.price ? parseFloat(ad.price.replace(/[^0-9,-]+/g, '').replace(',', '.')) : null;
  const safePriceValue = rawPrice !== null && !isNaN(rawPrice) ? rawPrice : null;

  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO ads (id, title, price, price_value, location, description, date_posted, url, image_url, ad_type, brand, scraped_at, model_ai, embedding)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (url) DO NOTHING`,
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
    return;
  }

  const db = await getSqliteDb();
  await db.run(
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
