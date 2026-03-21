/**
 * Database Schema Definitions
 * 
 * SQL CREATE TABLE statements for SQLite and PostgreSQL
 */

// ========================================
// PostgreSQL Schema
// ========================================
export const POSTGRES_SCHEMA = `
  -- Ads Table
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
    embedding TEXT,
    source TEXT DEFAULT 'bazos_cz',
    external_id TEXT,
    posted_at TIMESTAMPTZ,
    seller_info JSONB,
    metadata JSONB,
    UNIQUE(url, ad_type)
  );

  -- Matches Table
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

  -- Scrape Checkpoints Table
  CREATE TABLE IF NOT EXISTS scrape_checkpoints (
    brand TEXT NOT NULL,
    ad_type TEXT NOT NULL,
    last_seen_url TEXT,
    last_seen_date TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (brand, ad_type)
  );

  -- Match Meta Table
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

  -- Conversations Table
  CREATE TABLE IF NOT EXISTS conversations (
    id BIGSERIAL PRIMARY KEY,
    match_key TEXT NOT NULL,
    message TEXT NOT NULL,
    sender TEXT NOT NULL,
    channel TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_ai_generated BOOLEAN DEFAULT FALSE,
    context_snapshot TEXT,
    FOREIGN KEY(match_key) REFERENCES match_meta(match_key)
  );

  CREATE INDEX IF NOT EXISTS idx_conversations_match_key ON conversations(match_key);
  CREATE INDEX IF NOT EXISTS idx_conversations_sent_at ON conversations(sent_at);

  -- Deal States Table
  CREATE TABLE IF NOT EXISTS deal_states (
    id BIGSERIAL PRIMARY KEY,
    match_key TEXT NOT NULL UNIQUE,
    state TEXT NOT NULL DEFAULT 'new',
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

  -- Follow-up Schedule Table
  CREATE TABLE IF NOT EXISTS followup_schedule (
    id BIGSERIAL PRIMARY KEY,
    match_key TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    status TEXT DEFAULT 'pending',
    template_type TEXT,
    channel TEXT DEFAULT 'email',
    is_ai_generated BOOLEAN DEFAULT FALSE,
    FOREIGN KEY(match_key) REFERENCES match_meta(match_key)
  );

  CREATE INDEX IF NOT EXISTS idx_followup_schedule_scheduled ON followup_schedule(scheduled_at);
  CREATE INDEX IF NOT EXISTS idx_followup_schedule_status ON followup_schedule(status);

  -- Fraud Flags Table
  CREATE TABLE IF NOT EXISTS fraud_flags (
    id BIGSERIAL PRIMARY KEY,
    ad_url TEXT NOT NULL,
    ad_title TEXT,
    risk_level TEXT NOT NULL,
    risk_score INTEGER NOT NULL,
    flags TEXT,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    notes TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_fraud_flags_risk ON fraud_flags(risk_level);
  CREATE INDEX IF NOT EXISTS idx_fraud_flags_url ON fraud_flags(ad_url);

  -- Seller Watchlist Table
  CREATE TABLE IF NOT EXISTS seller_watchlist (
    id BIGSERIAL PRIMARY KEY,
    seller_identifier TEXT NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    risk_score INTEGER NOT NULL,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    incident_count INTEGER DEFAULT 1,
    notes TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_seller_watchlist_active ON seller_watchlist(is_active);

  -- Negotiation History Table
  CREATE TABLE IF NOT EXISTS negotiation_history (
    id BIGSERIAL PRIMARY KEY,
    match_key TEXT NOT NULL,
    offer_price DECIMAL(10,2),
    counter_price DECIMAL(10,2),
    final_price DECIMAL(10,2),
    status TEXT,
    ai_suggested BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    FOREIGN KEY(match_key) REFERENCES match_meta(match_key)
  );

  CREATE INDEX IF NOT EXISTS idx_negotiation_match ON negotiation_history(match_key);
  CREATE INDEX IF NOT EXISTS idx_negotiation_status ON negotiation_history(status);

  -- Deal Analytics Table
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

  -- Email Settings Table
  CREATE TABLE IF NOT EXISTS email_settings (
    id BIGSERIAL PRIMARY KEY,
    smtp_host TEXT,
    smtp_port INTEGER DEFAULT 587,
    smtp_user TEXT,
    smtp_pass TEXT,
    smtp_secure BOOLEAN DEFAULT FALSE,
    from_email TEXT,
    from_name TEXT DEFAULT 'Inzerty Bot',
    enabled BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Email Templates Table
  CREATE TABLE IF NOT EXISTS email_templates (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Email Notifications Log Table
  CREATE TABLE IF NOT EXISTS email_notifications_log (
    id BIGSERIAL PRIMARY KEY,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'pending',
    error_message TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_email_log_sent_at ON email_notifications_log(sent_at);
  CREATE INDEX IF NOT EXISTS idx_email_log_status ON email_notifications_log(status);

  -- Calendar Events Table
  CREATE TABLE IF NOT EXISTS calendar_events (
    id BIGSERIAL PRIMARY KEY,
    match_key TEXT NOT NULL,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ,
    reminder_minutes INTEGER DEFAULT 30,
    status TEXT DEFAULT 'scheduled',
    ical_data TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY(match_key) REFERENCES match_meta(match_key)
  );

  CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events(start_at);
  CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(status);

  -- Meeting Feedback Table
  CREATE TABLE IF NOT EXISTS meeting_feedback (
    id BIGSERIAL PRIMARY KEY,
    match_key TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback_text TEXT,
    would_meet_again BOOLEAN,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY(match_key) REFERENCES match_meta(match_key)
  );

  -- ML Models Table
  CREATE TABLE IF NOT EXISTS ml_models (
    id BIGSERIAL PRIMARY KEY,
    model_name TEXT NOT NULL,
    model_type TEXT NOT NULL,
    version TEXT NOT NULL,
    model_data JSONB,
    trained_at TIMESTAMPTZ DEFAULT NOW(),
    accuracy DOUBLE PRECISION,
    is_active BOOLEAN DEFAULT FALSE,
    UNIQUE(model_name, version)
  );

  -- Negotiation Patterns Table
  CREATE TABLE IF NOT EXISTS negotiation_patterns (
    id BIGSERIAL PRIMARY KEY,
    pattern_type TEXT NOT NULL,
    pattern_data JSONB,
    success_rate DOUBLE PRECISION DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Message Templates Table
  CREATE TABLE IF NOT EXISTS message_templates (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    channel TEXT NOT NULL,
    side TEXT NOT NULL,
    subject TEXT,
    body TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name, channel, side)
  );

  -- Priority Weights Table
  CREATE TABLE IF NOT EXISTS priority_weights (
    id BIGSERIAL PRIMARY KEY,
    profitability_weight DOUBLE PRECISION DEFAULT 0.30,
    trustworthiness_weight DOUBLE PRECISION DEFAULT 0.25,
    urgency_weight DOUBLE PRECISION DEFAULT 0.20,
    market_trend_weight DOUBLE PRECISION DEFAULT 0.15,
    capacity_weight DOUBLE PRECISION DEFAULT 0.10,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Insert default weights
  INSERT INTO priority_weights (id, profitability_weight, trustworthiness_weight, urgency_weight, market_trend_weight, capacity_weight)
  VALUES (1, 0.30, 0.25, 0.20, 0.15, 0.10)
  ON CONFLICT (id) DO NOTHING;

  -- User Capacity Table
  CREATE TABLE IF NOT EXISTS user_capacity (
    id BIGSERIAL PRIMARY KEY,
    max_deals INTEGER DEFAULT 10,
    available_hours_per_week INTEGER DEFAULT 20,
    preferred_brands JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Market Trends Table
  CREATE TABLE IF NOT EXISTS market_trends (
    id BIGSERIAL PRIMARY KEY,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    avg_price DECIMAL(10,2),
    price_change_percent DOUBLE PRECISION DEFAULT 0,
    demand_level TEXT DEFAULT 'medium',
    data_points INTEGER DEFAULT 0,
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(brand, model)
  );

  -- Seller Reputation Table
  CREATE TABLE IF NOT EXISTS seller_reputation (
    id BIGSERIAL PRIMARY KEY,
    seller_identifier TEXT NOT NULL UNIQUE,
    total_transactions INTEGER DEFAULT 0,
    successful_transactions INTEGER DEFAULT 0,
    failed_transactions INTEGER DEFAULT 0,
    avg_response_time_hours DOUBLE PRECISION DEFAULT 0,
    fraud_flags_count INTEGER DEFAULT 0,
    reputation_score DOUBLE PRECISION DEFAULT 50,
    last_transaction_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Fraud Thresholds Table (SQLite compatible structure)
  CREATE TABLE IF NOT EXISTS fraud_thresholds (
    id INTEGER PRIMARY KEY,
    low_risk_max INTEGER DEFAULT 24,
    medium_risk_max INTEGER DEFAULT 49,
    high_risk_max INTEGER DEFAULT 79,
    critical_risk_min INTEGER DEFAULT 80,
    auto_watchlist_threshold INTEGER DEFAULT 80,
    enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Insert default thresholds
  INSERT INTO fraud_thresholds (id, low_risk_max, medium_risk_max, high_risk_max, critical_risk_min, auto_watchlist_threshold, enabled)
  VALUES (1, 24, 49, 79, 80, 80, TRUE)
  ON CONFLICT (id) DO NOTHING;

  -- Fraud Analysis History Table (SQLite compatible structure)
  CREATE TABLE IF NOT EXISTS fraud_analysis_history (
    id BIGSERIAL PRIMARY KEY,
    match_key TEXT NOT NULL,
    offer_url TEXT,
    demand_url TEXT,
    risk_level TEXT NOT NULL,
    risk_score INTEGER NOT NULL,
    flags TEXT,
    recommendation TEXT,
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    notes TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_fraud_history_match ON fraud_analysis_history(match_key);
  CREATE INDEX IF NOT EXISTS idx_fraud_history_risk ON fraud_analysis_history(risk_level);
  CREATE INDEX IF NOT EXISTS idx_fraud_history_analyzed ON fraud_analysis_history(analyzed_at);
`;

// ========================================
// SQLite Schema
// ========================================
export const SQLITE_SCHEMA = `
  -- Ads Table
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
    embedding TEXT,
    source TEXT DEFAULT 'bazos_cz',
    external_id TEXT,
    posted_at TEXT,
    seller_info TEXT,
    metadata TEXT,
    UNIQUE(url, ad_type)
  );

  -- Matches Table
  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    offer_id TEXT,
    demand_id TEXT,
    similarity_score REAL,
    is_ai_match INTEGER,
    created_at TEXT,
    UNIQUE(offer_id, demand_id),
    FOREIGN KEY(offer_id) REFERENCES ads(id),
    FOREIGN KEY(demand_id) REFERENCES ads(id)
  );

  -- Scrape Checkpoints Table
  CREATE TABLE IF NOT EXISTS scrape_checkpoints (
    brand TEXT NOT NULL,
    ad_type TEXT NOT NULL,
    last_seen_url TEXT,
    last_seen_date TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (brand, ad_type)
  );

  -- Match Meta Table
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
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Conversations Table
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_key TEXT NOT NULL,
    message TEXT NOT NULL,
    sender TEXT NOT NULL,
    channel TEXT,
    sent_at TEXT DEFAULT (datetime('now')),
    is_ai_generated INTEGER DEFAULT 0,
    context_snapshot TEXT,
    FOREIGN KEY(match_key) REFERENCES match_meta(match_key)
  );

  CREATE INDEX IF NOT EXISTS idx_conversations_match_key ON conversations(match_key);
  CREATE INDEX IF NOT EXISTS idx_conversations_sent_at ON conversations(sent_at);

  -- Deal States Table
  CREATE TABLE IF NOT EXISTS deal_states (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_key TEXT NOT NULL UNIQUE,
    state TEXT NOT NULL DEFAULT 'new',
    previous_state TEXT,
    state_changed_at TEXT DEFAULT (datetime('now')),
    last_contact_at TEXT,
    last_followup_at TEXT,
    followup_count INTEGER DEFAULT 0,
    auto_followup_enabled INTEGER DEFAULT 1,
    FOREIGN KEY(match_key) REFERENCES match_meta(match_key)
  );

  CREATE INDEX IF NOT EXISTS idx_deal_states_state ON deal_states(state);
  CREATE INDEX IF NOT EXISTS idx_deal_states_last_contact ON deal_states(last_contact_at);

  -- Follow-up Schedule Table
  CREATE TABLE IF NOT EXISTS followup_schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_key TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    sent_at TEXT,
    status TEXT DEFAULT 'pending',
    template_type TEXT,
    channel TEXT DEFAULT 'email',
    is_ai_generated INTEGER DEFAULT 0,
    FOREIGN KEY(match_key) REFERENCES match_meta(match_key)
  );

  CREATE INDEX IF NOT EXISTS idx_followup_schedule_scheduled ON followup_schedule(scheduled_at);
  CREATE INDEX IF NOT EXISTS idx_followup_schedule_status ON followup_schedule(status);

  -- Fraud Flags Table
  CREATE TABLE IF NOT EXISTS fraud_flags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ad_url TEXT NOT NULL,
    ad_title TEXT,
    risk_level TEXT NOT NULL,
    risk_score INTEGER NOT NULL,
    flags TEXT,
    detected_at TEXT DEFAULT (datetime('now')),
    is_resolved INTEGER DEFAULT 0,
    resolved_at TEXT,
    notes TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_fraud_flags_risk ON fraud_flags(risk_level);
  CREATE INDEX IF NOT EXISTS idx_fraud_flags_url ON fraud_flags(ad_url);

  -- Seller Watchlist Table
  CREATE TABLE IF NOT EXISTS seller_watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_identifier TEXT NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    risk_score INTEGER NOT NULL,
    added_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT,
    is_active INTEGER DEFAULT 1,
    incident_count INTEGER DEFAULT 1,
    notes TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_seller_watchlist_active ON seller_watchlist(is_active);

  -- Negotiation History Table
  CREATE TABLE IF NOT EXISTS negotiation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_key TEXT NOT NULL,
    offer_price REAL,
    counter_price REAL,
    final_price REAL,
    status TEXT,
    ai_suggested INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    responded_at TEXT,
    FOREIGN KEY(match_key) REFERENCES match_meta(match_key)
  );

  CREATE INDEX IF NOT EXISTS idx_negotiation_match ON negotiation_history(match_key);
  CREATE INDEX IF NOT EXISTS idx_negotiation_status ON negotiation_history(status);

  -- Deal Analytics Table
  CREATE TABLE IF NOT EXISTS deal_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_key TEXT NOT NULL UNIQUE,
    initial_profit REAL,
    final_profit REAL,
    time_to_close_hours INTEGER,
    negotiation_count INTEGER DEFAULT 0,
    followup_count INTEGER DEFAULT 0,
    success_rate REAL,
    created_at TEXT DEFAULT (datetime('now')),
    closed_at TEXT,
    FOREIGN KEY(match_key) REFERENCES match_meta(match_key)
  );

  CREATE INDEX IF NOT EXISTS idx_deal_analytics_closed ON deal_analytics(closed_at);

  -- Email Settings Table
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
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Email Templates Table
  CREATE TABLE IF NOT EXISTS email_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Email Notifications Log Table
  CREATE TABLE IF NOT EXISTS email_notifications_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    sent_at TEXT DEFAULT (datetime('now')),
    status TEXT DEFAULT 'pending',
    error_message TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_email_log_sent_at ON email_notifications_log(sent_at);
  CREATE INDEX IF NOT EXISTS idx_email_log_status ON email_notifications_log(status);

  -- Calendar Events Table
  CREATE TABLE IF NOT EXISTS calendar_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_key TEXT NOT NULL,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    start_at TEXT NOT NULL,
    end_at TEXT,
    reminder_minutes INTEGER DEFAULT 30,
    status TEXT DEFAULT 'scheduled',
    ical_data TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(match_key) REFERENCES match_meta(match_key)
  );

  CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events(start_at);
  CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(status);

  -- Meeting Feedback Table
  CREATE TABLE IF NOT EXISTS meeting_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_key TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback_text TEXT,
    would_meet_again INTEGER,
    submitted_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(match_key) REFERENCES match_meta(match_key)
  );

  -- ML Models Table
  CREATE TABLE IF NOT EXISTS ml_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_name TEXT NOT NULL,
    model_type TEXT NOT NULL,
    version TEXT NOT NULL,
    model_data TEXT,
    trained_at TEXT DEFAULT (datetime('now')),
    accuracy REAL,
    is_active INTEGER DEFAULT 0,
    UNIQUE(model_name, version)
  );

  -- Negotiation Patterns Table
  CREATE TABLE IF NOT EXISTS negotiation_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_type TEXT NOT NULL,
    pattern_data TEXT,
    success_rate REAL DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Message Templates Table
  CREATE TABLE IF NOT EXISTS message_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    channel TEXT NOT NULL,
    side TEXT NOT NULL,
    subject TEXT,
    body TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(name, channel, side)
  );

  -- Priority Weights Table
  CREATE TABLE IF NOT EXISTS priority_weights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profitability_weight REAL DEFAULT 0.30,
    trustworthiness_weight REAL DEFAULT 0.25,
    urgency_weight REAL DEFAULT 0.20,
    market_trend_weight REAL DEFAULT 0.15,
    capacity_weight REAL DEFAULT 0.10,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Insert default weights
  INSERT OR IGNORE INTO priority_weights (id, profitability_weight, trustworthiness_weight, urgency_weight, market_trend_weight, capacity_weight)
  VALUES (1, 0.30, 0.25, 0.20, 0.15, 0.10);

  -- User Capacity Table
  CREATE TABLE IF NOT EXISTS user_capacity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    max_deals INTEGER DEFAULT 10,
    available_hours_per_week INTEGER DEFAULT 20,
    preferred_brands TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Market Trends Table
  CREATE TABLE IF NOT EXISTS market_trends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    avg_price REAL,
    price_change_percent REAL DEFAULT 0,
    demand_level TEXT DEFAULT 'medium',
    data_points INTEGER DEFAULT 0,
    calculated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(brand, model)
  );

  -- Seller Reputation Table
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
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Fraud Thresholds Table
  CREATE TABLE IF NOT EXISTS fraud_thresholds (
    id INTEGER PRIMARY KEY,
    low_risk_max INTEGER DEFAULT 24,
    medium_risk_max INTEGER DEFAULT 49,
    high_risk_max INTEGER DEFAULT 79,
    critical_risk_min INTEGER DEFAULT 80,
    auto_watchlist_threshold INTEGER DEFAULT 80,
    enabled INTEGER DEFAULT 1,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Insert default thresholds
  INSERT OR IGNORE INTO fraud_thresholds (id, low_risk_max, medium_risk_max, high_risk_max, critical_risk_min, auto_watchlist_threshold, enabled)
  VALUES (1, 24, 49, 79, 80, 80, 1);

  -- Fraud Analysis History Table
  CREATE TABLE IF NOT EXISTS fraud_analysis_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_key TEXT NOT NULL,
    offer_url TEXT,
    demand_url TEXT,
    risk_level TEXT NOT NULL,
    risk_score INTEGER NOT NULL,
    flags TEXT,
    recommendation TEXT,
    analyzed_at TEXT DEFAULT (datetime('now')),
    is_resolved INTEGER DEFAULT 0,
    resolved_at TEXT,
    notes TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_fraud_history_match ON fraud_analysis_history(match_key);
  CREATE INDEX IF NOT EXISTS idx_fraud_history_risk ON fraud_analysis_history(risk_level);
  CREATE INDEX IF NOT EXISTS idx_fraud_history_analyzed ON fraud_analysis_history(analyzed_at);
`;

// ========================================
// Column migration definitions
// ========================================
export const POSTGRES_COLUMN_MIGRATIONS = [
  'ALTER TABLE ads ADD COLUMN IF NOT EXISTS model_ai TEXT',
  'ALTER TABLE ads ADD COLUMN IF NOT EXISTS embedding TEXT',
  'ALTER TABLE ads ADD COLUMN IF NOT EXISTS price_value DOUBLE PRECISION',
  'ALTER TABLE ads ADD COLUMN IF NOT EXISTS location TEXT',
  'ALTER TABLE ads ADD COLUMN IF NOT EXISTS description TEXT',
  'ALTER TABLE ads ADD COLUMN IF NOT EXISTS date_posted TEXT',
  'ALTER TABLE ads ADD COLUMN IF NOT EXISTS image_url TEXT',
  'ALTER TABLE ads ADD COLUMN IF NOT EXISTS ad_type TEXT',
  'ALTER TABLE ads ADD COLUMN IF NOT EXISTS brand TEXT',
  'ALTER TABLE ads ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ',
  'ALTER TABLE ads ADD COLUMN IF NOT EXISTS source TEXT DEFAULT \'bazos_cz\'',
  'ALTER TABLE ads ADD COLUMN IF NOT EXISTS external_id TEXT',
  'ALTER TABLE ads ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ',
  'ALTER TABLE ads ADD COLUMN IF NOT EXISTS seller_info JSONB',
  'ALTER TABLE ads ADD COLUMN IF NOT EXISTS metadata JSONB',
];

export interface SqliteColumnMigration {
  name: string;
  ddl: string;
}

export const SQLITE_COLUMN_MIGRATIONS: SqliteColumnMigration[] = [
  { name: 'model_ai', ddl: 'model_ai TEXT' },
  { name: 'embedding', ddl: 'embedding TEXT' },
  { name: 'price_value', ddl: 'price_value REAL' },
  { name: 'location', ddl: 'location TEXT' },
  { name: 'description', ddl: 'description TEXT' },
  { name: 'date_posted', ddl: 'date_posted TEXT' },
  { name: 'image_url', ddl: 'image_url TEXT' },
  { name: 'ad_type', ddl: 'ad_type TEXT' },
  { name: 'brand', ddl: 'brand TEXT' },
  { name: 'scraped_at', ddl: 'scraped_at TEXT' },
  { name: 'source', ddl: 'source TEXT DEFAULT \'bazos_cz\'' },
  { name: 'external_id', ddl: 'external_id TEXT' },
  { name: 'posted_at', ddl: 'posted_at TEXT' },
  { name: 'seller_info', ddl: 'seller_info TEXT' },
  { name: 'metadata', ddl: 'metadata TEXT' },
];
