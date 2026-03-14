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

      CREATE TABLE IF NOT EXISTS conversations (
        id BIGSERIAL PRIMARY KEY,
        match_key TEXT NOT NULL,
        message TEXT NOT NULL,
        sender TEXT NOT NULL, -- 'user' | 'counterpart'
        channel TEXT, -- 'bazos' | 'sms' | 'email'
        sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        is_ai_generated BOOLEAN DEFAULT FALSE,
        context_snapshot TEXT, -- JSON snapshot of match at time of message
        FOREIGN KEY(match_key) REFERENCES match_meta(match_key)
      );

      CREATE INDEX IF NOT EXISTS idx_conversations_match_key ON conversations(match_key);
      CREATE INDEX IF NOT EXISTS idx_conversations_sent_at ON conversations(sent_at);

      -- Deal State Machine
      CREATE TABLE IF NOT EXISTS deal_states (
        id BIGSERIAL PRIMARY KEY,
        match_key TEXT NOT NULL UNIQUE,
        state TEXT NOT NULL DEFAULT 'new', -- new, contacted, negotiating, agreed, meeting_scheduled, completed, cancelled, stalled
        previous_state TEXT,
        state_changed_at TIMESTAMPTZ DEFAULT NOW(),
        last_contact_at TIMESTAMPTZ,
        last_followup_at TIMESTAMPTZ,
        followup_count INTEGER DEFAULT 0,
        auto_followup_enabled BOOLEAN DEFAULT TRUE,
        FOREIGN KEY(match_key) REFERENCES match_meta(match_key)
      );

      CREATE INDEX IF NOT EXISTS idx_deal_states_state ON deal_states(state);
      CREATE INDEX IF NOT EXISTS idx_deal_states_last_contact ON deal_states(last_contact_at);

      -- Follow-up Schedule
      CREATE TABLE IF NOT EXISTS followup_schedule (
        id BIGSERIAL PRIMARY KEY,
        match_key TEXT NOT NULL,
        scheduled_at TIMESTAMPTZ NOT NULL,
        sent_at TIMESTAMPTZ,
        status TEXT DEFAULT 'pending', -- pending, sent, skipped, cancelled
        template_type TEXT, -- gentle_reminder, urgent_followup, final_check
        channel TEXT DEFAULT 'email',
        is_ai_generated BOOLEAN DEFAULT FALSE,
        FOREIGN KEY(match_key) REFERENCES match_meta(match_key)
      );

      CREATE INDEX IF NOT EXISTS idx_followup_schedule_scheduled ON followup_schedule(scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_followup_schedule_status ON followup_schedule(status);

      -- Fraud Detection
      CREATE TABLE IF NOT EXISTS fraud_flags (
        id BIGSERIAL PRIMARY KEY,
        ad_url TEXT NOT NULL,
        ad_title TEXT,
        risk_level TEXT NOT NULL, -- low, medium, high, critical
        risk_score INTEGER NOT NULL,
        flags TEXT, -- JSON array of risk flags
        detected_at TIMESTAMPTZ DEFAULT NOW(),
        is_resolved BOOLEAN DEFAULT FALSE,
        resolved_at TIMESTAMPTZ,
        notes TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_fraud_flags_risk ON fraud_flags(risk_level);
      CREATE INDEX IF NOT EXISTS idx_fraud_flags_url ON fraud_flags(ad_url);

      -- Seller Watchlist
      CREATE TABLE IF NOT EXISTS seller_watchlist (
        id BIGSERIAL PRIMARY KEY,
        seller_identifier TEXT NOT NULL UNIQUE, -- phone, email, or URL pattern
        reason TEXT NOT NULL,
        risk_score INTEGER NOT NULL,
        added_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ,
        is_active BOOLEAN DEFAULT TRUE,
        incident_count INTEGER DEFAULT 1,
        notes TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_seller_watchlist_active ON seller_watchlist(is_active);

      -- Negotiation History
      CREATE TABLE IF NOT EXISTS negotiation_history (
        id BIGSERIAL PRIMARY KEY,
        match_key TEXT NOT NULL,
        offer_price DECIMAL(10,2),
        counter_price DECIMAL(10,2),
        final_price DECIMAL(10,2),
        status TEXT, -- pending, accepted, rejected, cancelled
        ai_suggested BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        responded_at TIMESTAMPTZ,
        FOREIGN KEY(match_key) REFERENCES match_meta(match_key)
      );

      CREATE INDEX IF NOT EXISTS idx_negotiation_match ON negotiation_history(match_key);
      CREATE INDEX IF NOT EXISTS idx_negotiation_status ON negotiation_history(status);

      -- Deal Analytics
      CREATE TABLE IF NOT EXISTS deal_analytics (
        id BIGSERIAL PRIMARY KEY,
        match_key TEXT NOT NULL UNIQUE,
        initial_profit DECIMAL(10,2),
        final_profit DECIMAL(10,2),
        time_to_close_hours INTEGER,
        negotiation_count INTEGER DEFAULT 0,
        followup_count INTEGER DEFAULT 0,
        success_rate DECIMAL(5,2),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        closed_at TIMESTAMPTZ,
        FOREIGN KEY(match_key) REFERENCES match_meta(match_key)
      );

      CREATE INDEX IF NOT EXISTS idx_deal_analytics_closed ON deal_analytics(closed_at);

      -- Fraud Analysis History (Persistent Storage)
      CREATE TABLE IF NOT EXISTS fraud_analysis_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_key TEXT NOT NULL,
        offer_url TEXT,
        demand_url TEXT,
        risk_level TEXT NOT NULL,
        risk_score INTEGER NOT NULL,
        flags TEXT, -- JSON array
        recommendation TEXT,
        analyzed_at TEXT DEFAULT CURRENT_TIMESTAMP,
        is_resolved INTEGER DEFAULT 0,
        resolved_at TEXT,
        notes TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_fraud_history_match ON fraud_analysis_history(match_key);
      CREATE INDEX IF NOT EXISTS idx_fraud_history_risk ON fraud_analysis_history(risk_level);
      CREATE INDEX IF NOT EXISTS idx_fraud_history_analyzed ON fraud_analysis_history(analyzed_at);

      -- Fraud Detection Thresholds
      CREATE TABLE IF NOT EXISTS fraud_thresholds (
        id INTEGER PRIMARY KEY,
        low_risk_max INTEGER DEFAULT 24,
        medium_risk_max INTEGER DEFAULT 49,
        high_risk_max INTEGER DEFAULT 79,
        critical_risk_min INTEGER DEFAULT 80,
        auto_watchlist_threshold INTEGER DEFAULT 80,
        enabled INTEGER DEFAULT 1,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Insert default thresholds
      INSERT OR IGNORE INTO fraud_thresholds (id, low_risk_max, medium_risk_max, high_risk_max, critical_risk_min, auto_watchlist_threshold, enabled)
      VALUES (1, 24, 49, 79, 80, 80, 1);

      -- Seller Reputation System
      CREATE TABLE IF NOT EXISTS seller_reputation (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_identifier TEXT NOT NULL UNIQUE,
        total_transactions INTEGER DEFAULT 0,
        successful_transactions INTEGER DEFAULT 0,
        failed_transactions INTEGER DEFAULT 0,
        avg_response_time_hours REAL DEFAULT 0,
        fraud_flags_count INTEGER DEFAULT 0,
        reputation_score REAL DEFAULT 50,
        last_transaction_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_seller_reputation_id ON seller_reputation(seller_identifier);
      CREATE INDEX IF NOT EXISTS idx_seller_reputation_score ON seller_reputation(reputation_score);

      -- Email Settings & Templates
      CREATE TABLE IF NOT EXISTS email_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        smtp_host TEXT,
        smtp_port INTEGER DEFAULT 587,
        smtp_user TEXT,
        smtp_pass TEXT,
        smtp_secure INTEGER DEFAULT 0,
        from_email TEXT,
        from_name TEXT DEFAULT 'Inzerty Bot',
        enabled INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS email_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        variables TEXT, -- JSON array of variable names
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS email_notifications_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipient TEXT NOT NULL,
        subject TEXT NOT NULL,
        template_name TEXT,
        sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'pending',
        error_message TEXT,
        match_key TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_email_log_sent ON email_notifications_log(sent_at);
      CREATE INDEX IF NOT EXISTS idx_email_log_status ON email_notifications_log(status);

      -- Calendar Events
      CREATE TABLE IF NOT EXISTS calendar_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_key TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        location_name TEXT,
        location_address TEXT,
        start_datetime TEXT NOT NULL,
        end_datetime TEXT NOT NULL,
        timezone TEXT DEFAULT 'Europe/Prague',
        google_calendar_id TEXT,
        ical_uid TEXT UNIQUE,
        status TEXT DEFAULT 'confirmed',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_calendar_match ON calendar_events(match_key);
      CREATE INDEX IF NOT EXISTS idx_calendar_start ON calendar_events(start_datetime);
      CREATE INDEX IF NOT EXISTS idx_calendar_status ON calendar_events(status);

      -- Meeting Feedback
      CREATE TABLE IF NOT EXISTS meeting_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_key TEXT NOT NULL,
        meeting_id INTEGER,
        rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
        seller_rating INTEGER CHECK(seller_rating >= 1 AND seller_rating <= 5),
        buyer_rating INTEGER CHECK(buyer_rating >= 1 AND buyer_rating <= 5),
        meeting_successful INTEGER DEFAULT 1,
        comments TEXT,
        would_meet_again INTEGER DEFAULT 1,
        seller_behavior TEXT,
        location_rating INTEGER CHECK(location_rating >= 1 AND location_rating <= 5),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_meeting_feedback_match ON meeting_feedback(match_key);
      CREATE INDEX IF NOT EXISTS idx_meeting_feedback_created ON meeting_feedback(created_at);
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

      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_key TEXT NOT NULL,
        message TEXT NOT NULL,
        sender TEXT NOT NULL,
        channel TEXT,
        sent_at TEXT NOT NULL,
        is_ai_generated INTEGER DEFAULT 0,
        context_snapshot TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_conversations_match_key ON conversations(match_key);
      CREATE INDEX IF NOT EXISTS idx_conversations_sent_at ON conversations(sent_at);

      -- Deal State Machine
      CREATE TABLE IF NOT EXISTS deal_states (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_key TEXT NOT NULL UNIQUE,
        state TEXT NOT NULL DEFAULT 'new',
        previous_state TEXT,
        state_changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_contact_at TEXT,
        last_followup_at TEXT,
        followup_count INTEGER DEFAULT 0,
        auto_followup_enabled INTEGER DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_deal_states_state ON deal_states(state);
      CREATE INDEX IF NOT EXISTS idx_deal_states_last_contact ON deal_states(last_contact_at);

      -- Follow-up Schedule
      CREATE TABLE IF NOT EXISTS followup_schedule (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_key TEXT NOT NULL,
        scheduled_at TEXT NOT NULL,
        sent_at TEXT,
        status TEXT DEFAULT 'pending',
        template_type TEXT,
        channel TEXT DEFAULT 'email',
        is_ai_generated INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_followup_schedule_scheduled ON followup_schedule(scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_followup_schedule_status ON followup_schedule(status);

      -- Fraud Detection
      CREATE TABLE IF NOT EXISTS fraud_flags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ad_url TEXT NOT NULL,
        ad_title TEXT,
        risk_level TEXT NOT NULL,
        risk_score INTEGER NOT NULL,
        flags TEXT,
        detected_at TEXT DEFAULT CURRENT_TIMESTAMP,
        is_resolved INTEGER DEFAULT 0,
        resolved_at TEXT,
        notes TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_fraud_flags_risk ON fraud_flags(risk_level);
      CREATE INDEX IF NOT EXISTS idx_fraud_flags_url ON fraud_flags(ad_url);

      -- Seller Watchlist
      CREATE TABLE IF NOT EXISTS seller_watchlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_identifier TEXT NOT NULL UNIQUE,
        reason TEXT NOT NULL,
        risk_score INTEGER NOT NULL,
        added_at TEXT DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT,
        is_active INTEGER DEFAULT 1,
        incident_count INTEGER DEFAULT 1,
        notes TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_seller_watchlist_active ON seller_watchlist(is_active);

      -- Negotiation History
      CREATE TABLE IF NOT EXISTS negotiation_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_key TEXT NOT NULL,
        offer_price REAL,
        counter_price REAL,
        final_price REAL,
        status TEXT,
        ai_suggested INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        responded_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_negotiation_match ON negotiation_history(match_key);
      CREATE INDEX IF NOT EXISTS idx_negotiation_status ON negotiation_history(status);

      -- Deal Analytics
      CREATE TABLE IF NOT EXISTS deal_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_key TEXT NOT NULL UNIQUE,
        initial_profit REAL,
        final_profit REAL,
        time_to_close_hours INTEGER,
        negotiation_count INTEGER DEFAULT 0,
        followup_count INTEGER DEFAULT 0,
        success_rate REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        closed_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_deal_analytics_closed ON deal_analytics(closed_at);

      -- Fraud Analysis History (Persistent Storage)
      CREATE TABLE IF NOT EXISTS fraud_analysis_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_key TEXT NOT NULL,
        offer_url TEXT,
        demand_url TEXT,
        risk_level TEXT NOT NULL,
        risk_score INTEGER NOT NULL,
        flags TEXT,
        recommendation TEXT,
        analyzed_at TEXT DEFAULT CURRENT_TIMESTAMP,
        is_resolved INTEGER DEFAULT 0,
        resolved_at TEXT,
        notes TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_fraud_history_match ON fraud_analysis_history(match_key);
      CREATE INDEX IF NOT EXISTS idx_fraud_history_risk ON fraud_analysis_history(risk_level);
      CREATE INDEX IF NOT EXISTS idx_fraud_history_analyzed ON fraud_analysis_history(analyzed_at);

      -- Fraud Detection Thresholds
      CREATE TABLE IF NOT EXISTS fraud_thresholds (
        id INTEGER PRIMARY KEY,
        low_risk_max INTEGER DEFAULT 24,
        medium_risk_max INTEGER DEFAULT 49,
        high_risk_max INTEGER DEFAULT 79,
        critical_risk_min INTEGER DEFAULT 80,
        auto_watchlist_threshold INTEGER DEFAULT 80,
        enabled INTEGER DEFAULT 1,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Insert default thresholds
      INSERT OR IGNORE INTO fraud_thresholds (id, low_risk_max, medium_risk_max, high_risk_max, critical_risk_min, auto_watchlist_threshold, enabled)
      VALUES (1, 24, 49, 79, 80, 80, 1);

      -- Seller Reputation System
      CREATE TABLE IF NOT EXISTS seller_reputation (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_identifier TEXT NOT NULL UNIQUE,
        total_transactions INTEGER DEFAULT 0,
        successful_transactions INTEGER DEFAULT 0,
        failed_transactions INTEGER DEFAULT 0,
        avg_response_time_hours REAL DEFAULT 0,
        fraud_flags_count INTEGER DEFAULT 0,
        reputation_score REAL DEFAULT 50,
        last_transaction_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_seller_reputation_id ON seller_reputation(seller_identifier);
      CREATE INDEX IF NOT EXISTS idx_seller_reputation_score ON seller_reputation(reputation_score);

      -- Email Settings & Templates
      CREATE TABLE IF NOT EXISTS email_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        smtp_host TEXT,
        smtp_port INTEGER DEFAULT 587,
        smtp_user TEXT,
        smtp_pass TEXT,
        smtp_secure INTEGER DEFAULT 0,
        from_email TEXT,
        from_name TEXT DEFAULT 'Inzerty Bot',
        enabled INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS email_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        variables TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS email_notifications_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipient TEXT NOT NULL,
        subject TEXT NOT NULL,
        template_name TEXT,
        sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'pending',
        error_message TEXT,
        match_key TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_email_log_sent ON email_notifications_log(sent_at);
      CREATE INDEX IF NOT EXISTS idx_email_log_status ON email_notifications_log(status);

      -- Calendar Events
      CREATE TABLE IF NOT EXISTS calendar_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_key TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        location_name TEXT,
        location_address TEXT,
        start_datetime TEXT NOT NULL,
        end_datetime TEXT NOT NULL,
        timezone TEXT DEFAULT 'Europe/Prague',
        google_calendar_id TEXT,
        ical_uid TEXT UNIQUE,
        status TEXT DEFAULT 'confirmed',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_calendar_match ON calendar_events(match_key);
      CREATE INDEX IF NOT EXISTS idx_calendar_start ON calendar_events(start_datetime);
      CREATE INDEX IF NOT EXISTS idx_calendar_status ON calendar_events(status);
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

export const getPreviouslySeenMatchKeys = async (): Promise<string[]> => {
  await initDb();
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    const res = await pool.query(`
      SELECT DISTINCT match_key FROM (
        SELECT match_key FROM match_meta
        UNION
        SELECT DISTINCT (offer_id || '__' || demand_id) AS match_key FROM matches
      ) sub
    `);
    return (res.rows as Array<{match_key: string}>).map(r => r.match_key);
  }
  const db = await getSqliteDb();
  const rows = await db.all<{match_key: string}[]>(`
    SELECT DISTINCT match_key FROM (
      SELECT match_key FROM match_meta
      UNION
      SELECT offer_id || '__' || demand_id AS match_key FROM matches
    )
  `);
  return rows.map(r => r.match_key);
};

export const markMatchesAsSeen = async (matchKeys: string[]): Promise<number> => {
  await initDb();
  const now = new Date().toISOString();
  let count = 0;
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    for (const key of matchKeys) {
      await pool.query(`
        INSERT INTO match_meta (match_key, status, note, priority, last_action_at, resolved, follow_up_at, follow_up_state, checklist_json, updated_at)
        VALUES ($1, 'new', '', 'medium', $2, false, '', 'none', '{}', $3)
        ON CONFLICT (match_key) DO NOTHING
      `, [key, now, now]);
      count++;
    }
    return count;
  }
  
  const db = await getSqliteDb();
  for (const key of matchKeys) {
    await db.run(`
      INSERT OR IGNORE INTO match_meta (match_key, status, note, priority, last_action_at, resolved, follow_up_at, follow_up_state, checklist_json, updated_at)
      VALUES (?, 'new', '', 'medium', ?, 0, '', 'none', '{}', ?)
    `, [key, now, now]);
    count++;
  }
  return count;
};

export const bulkUpdateMatches = async (matchKeys: string[], updates: { resolved?: boolean; status?: string; priority?: string }) => {
  await initDb();
  const now = new Date().toISOString();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (typeof updates.resolved === 'boolean') {
      setClauses.push(`resolved = $${paramIndex++}`);
      values.push(updates.resolved);
    }
    if (typeof updates.status === 'string') {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (typeof updates.priority === 'string') {
      setClauses.push(`priority = $${paramIndex++}`);
      values.push(updates.priority);
    }
    
    const query = `
      UPDATE match_meta 
      SET ${setClauses.join(', ')}
      WHERE match_key = ANY($${paramIndex}::text[])
    `;
    values.push(matchKeys);
    
    await pool.query(query, values);
    return matchKeys.length;
  }
  
  const db = await getSqliteDb();
  const setClauses: string[] = ['updated_at = ?'];
  const values: any[] = [now];
  
  if (typeof updates.resolved === 'boolean') {
    setClauses.push(`resolved = ?`);
    values.push(updates.resolved ? 1 : 0);
  }
  if (typeof updates.status === 'string') {
    setClauses.push(`status = ?`);
    values.push(updates.status);
  }
  if (typeof updates.priority === 'string') {
    setClauses.push(`priority = ?`);
    values.push(updates.priority);
  }
  
  for (const key of matchKeys) {
    await db.run(`
      UPDATE match_meta 
      SET ${setClauses.join(', ')}
      WHERE match_key = ?
    `, [...values, key]);
  }
  return matchKeys.length;
};

export const getFollowUps = async (options: { 
  from?: string; 
  to?: string; 
  state?: string;
  overdue?: boolean;
} = {}): Promise<Array<{
  match_key: string;
  follow_up_at: string;
  follow_up_state: string;
  status: string;
  priority: string;
  note: string;
  offer_title?: string;
  demand_title?: string;
  profit?: number;
}>> => {
  await initDb();
  
  const today = new Date().toISOString().slice(0, 10);
  const from = options.from || today;
  const to = options.to || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    
    let query = `
      SELECT 
        mm.match_key,
        mm.follow_up_at,
        mm.follow_up_state,
        mm.status,
        mm.priority,
        mm.note,
        a1.title as offer_title,
        a2.title as demand_title,
        (CAST(a2.price_value AS INTEGER) - CAST(a1.price_value AS INTEGER)) as profit
      FROM match_meta mm
      LEFT JOIN matches m ON m.offer_id || '__' || m.demand_id = mm.match_key
      LEFT JOIN ads a1 ON a1.id = m.offer_id
      LEFT JOIN ads a2 ON a2.id = m.demand_id
      WHERE mm.follow_up_at IS NOT NULL 
        AND mm.follow_up_at != ''
        AND mm.resolved = false
    `;
    
    const params: any[] = [];
    const conditions: string[] = [];
    
    if (options.overdue) {
      conditions.push(`mm.follow_up_at < NOW()`);
    } else {
      conditions.push(`mm.follow_up_at >= $${params.length + 1}`);
      params.push(from);
      conditions.push(`mm.follow_up_at <= $${params.length + 1}`);
      params.push(to);
    }
    
    if (options.state && options.state !== 'none') {
      conditions.push(`mm.follow_up_state = $${params.length + 1}`);
      params.push(options.state);
    }
    
    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY mm.follow_up_at ASC';
    
    const res = await pool.query(query, params);
    return res.rows;
  }
  
  const db = await getSqliteDb();
  
  let query = `
    SELECT 
      mm.match_key,
      mm.follow_up_at,
      mm.follow_up_state,
      mm.status,
      mm.priority,
      mm.note,
      a1.title as offer_title,
      a2.title as demand_title,
      (CAST(a2.price_value AS INTEGER) - CAST(a1.price_value AS INTEGER)) as profit
    FROM match_meta mm
    LEFT JOIN matches m ON m.offer_id || '__' || m.demand_id = mm.match_key
    LEFT JOIN ads a1 ON a1.id = m.offer_id
    LEFT JOIN ads a2 ON a2.id = m.demand_id
    WHERE mm.follow_up_at IS NOT NULL 
      AND mm.follow_up_at != ''
      AND mm.resolved = 0
  `;
  
  const params: any[] = [];
  const conditions: string[] = [];
  
  if (options.overdue) {
    conditions.push(`mm.follow_up_at < datetime('now')`);
  } else {
    conditions.push(`mm.follow_up_at >= ?`);
    params.push(from);
    conditions.push(`mm.follow_up_at <= ?`);
    params.push(to);
  }
  
  if (options.state && options.state !== 'none') {
    conditions.push(`mm.follow_up_state = ?`);
    params.push(options.state);
  }
  
  if (conditions.length > 0) {
    query += ' AND ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY mm.follow_up_at ASC';
  
  const rows = await db.all(query, params);
  return rows;
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

export const clearDatabase = async () => {
  await initDb();

  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    await pool.query('TRUNCATE TABLE matches, match_meta, scrape_checkpoints, conversations, ads RESTART IDENTITY CASCADE');
    return;
  }

  const db = await getSqliteDb();
  await db.exec(`
    DELETE FROM matches;
    DELETE FROM match_meta;
    DELETE FROM scrape_checkpoints;
    DELETE FROM conversations;
    DELETE FROM ads;
  `);
};

// ========================================
// Conversation functions
// ========================================

export const saveConversation = async (matchKey: string, message: string, sender: 'user' | 'counterpart', channel?: string, isAiGenerated?: boolean, contextSnapshot?: any) => {
  await initDb();
  const now = new Date().toISOString();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO conversations (match_key, message, sender, channel, sent_at, is_ai_generated, context_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [matchKey, message, sender, channel || null, now, isAiGenerated || false, contextSnapshot ? JSON.stringify(contextSnapshot) : null],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `INSERT INTO conversations (match_key, message, sender, channel, sent_at, is_ai_generated, context_snapshot)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [matchKey, message, sender, channel || null, now, isAiGenerated ? 1 : 0, contextSnapshot ? JSON.stringify(contextSnapshot) : null],
  );
};

export const getConversationHistory = async (matchKey: string) => {
  await initDb();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    const res = await pool.query(
      `SELECT * FROM conversations WHERE match_key = $1 ORDER BY sent_at ASC`,
      [matchKey],
    );
    return res.rows;
  }

  const db = await getSqliteDb();
  return db.all(
    `SELECT * FROM conversations WHERE match_key = ? ORDER BY sent_at ASC`,
    [matchKey],
  );
};

export const getLastConversation = async (matchKey: string) => {
  await initDb();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    const res = await pool.query(
      `SELECT * FROM conversations WHERE match_key = $1 ORDER BY sent_at DESC LIMIT 1`,
      [matchKey],
    );
    return res.rows[0] || null;
  }

  const db = await getSqliteDb();
  return db.get(
    `SELECT * FROM conversations WHERE match_key = ? ORDER BY sent_at DESC LIMIT 1`,
    [matchKey],
  );
};

export const getConversationStats = async (matchKey: string) => {
  await initDb();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    const res = await pool.query(
      `SELECT 
        COUNT(*) as total_messages,
        COUNT(*) FILTER (WHERE sender = 'user') as user_messages,
        COUNT(*) FILTER (WHERE sender = 'counterpart') as counterpart_messages,
        MAX(sent_at) as last_message_at,
        COUNT(*) FILTER (WHERE is_ai_generated = true) as ai_generated_count
       FROM conversations WHERE match_key = $1`,
      [matchKey],
    );
    return res.rows[0] || { total_messages: 0, user_messages: 0, counterpart_messages: 0, last_message_at: null, ai_generated_count: 0 };
  }

  const db = await getSqliteDb();
  return db.get(
    `SELECT
      COUNT(*) as total_messages,
      SUM(CASE WHEN sender = 'user' THEN 1 ELSE 0 END) as user_messages,
      SUM(CASE WHEN sender = 'counterpart' THEN 1 ELSE 0 END) as counterpart_messages,
      MAX(sent_at) as last_message_at,
      SUM(CASE WHEN is_ai_generated = 1 THEN 1 ELSE 0 END) as ai_generated_count
     FROM conversations WHERE match_key = ?`,
    [matchKey],
  );
};

// ========================================
// Deal State Machine functions
// ========================================

export type DealState = 'new' | 'contacted' | 'negotiating' | 'agreed' | 'meeting_scheduled' | 'completed' | 'cancelled' | 'stalled';

export const initDealState = async (matchKey: string) => {
  await initDb();
  const now = new Date().toISOString();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO deal_states (match_key, state, state_changed_at)
       VALUES ($1, 'new', $2)
       ON CONFLICT (match_key) DO NOTHING`,
      [matchKey, now],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `INSERT OR IGNORE INTO deal_states (match_key, state, state_changed_at)
     VALUES (?, 'new', ?)`,
    [matchKey, now],
  );
};

export const updateDealState = async (matchKey: string, newState: DealState, metadata?: any) => {
  await initDb();
  const now = new Date().toISOString();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    await pool.query(
      `UPDATE deal_states SET
       state = $1,
       previous_state = state,
       state_changed_at = $2,
       last_contact_at = COALESCE(last_contact_at, $2)
       WHERE match_key = $3`,
      [newState, now, matchKey],
    );
    
    // Update match_meta status to match deal state
    const metaStatus = newState === 'completed' ? 'closed' : newState === 'cancelled' ? 'closed' : newState;
    await pool.query(
      `UPDATE match_meta SET status = $1, updated_at = NOW() WHERE match_key = $2`,
      [metaStatus, matchKey],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `UPDATE deal_states SET
     state = ?,
     previous_state = state,
     state_changed_at = ?,
     last_contact_at = COALESCE(last_contact_at, ?)
     WHERE match_key = ?`,
    [newState, now, now, matchKey],
  );
  
  const metaStatus = newState === 'completed' ? 'closed' : newState === 'cancelled' ? 'closed' : newState;
  await db.run(
    `UPDATE match_meta SET status = ?, updated_at = ? WHERE match_key = ?`,
    [metaStatus, now, matchKey],
  );
};

export const getDealState = async (matchKey: string) => {
  await initDb();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    const res = await pool.query(
      `SELECT * FROM deal_states WHERE match_key = $1`,
      [matchKey],
    );
    return res.rows[0] || null;
  }

  const db = await getSqliteDb();
  return db.get(
    `SELECT * FROM deal_states WHERE match_key = ?`,
    [matchKey],
  );
};

export const getAllDealStates = async (filters?: { state?: DealState; limit?: number }) => {
  await initDb();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    let query = `SELECT * FROM deal_states WHERE 1=1`;
    const params: any[] = [];
    
    if (filters?.state) {
      query += ` AND state = $${params.length + 1}`;
      params.push(filters.state);
    }
    
    query += ` ORDER BY last_contact_at ASC NULLS FIRST`;
    
    if (filters?.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(filters.limit);
    }
    
    const res = await pool.query(query, params);
    return res.rows;
  }

  const db = await getSqliteDb();
  let query = `SELECT * FROM deal_states WHERE 1=1`;
  const params: any[] = [];
  
  if (filters?.state) {
    query += ` AND state = ?`;
    params.push(filters.state);
  }
  
  query += ` ORDER BY last_contact_at ASC`;
  
  if (filters?.limit) {
    query += ` LIMIT ?`;
    params.push(filters.limit);
  }
  
  return db.all(query, params);
};

export const markDealContacted = async (matchKey: string) => {
  await updateDealState(matchKey, 'contacted');
};

export const markDealStalled = async (matchKey: string) => {
  await updateDealState(matchKey, 'stalled');
};

export const incrementFollowupCount = async (matchKey: string) => {
  await initDb();
  const now = new Date().toISOString();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    await pool.query(
      `UPDATE deal_states SET
       followup_count = followup_count + 1,
       last_followup_at = $1
       WHERE match_key = $2`,
      [now, matchKey],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `UPDATE deal_states SET
     followup_count = followup_count + 1,
     last_followup_at = ?
     WHERE match_key = ?`,
    [now, matchKey],
  );
};

// ========================================
// Follow-up Schedule functions
// ========================================

export const scheduleFollowup = async (matchKey: string, scheduledAt: string, templateType?: string, channel?: string, isAiGenerated?: boolean) => {
  await initDb();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO followup_schedule (match_key, scheduled_at, template_type, channel, is_ai_generated)
       VALUES ($1, $2, $3, $4, $5)`,
      [matchKey, scheduledAt, templateType || 'gentle_reminder', channel || 'email', isAiGenerated || false],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `INSERT INTO followup_schedule (match_key, scheduled_at, template_type, channel, is_ai_generated)
     VALUES (?, ?, ?, ?, ?)`,
    [matchKey, scheduledAt, templateType || 'gentle_reminder', channel || 'email', isAiGenerated || false],
  );
};

export const getPendingFollowups = async () => {
  await initDb();
  const now = new Date().toISOString();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    const res = await pool.query(
      `SELECT * FROM followup_schedule
       WHERE status = 'pending' AND scheduled_at <= $1
       ORDER BY scheduled_at ASC`,
      [now],
    );
    return res.rows;
  }

  const db = await getSqliteDb();
  return db.all(
    `SELECT * FROM followup_schedule
     WHERE status = 'pending' AND scheduled_at <= ?
     ORDER BY scheduled_at ASC`,
    [now],
  );
};

export const markFollowupSent = async (followupId: number) => {
  await initDb();
  const now = new Date().toISOString();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    await pool.query(
      `UPDATE followup_schedule SET
       status = 'sent',
       sent_at = $1
       WHERE id = $2`,
      [now, followupId],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `UPDATE followup_schedule SET
     status = 'sent',
     sent_at = ?
     WHERE id = ?`,
    [now, followupId],
  );
};

export const getDealPipeline = async () => {
  await initDb();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    const res = await pool.query(`
      SELECT 
        ds.state,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE ds.last_contact_at IS NOT NULL) as contacted_count,
        AVG(CASE WHEN ds.last_contact_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (NOW() - ds.last_contact_at))/3600 
            ELSE NULL END) as avg_hours_since_contact
      FROM deal_states ds
      GROUP BY ds.state
      ORDER BY ds.state
    `);
    return res.rows;
  }

  const db = await getSqliteDb();
  return db.all(`
    SELECT
      state,
      COUNT(*) as count,
      SUM(CASE WHEN last_contact_at IS NOT NULL THEN 1 ELSE 0 END) as contacted_count,
      AVG(CASE WHEN last_contact_at IS NOT NULL
          THEN (julianday('now') - julianday(last_contact_at)) * 24
          ELSE NULL END) as avg_hours_since_contact
    FROM deal_states
    GROUP BY state
    ORDER BY state
  `);
};

// ========================================
// Fraud Detection functions
// ========================================

export interface FraudFlag {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  evidence: string;
}

export const saveFraudFlag = async (adUrl: string, adTitle: string, riskLevel: string, riskScore: number, flags: FraudFlag[]) => {
  await initDb();
  const now = new Date().toISOString();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO fraud_flags (ad_url, ad_title, risk_level, risk_score, flags, detected_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [adUrl, adTitle, riskLevel, riskScore, JSON.stringify(flags), now],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `INSERT INTO fraud_flags (ad_url, ad_title, risk_level, risk_score, flags, detected_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [adUrl, adTitle, riskLevel, riskScore, JSON.stringify(flags), now],
  );
};

export const getFraudFlags = async (adUrl?: string) => {
  await initDb();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    if (adUrl) {
      const res = await pool.query(
        `SELECT * FROM fraud_flags WHERE ad_url = $1 ORDER BY detected_at DESC`,
        [adUrl],
      );
      return res.rows;
    }
    const res = await pool.query(
      `SELECT * FROM fraud_flags WHERE is_resolved = FALSE ORDER BY risk_score DESC, detected_at DESC`,
    );
    return res.rows;
  }

  const db = await getSqliteDb();
  if (adUrl) {
    return db.all(
      `SELECT * FROM fraud_flags WHERE ad_url = ? ORDER BY detected_at DESC`,
      [adUrl],
    );
  }
  return db.all(
    `SELECT * FROM fraud_flags WHERE is_resolved = 0 ORDER BY risk_score DESC, detected_at DESC`,
  );
};

export const resolveFraudFlag = async (fraudId: number) => {
  await initDb();
  const now = new Date().toISOString();
  
  if (DB_CLIENT === 'postgres') {
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

// ========================================
// Seller Watchlist functions
// ========================================

export const addToWatchlist = async (sellerIdentifier: string, reason: string, riskScore: number, expiresAt?: string, notes?: string) => {
  await initDb();
  const now = new Date().toISOString();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO seller_watchlist (seller_identifier, reason, risk_score, expires_at, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (seller_identifier) DO UPDATE SET
       risk_score = EXCLUDED.risk_score,
       incident_count = seller_watchlist.incident_count + 1,
       notes = EXCLUDED.notes,
       is_active = TRUE`,
      [sellerIdentifier, reason, riskScore, expiresAt || null, notes || null],
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
    [sellerIdentifier, reason, riskScore, expiresAt || null, notes || null],
  );
};

export const getWatchlist = async (isActiveOnly: boolean = true) => {
  await initDb();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    if (isActiveOnly) {
      const res = await pool.query(
        `SELECT * FROM seller_watchlist WHERE is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY risk_score DESC`,
      );
      return res.rows;
    }
    const res = await pool.query(`SELECT * FROM seller_watchlist ORDER BY risk_score DESC`);
    return res.rows;
  }

  const db = await getSqliteDb();
  if (isActiveOnly) {
    return db.all(
      `SELECT * FROM seller_watchlist WHERE is_active = 1 AND (expires_at IS NULL OR expires_at > datetime('now'))
       ORDER BY risk_score DESC`,
    );
  }
  return db.all(`SELECT * FROM seller_watchlist ORDER BY risk_score DESC`);
};

export const isSellerOnWatchlist = async (sellerIdentifier: string): Promise<boolean> => {
  await initDb();
  
  if (DB_CLIENT === 'postgres') {
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

export const removeFromWatchlist = async (sellerIdentifier: string) => {
  await initDb();
  
  if (DB_CLIENT === 'postgres') {
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

// ========================================
// Negotiation History functions
// ========================================

export const saveNegotiation = async (
  matchKey: string,
  offerPrice: number,
  counterPrice?: number,
  finalPrice?: number,
  status?: string,
  aiSuggested?: boolean
) => {
  await initDb();
  const now = new Date().toISOString();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO negotiation_history (match_key, offer_price, counter_price, final_price, status, ai_suggested, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [matchKey, offerPrice, counterPrice || null, finalPrice || null, status || 'pending', aiSuggested || false, now],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `INSERT INTO negotiation_history (match_key, offer_price, counter_price, final_price, status, ai_suggested, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [matchKey, offerPrice, counterPrice || null, finalPrice || null, status || 'pending', aiSuggested ? 1 : 0, now],
  );
};

export const updateNegotiation = async (negotiationId: number, status: string, finalPrice?: number) => {
  await initDb();
  const now = new Date().toISOString();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    if (finalPrice) {
      await pool.query(
        `UPDATE negotiation_history SET status = $1, final_price = $2, responded_at = $3 WHERE id = $4`,
        [status, finalPrice, now, negotiationId],
      );
    } else {
      await pool.query(
        `UPDATE negotiation_history SET status = $1, responded_at = $2 WHERE id = $3`,
        [status, now, negotiationId],
      );
    }
    return;
  }

  const db = await getSqliteDb();
  if (finalPrice) {
    await db.run(
      `UPDATE negotiation_history SET status = ?, final_price = ?, responded_at = ? WHERE id = ?`,
      [status, finalPrice, now, negotiationId],
    );
  } else {
    await db.run(
      `UPDATE negotiation_history SET status = ?, responded_at = ? WHERE id = ?`,
      [status, now, negotiationId],
    );
  }
};

export const getNegotiationHistoryLegacy = async (matchKey: string) => {
  await initDb();

  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    const res = await pool.query(
      `SELECT * FROM negotiation_history WHERE match_key = $1 ORDER BY created_at DESC`,
      [matchKey],
    );
    return res.rows;
  }

  const db = await getSqliteDb();
  return db.all(
    `SELECT * FROM negotiation_history WHERE match_key = ? ORDER BY created_at DESC`,
    [matchKey],
  );
};

// ========================================
// Deal Analytics functions
// ========================================

export const saveDealAnalytics = async (
  matchKey: string,
  initialProfit: number,
  finalProfit?: number,
  timeToCloseHours?: number,
  negotiationCount?: number,
  followupCount?: number,
  successRate?: number
) => {
  await initDb();
  const now = new Date().toISOString();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO deal_analytics (match_key, initial_profit, final_profit, time_to_close_hours, negotiation_count, followup_count, success_rate, closed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (match_key) DO UPDATE SET
       final_profit = COALESCE(EXCLUDED.final_profit, deal_analytics.final_profit),
       time_to_close_hours = COALESCE(EXCLUDED.time_to_close_hours, deal_analytics.time_to_close_hours),
       negotiation_count = COALESCE(EXCLUDED.negotiation_count, deal_analytics.negotiation_count),
       followup_count = COALESCE(EXCLUDED.followup_count, deal_analytics.followup_count),
       success_rate = COALESCE(EXCLUDED.success_rate, deal_analytics.success_rate),
       closed_at = NOW()`,
      [matchKey, initialProfit, finalProfit || null, timeToCloseHours || null, negotiationCount || 0, followupCount || 0, successRate || null, now],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `INSERT INTO deal_analytics (match_key, initial_profit, final_profit, time_to_close_hours, negotiation_count, followup_count, success_rate, closed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (match_key) DO UPDATE SET
     final_profit = COALESCE(excluded.final_profit, deal_analytics.final_profit),
     time_to_close_hours = COALESCE(excluded.time_to_close_hours, deal_analytics.time_to_close_hours),
     negotiation_count = COALESCE(excluded.negotiation_count, deal_analytics.negotiation_count),
     followup_count = COALESCE(excluded.followup_count, deal_analytics.followup_count),
     success_rate = COALESCE(excluded.success_rate, deal_analytics.success_rate),
     closed_at = excluded.closed_at`,
    [matchKey, initialProfit, finalProfit || null, timeToCloseHours || null, negotiationCount || 0, followupCount || 0, successRate || null, now],
  );
};

export const getAnalytics = async () => {
  await initDb();
  
  if (DB_CLIENT === 'postgres') {
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
    return res.rows[0] || {
      total_deals: 0,
      closed_deals: 0,
      avg_profit: 0,
      avg_time_to_close: 0,
      total_revenue: 0,
      avg_success_rate: 0,
    };
  }

  const db = await getSqliteDb();
  const row = await db.get(`
    SELECT
      COUNT(*) as total_deals,
      COUNT(*) FILTER (WHERE closed_at IS NOT NULL) as closed_deals,
      AVG(final_profit) FILTER (WHERE closed_at IS NOT NULL) as avg_profit,
      AVG(time_to_close_hours) FILTER (WHERE closed_at IS NOT NULL) as avg_time_to_close,
      SUM(final_profit) FILTER (WHERE closed_at IS NOT NULL AND final_profit > 0) as total_revenue,
      AVG(success_rate) FILTER (WHERE closed_at IS NOT NULL) as avg_success_rate
    FROM deal_analytics
  `);
  return row || {
    total_deals: 0,
    closed_deals: 0,
    avg_profit: 0,
    avg_time_to_close: 0,
    total_revenue: 0,
    avg_success_rate: 0,
  };
};

export const getAnalyticsByPeriod = async (days: number = 30) => {
  await initDb();

  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    const res = await pool.query(
      `SELECT * FROM deal_analytics
       WHERE closed_at >= NOW() - INTERVAL '${days} days'
       ORDER BY closed_at DESC`,
    );
    return res.rows;
  }

  const db = await getSqliteDb();
  return db.all(
    `SELECT * FROM deal_analytics
     WHERE closed_at >= datetime('now', '-' || ? || ' days')
     ORDER BY closed_at DESC`,
    [days],
  );
};

// ========================================
// Fraud Analysis History (Persistent)
// ========================================

export const saveFraudAnalysis = async (matchKey: string, offerUrl: string, demandUrl: string, analysis: any) => {
  await initDb();
  const now = new Date().toISOString();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO fraud_analysis_history (match_key, offer_url, demand_url, risk_level, risk_score, flags, recommendation, analyzed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [matchKey, offerUrl, demandUrl, analysis.riskLevel, analysis.riskScore, JSON.stringify(analysis.flags), analysis.recommendation, now],
    );
    return;
  }

  const db = await getSqliteDb();
  await db.run(
    `INSERT INTO fraud_analysis_history (match_key, offer_url, demand_url, risk_level, risk_score, flags, recommendation, analyzed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [matchKey, offerUrl, demandUrl, analysis.riskLevel, analysis.riskScore, JSON.stringify(analysis.flags), analysis.recommendation, now],
  );
};

export const getFraudAnalysisHistory = async (matchKey?: string, limit: number = 50) => {
  await initDb();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    if (matchKey) {
      const res = await pool.query(
        `SELECT * FROM fraud_analysis_history WHERE match_key = $1 ORDER BY analyzed_at DESC LIMIT $2`,
        [matchKey, limit],
      );
      return res.rows;
    }
    const res = await pool.query(
      `SELECT * FROM fraud_analysis_history ORDER BY analyzed_at DESC LIMIT $1`,
      [limit],
    );
    return res.rows;
  }

  const db = await getSqliteDb();
  if (matchKey) {
    return db.all(
      `SELECT * FROM fraud_analysis_history WHERE match_key = ? ORDER BY analyzed_at DESC LIMIT ?`,
      [matchKey, limit],
    );
  }
  return db.all(
    `SELECT * FROM fraud_analysis_history ORDER BY analyzed_at DESC LIMIT ?`,
    [limit],
  );
};

export const getFraudAnalysisStats = async () => {
  await initDb();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    const res = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE risk_level = 'low') as low_risk,
        COUNT(*) FILTER (WHERE risk_level = 'medium') as medium_risk,
        COUNT(*) FILTER (WHERE risk_level = 'high') as high_risk,
        COUNT(*) FILTER (WHERE risk_level = 'critical') as critical_risk,
        AVG(risk_score) as avg_score
      FROM fraud_analysis_history
      WHERE analyzed_at >= $1
    `, [thirtyDaysAgo]);
    return res.rows[0] || { total: 0, low_risk: 0, medium_risk: 0, high_risk: 0, critical_risk: 0, avg_score: 0 };
  }

  const db = await getSqliteDb();
  const row = await db.get(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN risk_level = 'low' THEN 1 ELSE 0 END) as low_risk,
      SUM(CASE WHEN risk_level = 'medium' THEN 1 ELSE 0 END) as medium_risk,
      SUM(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END) as high_risk,
      SUM(CASE WHEN risk_level = 'critical' THEN 1 ELSE 0 END) as critical_risk,
      AVG(risk_score) as avg_score
    FROM fraud_analysis_history
    WHERE analyzed_at >= ?
  `, [thirtyDaysAgo]);
  return row || { total: 0, low_risk: 0, medium_risk: 0, high_risk: 0, critical_risk: 0, avg_score: 0 };
};

// ========================================
// Email Settings & Templates
// ========================================

export const saveEmailSettings = async (settings: {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  smtp_secure: boolean;
  from_email: string;
  from_name: string;
  enabled: boolean;
}) => {
  await initDb();
  const now = new Date().toISOString();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    await pool.query(`
      INSERT INTO email_settings (id, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, from_email, from_name, enabled, updated_at)
      VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
      smtp_host = EXCLUDED.smtp_host,
      smtp_port = EXCLUDED.smtp_port,
      smtp_user = EXCLUDED.smtp_user,
      smtp_pass = EXCLUDED.smtp_pass,
      smtp_secure = EXCLUDED.smtp_secure,
      from_email = EXCLUDED.from_email,
      from_name = EXCLUDED.from_name,
      enabled = EXCLUDED.enabled,
      updated_at = EXCLUDED.updated_at
    `, [
      settings.smtp_host,
      settings.smtp_port,
      settings.smtp_user,
      settings.smtp_pass,
      settings.smtp_secure ? 1 : 0,
      settings.from_email,
      settings.from_name,
      settings.enabled ? 1 : 0,
      now,
    ]);
    return;
  }

  const db = await getSqliteDb();
  await db.run(`
    INSERT OR REPLACE INTO email_settings (id, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, from_email, from_name, enabled, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    settings.smtp_host,
    settings.smtp_port,
    settings.smtp_user,
    settings.smtp_pass,
    settings.smtp_secure ? 1 : 0,
    settings.from_email,
    settings.from_name,
    settings.enabled ? 1 : 0,
    now,
  ]);
};

export const getEmailSettings = async () => {
  await initDb();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    const res = await pool.query('SELECT * FROM email_settings WHERE id = 1');
    return res.rows[0] || null;
  }

  const db = await getSqliteDb();
  return db.get('SELECT * FROM email_settings WHERE id = 1');
};

export const saveEmailTemplate = async (name: string, subject: string, body: string, variables?: string[]) => {
  await initDb();
  const now = new Date().toISOString();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    await pool.query(`
      INSERT INTO email_templates (name, subject, body, variables, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (name) DO UPDATE SET
      subject = EXCLUDED.subject,
      body = EXCLUDED.body,
      variables = EXCLUDED.variables,
      updated_at = EXCLUDED.updated_at
    `, [name, subject, body, variables ? JSON.stringify(variables) : null, now]);
    return;
  }

  const db = await getSqliteDb();
  await db.run(`
    INSERT OR REPLACE INTO email_templates (name, subject, body, variables, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `, [name, subject, body, variables ? JSON.stringify(variables) : null, now]);
};

export const getEmailTemplate = async (name: string) => {
  await initDb();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    const res = await pool.query('SELECT * FROM email_templates WHERE name = $1', [name]);
    return res.rows[0] || null;
  }

  const db = await getSqliteDb();
  return db.get('SELECT * FROM email_templates WHERE name = ?', [name]);
};

export const getAllEmailTemplates = async () => {
  await initDb();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    const res = await pool.query('SELECT * FROM email_templates ORDER BY name');
    return res.rows;
  }

  const db = await getSqliteDb();
  return db.all('SELECT * FROM email_templates ORDER BY name');
};

export const logEmailNotification = async (recipient: string, subject: string, templateName: string, status: string, errorMessage?: string, matchKey?: string) => {
  await initDb();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    await pool.query(`
      INSERT INTO email_notifications_log (recipient, subject, template_name, status, error_message, match_key)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [recipient, subject, templateName, status, errorMessage || null, matchKey || null]);
    return;
  }

  const db = await getSqliteDb();
  await db.run(`
    INSERT INTO email_notifications_log (recipient, subject, template_name, status, error_message, match_key)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [recipient, subject, templateName, status, errorMessage || null, matchKey || null]);
};

// ========================================
// Calendar Events
// ========================================

export const saveCalendarEvent = async (event: {
  match_key: string;
  title: string;
  description?: string;
  location_name?: string;
  location_address?: string;
  start_datetime: string;
  end_datetime: string;
  timezone?: string;
}) => {
  await initDb();
  const now = new Date().toISOString();
  const icalUid = `inzerty-${event.match_key}-${Date.now()}@bazos.cz`;
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    await pool.query(`
      INSERT INTO calendar_events (match_key, title, description, location_name, location_address, start_datetime, end_datetime, timezone, ical_uid, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      event.match_key,
      event.title,
      event.description || null,
      event.location_name || null,
      event.location_address || null,
      event.start_datetime,
      event.end_datetime,
      event.timezone || 'Europe/Prague',
      icalUid,
      now,
      now,
    ]);
    return { ...event, ical_uid: icalUid };
  }

  const db = await getSqliteDb();
  await db.run(`
    INSERT INTO calendar_events (match_key, title, description, location_name, location_address, start_datetime, end_datetime, timezone, ical_uid, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    event.match_key,
    event.title,
    event.description || null,
    event.location_name || null,
    event.location_address || null,
    event.start_datetime,
    event.end_datetime,
    event.timezone || 'Europe/Prague',
    icalUid,
    now,
    now,
  ]);
  return { ...event, ical_uid: icalUid };
};

export const getCalendarEvent = async (matchKey: string) => {
  await initDb();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    const res = await pool.query('SELECT * FROM calendar_events WHERE match_key = $1 ORDER BY start_datetime DESC LIMIT 1', [matchKey]);
    return res.rows[0] || null;
  }

  const db = await getSqliteDb();
  return db.get('SELECT * FROM calendar_events WHERE match_key = ? ORDER BY start_datetime DESC LIMIT 1', [matchKey]);
};

export const getUpcomingCalendarEvents = async (days: number = 7) => {
  await initDb();
  const now = new Date().toISOString();
  const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    const res = await pool.query(`
      SELECT * FROM calendar_events
      WHERE start_datetime >= $1 AND start_datetime <= $2 AND status = 'confirmed'
      ORDER BY start_datetime ASC
    `, [now, futureDate]);
    return res.rows;
  }

  const db = await getSqliteDb();
  return db.all(`
    SELECT * FROM calendar_events
    WHERE start_datetime >= ? AND start_datetime <= ? AND status = 'confirmed'
    ORDER BY start_datetime ASC
  `, [now, futureDate]);
};

export const updateCalendarEventStatus = async (matchKey: string, status: string) => {
  await initDb();
  const now = new Date().toISOString();
  
  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    await pool.query(`
      UPDATE calendar_events SET status = $1, updated_at = $2 WHERE match_key = $3
    `, [status, now, matchKey]);
    return;
  }

  const db = await getSqliteDb();
  await db.run(`
    UPDATE calendar_events SET status = ?, updated_at = ? WHERE match_key = ?
  `, [status, now, matchKey]);
};

// Generate iCal format
export const generateICal = (event: any): string => {
  const formatDate = (date: string) => {
    return new Date(date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Inzerty//CS//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.ical_uid || `inzerty-${event.match_key}-${Date.now()}@bazos.cz`}`,
    `DTSTAMP:${formatDate(new Date().toISOString())}`,
    `DTSTART:${formatDate(event.start_datetime)}`,
    `DTEND:${formatDate(event.end_datetime)}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${event.description || ''}`,
    `LOCATION:${event.location_name || ''}${event.location_address ? `, ${event.location_address}` : ''}`,
    `STATUS:${event.status}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
};

// ========================================
// Auto Negotiation - DB Integration
// ========================================

export const saveNegotiationDB = async (negotiation: {
  match_key: string;
  offer_id?: string;
  demand_id?: string;
  initial_offer_price: number;
  counter_offer_price?: number;
  final_price?: number;
  status?: string;
  negotiation_round?: number;
  ai_suggested?: boolean;
}) => {
  await initDb();
  const now = new Date().toISOString();

  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    const res = await pool.query(`
      INSERT INTO negotiation_db (match_key, offer_id, demand_id, initial_offer_price, counter_offer_price, final_price, status, negotiation_round, ai_suggested, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      negotiation.match_key,
      negotiation.offer_id || null,
      negotiation.demand_id || null,
      negotiation.initial_offer_price,
      negotiation.counter_offer_price || null,
      negotiation.final_price || null,
      negotiation.status || 'pending',
      negotiation.negotiation_round || 0,
      negotiation.ai_suggested ? 1 : 0,
      now,
      now,
    ]);
    return res.rows[0];
  }

  const db = await getSqliteDb();
  await db.run(`
    INSERT INTO negotiation_db (match_key, offer_id, demand_id, initial_offer_price, counter_offer_price, final_price, status, negotiation_round, ai_suggested, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    negotiation.match_key,
    negotiation.offer_id || null,
    negotiation.demand_id || null,
    negotiation.initial_offer_price,
    negotiation.counter_offer_price || null,
    negotiation.final_price || null,
    negotiation.status || 'pending',
    negotiation.negotiation_round || 0,
    negotiation.ai_suggested ? 1 : 0,
    now,
    now,
  ]);

  return db.get('SELECT * FROM negotiation_db ORDER BY id DESC LIMIT 1');
};

export const getNegotiationHistory = async (matchKey?: string, limit: number = 50) => {
  await initDb();

  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    if (matchKey) {
      const res = await pool.query(
        'SELECT * FROM negotiation_db WHERE match_key = $1 ORDER BY created_at DESC LIMIT $2',
        [matchKey, limit],
      );
      return res.rows;
    }
    const res = await pool.query(
      'SELECT * FROM negotiation_db ORDER BY created_at DESC LIMIT $1',
      [limit],
    );
    return res.rows;
  }

  const db = await getSqliteDb();
  if (matchKey) {
    return db.all(
      'SELECT * FROM negotiation_db WHERE match_key = ? ORDER BY created_at DESC LIMIT ?',
      [matchKey, limit],
    );
  }
  return db.all(
    'SELECT * FROM negotiation_db ORDER BY created_at DESC LIMIT ?',
    [limit],
  );
};

export const updateNegotiationStatus = async (negotiationId: number, status: string, finalPrice?: number) => {
  await initDb();
  const now = new Date().toISOString();

  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    if (finalPrice) {
      await pool.query(`
        UPDATE negotiation_db SET status = $1, final_price = $2, updated_at = $3, completed_at = $4
        WHERE id = $5
      `, [status, finalPrice, now, now, negotiationId]);
    } else {
      await pool.query(`
        UPDATE negotiation_db SET status = $1, updated_at = $2 WHERE id = $3
      `, [status, now, negotiationId]);
    }
    return;
  }

  const db = await getSqliteDb();
  if (finalPrice) {
    await db.run(`
      UPDATE negotiation_db SET status = ?, final_price = ?, updated_at = ?, completed_at = ?
      WHERE id = ?
    `, [status, finalPrice, now, now, negotiationId]);
  } else {
    await db.run(`
      UPDATE negotiation_db SET status = ?, updated_at = ? WHERE id = ?
    `, [status, now, negotiationId]);
  }
};

export const saveNegotiationMessage = async (negotiationId: number, sender: string, message: string, sentiment?: string, containsCounterOffer?: boolean, extractedPrice?: number) => {
  await initDb();

  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    await pool.query(`
      INSERT INTO negotiation_messages (negotiation_id, sender, message, sentiment, contains_counter_offer, extracted_price)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [negotiationId, sender, message, sentiment || null, containsCounterOffer ? 1 : 0, extractedPrice || null]);
    return;
  }

  const db = await getSqliteDb();
  await db.run(`
    INSERT INTO negotiation_messages (negotiation_id, sender, message, sentiment, contains_counter_offer, extracted_price)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [negotiationId, sender, message, sentiment || null, containsCounterOffer ? 1 : 0, extractedPrice || null]);
};

export const getNegotiationStats = async () => {
  await initDb();

  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    const res = await pool.query(`
      SELECT
        COUNT(*) as total_negotiations,
        COUNT(*) FILTER (WHERE success = 1) as successful_negotiations,
        AVG(final_price) FILTER (WHERE success = 1) as avg_final_price,
        AVG(negotiation_round) FILTER (WHERE success = 1) as avg_rounds,
        AVG(seller_response_time_hours) as avg_seller_response_time,
        AVG(buyer_response_time_hours) as avg_buyer_response_time
      FROM negotiation_db
    `);
    return res.rows[0] || {
      total_negotiations: 0,
      successful_negotiations: 0,
      avg_final_price: 0,
      avg_rounds: 0,
      avg_seller_response_time: 0,
      avg_buyer_response_time: 0,
    };
  }

  const db = await getSqliteDb();
  return db.get(`
    SELECT
      COUNT(*) as total_negotiations,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_negotiations,
      AVG(final_price) as avg_final_price,
      AVG(negotiation_round) as avg_rounds,
      AVG(seller_response_time_hours) as avg_seller_response_time,
      AVG(buyer_response_time_hours) as avg_buyer_response_time
    FROM negotiation_db
  `);
};

// ========================================
// Advanced ML & Negotiation Patterns
// ========================================

export const saveMLModel = async (modelName: string, modelType: string, modelData: any, accuracy?: number) => {
  await initDb();
  const now = new Date().toISOString();

  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    await pool.query(`
      INSERT INTO ml_models (model_name, model_type, model_data, accuracy, trained_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (model_name) DO UPDATE SET
      model_type = EXCLUDED.model_type,
      model_data = EXCLUDED.model_data,
      accuracy = EXCLUDED.accuracy,
      trained_at = EXCLUDED.trained_at,
      updated_at = EXCLUDED.updated_at
    `, [modelName, modelType, JSON.stringify(modelData), accuracy || null, now, now]);
    return;
  }

  const db = await getSqliteDb();
  await db.run(`
    INSERT OR REPLACE INTO ml_models (model_name, model_type, model_data, accuracy, trained_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [modelName, modelType, JSON.stringify(modelData), accuracy || null, now, now]);
};

export const getMLModel = async (modelName: string) => {
  await initDb();

  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    const res = await pool.query('SELECT * FROM ml_models WHERE model_name = $1', [modelName]);
    return res.rows[0] || null;
  }

  const db = await getSqliteDb();
  return db.get('SELECT * FROM ml_models WHERE model_name = ?', [modelName]);
};

export const saveNegotiationPattern = async (pattern: {
  pattern_name: string;
  pattern_type: string;
  success_rate?: number;
  avg_rounds?: number;
  avg_discount_percent?: number;
  recommended_for?: string;
}) => {
  await initDb();
  const now = new Date().toISOString();

  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    await pool.query(`
      INSERT INTO negotiation_patterns (pattern_name, pattern_type, success_rate, avg_rounds, avg_discount_percent, recommended_for, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (pattern_name) DO UPDATE SET
      pattern_type = EXCLUDED.pattern_type,
      success_rate = EXCLUDED.success_rate,
      avg_rounds = EXCLUDED.avg_rounds,
      avg_discount_percent = EXCLUDED.avg_discount_percent,
      recommended_for = EXCLUDED.recommended_for,
      updated_at = EXCLUDED.updated_at
    `, [
      pattern.pattern_name,
      pattern.pattern_type,
      pattern.success_rate || null,
      pattern.avg_rounds || null,
      pattern.avg_discount_percent || null,
      pattern.recommended_for || null,
      now,
    ]);
    return;
  }

  const db = await getSqliteDb();
  await db.run(`
    INSERT OR REPLACE INTO negotiation_patterns (pattern_name, pattern_type, success_rate, avg_rounds, avg_discount_percent, recommended_for, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    pattern.pattern_name,
    pattern.pattern_type,
    pattern.success_rate || null,
    pattern.avg_rounds || null,
    pattern.avg_discount_percent || null,
    pattern.recommended_for || null,
    now,
  ]);
};

export const getNegotiationPatterns = async (patternType?: string) => {
  await initDb();

  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    if (patternType) {
      const res = await pool.query(
        'SELECT * FROM negotiation_patterns WHERE pattern_type = $1 ORDER BY success_rate DESC',
        [patternType],
      );
      return res.rows;
    }
    const res = await pool.query('SELECT * FROM negotiation_patterns ORDER BY success_rate DESC');
    return res.rows;
  }

  const db = await getSqliteDb();
  if (patternType) {
    return db.all(
      'SELECT * FROM negotiation_patterns WHERE pattern_type = ? ORDER BY success_rate DESC',
      [patternType],
    );
  }
  return db.all('SELECT * FROM negotiation_patterns ORDER BY success_rate DESC');
};

export const updatePatternUsage = async (patternName: string, success: boolean) => {
  await initDb();

  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    await pool.query(`
      UPDATE negotiation_patterns SET
      usage_count = usage_count + 1,
      success_count = success_count + ${success ? 1 : 0},
      success_rate = ((success_count + ${success ? 1 : 0}) * 100.0 / (usage_count + 1)),
      updated_at = NOW()
      WHERE pattern_name = $1
    `, [patternName]);
    return;
  }

  const db = await getSqliteDb();
  await db.run(`
    UPDATE negotiation_patterns SET
    usage_count = usage_count + 1,
    success_count = success_count + ${success ? 1 : 0},
    success_rate = ((success_count + ${success ? 1 : 0}) * 100.0 / (usage_count + 1)),
    updated_at = CURRENT_TIMESTAMP
    WHERE pattern_name = ?
  `, [patternName]);
};

// ========================================
// Fraud Detection - Configurable Thresholds
// ========================================

export const saveFraudThresholds = async (thresholds: {
  low_risk_max: number;
  medium_risk_max: number;
  high_risk_max: number;
  critical_risk_min: number;
  auto_watchlist_threshold: number;
  enabled: boolean;
}) => {
  await initDb();
  const now = new Date().toISOString();

  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    await pool.query(`
      INSERT INTO fraud_thresholds (low_risk_max, medium_risk_max, high_risk_max, critical_risk_min, auto_watchlist_threshold, enabled, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
      low_risk_max = EXCLUDED.low_risk_max,
      medium_risk_max = EXCLUDED.medium_risk_max,
      high_risk_max = EXCLUDED.high_risk_max,
      critical_risk_min = EXCLUDED.critical_risk_min,
      auto_watchlist_threshold = EXCLUDED.auto_watchlist_threshold,
      enabled = EXCLUDED.enabled,
      updated_at = EXCLUDED.updated_at
    `, [
      thresholds.low_risk_max || 24,
      thresholds.medium_risk_max || 49,
      thresholds.high_risk_max || 79,
      thresholds.critical_risk_min || 80,
      thresholds.auto_watchlist_threshold || 80,
      thresholds.enabled !== undefined ? thresholds.enabled : true,
      now,
    ]);
    return;
  }

  const db = await getSqliteDb();
  await db.run(`
    INSERT OR REPLACE INTO fraud_thresholds (id, low_risk_max, medium_risk_max, high_risk_max, critical_risk_min, auto_watchlist_threshold, enabled, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?)
  `, [
    thresholds.low_risk_max || 24,
    thresholds.medium_risk_max || 49,
    thresholds.high_risk_max || 79,
    thresholds.critical_risk_min || 80,
    thresholds.auto_watchlist_threshold || 80,
    thresholds.enabled !== undefined ? thresholds.enabled : 1,
    now,
  ]);
};

export const getFraudThresholds = async () => {
  await initDb();

  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    const res = await pool.query('SELECT * FROM fraud_thresholds WHERE id = 1');
    return res.rows[0] || {
      low_risk_max: 24,
      medium_risk_max: 49,
      high_risk_max: 79,
      critical_risk_min: 80,
      auto_watchlist_threshold: 80,
      enabled: true,
    };
  }

  const db = await getSqliteDb();
  return db.get('SELECT * FROM fraud_thresholds WHERE id = 1') || {
    low_risk_max: 24,
    medium_risk_max: 49,
    high_risk_max: 79,
    critical_risk_min: 80,
    auto_watchlist_threshold: 80,
    enabled: true,
  };
};

export const getRiskLevel = async (score: number) => {
  const thresholds = await getFraudThresholds();
  
  if (!thresholds.enabled) {
    // Default thresholds if disabled
    if (score <= 24) return 'low';
    if (score <= 49) return 'medium';
    if (score <= 79) return 'high';
    return 'critical';
  }

  if (score <= thresholds.low_risk_max) return 'low';
  if (score <= thresholds.medium_risk_max) return 'medium';
  if (score <= thresholds.high_risk_max) return 'high';
  return 'critical';
};

// ========================================
// Meeting Feedback System
// ========================================

export const saveMeetingFeedback = async (feedback: {
  match_key: string;
  meeting_id?: number;
  rating: number; // 1-5
  seller_rating?: number; // 1-5
  buyer_rating?: number; // 1-5
  meeting_successful: boolean;
  comments?: string;
  would_meet_again: boolean;
  seller_behavior?: string;
  location_rating?: number; // 1-5
}) => {
  await initDb();
  const now = new Date().toISOString();

  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    await pool.query(`
      INSERT INTO meeting_feedback (match_key, meeting_id, rating, seller_rating, buyer_rating, meeting_successful, comments, would_meet_again, seller_behavior, location_rating, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      feedback.match_key,
      feedback.meeting_id || null,
      feedback.rating,
      feedback.seller_rating || null,
      feedback.buyer_rating || null,
      feedback.meeting_successful,
      feedback.comments || null,
      feedback.would_meet_again,
      feedback.seller_behavior || null,
      feedback.location_rating || null,
      now,
    ]);
    return;
  }

  const db = await getSqliteDb();
  await db.run(`
    INSERT INTO meeting_feedback (match_key, meeting_id, rating, seller_rating, buyer_rating, meeting_successful, comments, would_meet_again, seller_behavior, location_rating, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    feedback.match_key,
    feedback.meeting_id || null,
    feedback.rating,
    feedback.seller_rating || null,
    feedback.buyer_rating || null,
    feedback.meeting_successful,
    feedback.comments || null,
    feedback.would_meet_again,
    feedback.seller_behavior || null,
    feedback.location_rating || null,
    now,
  ]);
};

export const getMeetingFeedback = async (matchKey?: string) => {
  await initDb();

  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    if (matchKey) {
      const res = await pool.query(
        'SELECT * FROM meeting_feedback WHERE match_key = $1 ORDER BY created_at DESC',
        [matchKey],
      );
      return res.rows;
    }
    const res = await pool.query('SELECT * FROM meeting_feedback ORDER BY created_at DESC');
    return res.rows;
  }

  const db = await getSqliteDb();
  if (matchKey) {
    return db.all(
      'SELECT * FROM meeting_feedback WHERE match_key = ? ORDER BY created_at DESC',
      [matchKey],
    );
  }
  return db.all('SELECT * FROM meeting_feedback ORDER BY created_at DESC');
};

export const getFeedbackStats = async () => {
  await initDb();

  if (DB_CLIENT === 'postgres') {
    const pool = getPgPool();
    const res = await pool.query(`
      SELECT
        COUNT(*) as total_feedback,
        AVG(rating) as avg_rating,
        AVG(seller_rating) as avg_seller_rating,
        AVG(buyer_rating) as avg_buyer_rating,
        COUNT(*) FILTER (WHERE meeting_successful = true) as successful_meetings,
        COUNT(*) FILTER (WHERE would_meet_again = true) as would_meet_again,
        AVG(location_rating) as avg_location_rating
      FROM meeting_feedback
    `);
    return res.rows[0] || {
      total_feedback: 0,
      avg_rating: 0,
      avg_seller_rating: 0,
      avg_buyer_rating: 0,
      successful_meetings: 0,
      would_meet_again: 0,
      avg_location_rating: 0,
    };
  }

  const db = await getSqliteDb();
  return db.get(`
    SELECT
      COUNT(*) as total_feedback,
      AVG(rating) as avg_rating,
      AVG(seller_rating) as avg_seller_rating,
      AVG(buyer_rating) as avg_buyer_rating,
      SUM(CASE WHEN meeting_successful = 1 THEN 1 ELSE 0 END) as successful_meetings,
      SUM(CASE WHEN would_meet_again = 1 THEN 1 ELSE 0 END) as would_meet_again,
      AVG(location_rating) as avg_location_rating
    FROM meeting_feedback
  `);
};
