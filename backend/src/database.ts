import pg from 'pg';

const { Pool } = pg;

// Nastavení připojení k PostgreSQL. Výchozí hodnoty předpokládají lokální databázi.
// Lze přepsat přes proměnnou prostředí DATABASE_URL.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/inzerty',
});

let isInitialized = false;

export const initDb = async () => {
  if (isInitialized) return;

  const client = await pool.connect();
  try {
    await client.query(`
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
        id SERIAL PRIMARY KEY,
        offer_id TEXT,
        demand_id TEXT,
        similarity_score REAL,
        is_ai_match BOOLEAN,
        created_at TEXT,
        UNIQUE(offer_id, demand_id),
        FOREIGN KEY(offer_id) REFERENCES ads(id),
        FOREIGN KEY(demand_id) REFERENCES ads(id)
      );
    `);
    
    isInitialized = true;
    console.log('PostgreSQL database initialized');
  } catch (error) {
    console.error('Error initializing PostgreSQL database:', error);
  } finally {
    client.release();
  }
};

export const saveAd = async (ad: any) => {
  await initDb();

  const rawPrice = ad.price ? parseFloat(ad.price.replace(/[^0-9,-]+/g, '').replace(',', '.')) : null;
  const safePriceValue = rawPrice !== null && !isNaN(rawPrice) ? rawPrice : null;

  try {
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
        null
      ]
    );
  } catch (error) {
    console.error('Error saving ad:', error);
  }
};

export const getAdsByBrand = async (brand: string, adType: string) => {
  await initDb();
  const res = await pool.query('SELECT * FROM ads WHERE brand = $1 AND ad_type = $2 ORDER BY date_posted DESC', [brand, adType]);
  return res.rows;
};

export const getAllAds = async () => {
  await initDb();
  const res = await pool.query('SELECT * FROM ads ORDER BY scraped_at DESC LIMIT 1000');
  return res.rows;
};

export const getAllAdsByType = async (adType: string) => {
  await initDb();
  const res = await pool.query('SELECT * FROM ads WHERE ad_type = $1 ORDER BY scraped_at DESC LIMIT 1000', [adType]);
  return res.rows;
};

export const getRecentScrapedUrls = async (brand: string, adType: string, limit = 10): Promise<string[]> => {
  await initDb();
  const res = await pool.query('SELECT url FROM ads WHERE brand = $1 AND ad_type = $2 ORDER BY scraped_at DESC LIMIT $3', [brand, adType, limit]);
  return res.rows.map(r => r.url);
};

export const updateAdModelAi = async (id: string, model: string) => {
  await initDb();
  await pool.query('UPDATE ads SET model_ai = $1 WHERE id = $2', [model, id]);
};

export const updateAdEmbedding = async (id: string, embedding: string) => {
  await initDb();
  await pool.query('UPDATE ads SET embedding = $1 WHERE id = $2', [embedding, id]);
};

export const saveMatch = async (offerId: string, demandId: string, score: number, isAi: boolean) => {
  await initDb();
  const createdAt = new Date().toISOString();
  try {
    await pool.query(
      `INSERT INTO matches (offer_id, demand_id, similarity_score, is_ai_match, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (offer_id, demand_id) DO UPDATE SET 
         similarity_score = EXCLUDED.similarity_score,
         is_ai_match = EXCLUDED.is_ai_match,
         created_at = EXCLUDED.created_at`,
      [offerId, demandId, score, isAi, createdAt]
    );
  } catch (error) {
    console.error('Error saving match:', error);
  }
};
