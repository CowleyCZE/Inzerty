import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: Database | null = null;

export const initDb = async () => {
  if (db) return db;

  const dbPath = path.join(__dirname, '..', 'inzerty.db');
  
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

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
      model_ai TEXT
    );

    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      offer_id TEXT,
      demand_id TEXT,
      similarity_score REAL,
      is_ai_match BOOLEAN,
      created_at TEXT,
      FOREIGN KEY(offer_id) REFERENCES ads(id),
      FOREIGN KEY(demand_id) REFERENCES ads(id),
      UNIQUE(offer_id, demand_id)
    );
  `);

  console.log('Database initialized at', dbPath);
  return db;
};

export const saveAd = async (ad: any) => {
  const db = await initDb();
  
  // Clean price for storage
  const priceValue = ad.price ? parseFloat(ad.price.replace(/[^0-9,-]+/g, '').replace(',', '.')) : null;
  const safePriceValue = isNaN(priceValue) ? null : priceValue;

  try {
    await db.run(
      `INSERT OR IGNORE INTO ads (id, title, price, price_value, location, description, date_posted, url, image_url, ad_type, brand, scraped_at, model_ai)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ad.id,
        ad.title,
        ad.price,
        safePriceValue,
        ad.location,
        ad.description,
        ad.date_posted,
        ad.link, // using 'link' from scraper as 'url'
        ad.image_url || '',
        ad.ad_type,
        ad.brand,
        ad.scraped_at,
        '' // model_ai initially empty
      ]
    );
    // If we wanted to update existing ads, we'd use ON CONFLICT(url) DO UPDATE ...
  } catch (error) {
    console.error('Error saving ad:', error);
  }
};

export const getAdsByBrand = async (brand: string, adType: string) => {
  const db = await initDb();
  return db.all('SELECT * FROM ads WHERE brand = ? AND ad_type = ? ORDER BY date_posted DESC', [brand, adType]);
};

export const getAllAds = async () => {
    const db = await initDb();
    return db.all('SELECT * FROM ads ORDER BY scraped_at DESC LIMIT 1000');
};

export const getAllAdsByType = async (adType: string) => {
    const db = await initDb();
    return db.all('SELECT * FROM ads WHERE ad_type = ? ORDER BY scraped_at DESC LIMIT 1000', [adType]);
};

export const updateAdModelAi = async (id: string, model: string) => {
    const db = await initDb();
    await db.run('UPDATE ads SET model_ai = ? WHERE id = ?', [model, id]);
};
