/**
 * Database Type Definitions
 * 
 * TypeScript interfaces for database rows
 */

// ========================================
// Ads Table
// ========================================
export interface AdRow {
  id: string;
  title: string;
  price: string | null;
  price_value: number | null;
  location: string | null;
  description: string | null;
  date_posted: string;
  url: string;
  image_url: string | null;
  ad_type: string;
  brand: string;
  scraped_at: string;
  model_ai: string | null;
  embedding: string | null;
  source: string;
  external_id: string | null;
  posted_at: string | null;
  seller_info: string | null;  // JSON string
  metadata: string | null;      // JSON string
}

// ========================================
// Matches Table
// ========================================
export interface MatchRow {
  id: number;
  offer_id: string;
  demand_id: string;
  similarity_score: number;
  is_ai_match: boolean;
  created_at: string;
}

// ========================================
// Match Meta Table
// ========================================
export interface MatchMetaRow {
  match_key: string;
  status: string;
  note: string;
  priority: string;
  last_action_at: string;
  resolved: boolean;
  follow_up_at: string | null;
  follow_up_state: string;
  checklist_json: string | null;  // JSON string
  updated_at: string;
}

// ========================================
// Scrape Checkpoints Table
// ========================================
export interface ScrapeCheckpointRow {
  brand: string;
  ad_type: string;
  last_seen_url: string | null;
  last_seen_date: string | null;
  updated_at: string;
}

// ========================================
// Conversations Table
// ========================================
export interface ConversationRow {
  id: number;
  match_key: string;
  message: string;
  sender: string;  // 'user' | 'counterpart'
  channel: string;  // 'bazos' | 'sms' | 'email'
  sent_at: string;
  is_ai_generated: boolean;
  context_snapshot: string | null;  // JSON string
}

// ========================================
// Deal States Table
// ========================================
export interface DealStateRow {
  id: number;
  match_key: string;
  state: string;  // 'new' | 'contacted' | 'negotiating' | 'agreed' | 'meeting_scheduled' | 'completed' | 'cancelled' | 'stalled'
  previous_state: string | null;
  state_changed_at: string;
  last_contact_at: string | null;
  last_followup_at: string | null;
  followup_count: number;
  auto_followup_enabled: boolean;
}

// ========================================
// Follow-up Schedule Table
// ========================================
export interface FollowupScheduleRow {
  id: number;
  match_key: string;
  scheduled_at: string;
  sent_at: string | null;
  status: string;  // 'pending' | 'sent' | 'skipped' | 'cancelled'
  template_type: string | null;  // 'gentle_reminder' | 'urgent_followup' | 'final_check'
  channel: string;
  is_ai_generated: boolean;
}

// ========================================
// Fraud Flags Table
// ========================================
export interface FraudFlagRow {
  id: number;
  ad_url: string;
  ad_title: string | null;
  risk_level: string;  // 'low' | 'medium' | 'high' | 'critical'
  risk_score: number;
  flags: string | null;  // JSON string
  detected_at: string;
  is_resolved: boolean;
  resolved_at: string | null;
  notes: string | null;
}

// ========================================
// Seller Watchlist Table
// ========================================
export interface SellerWatchlistRow {
  id: number;
  seller_identifier: string;  // phone, email, or URL pattern
  reason: string;
  risk_score: number;
  added_at: string;
  expires_at: string | null;
  is_active: boolean;
  incident_count: number;
  notes: string | null;
}

// ========================================
// Negotiation History Table
// ========================================
export interface NegotiationHistoryRow {
  id: number;
  match_key: string;
  offer_price: number | null;
  counter_price: number | null;
  final_price: number | null;
  status: string;  // 'pending' | 'accepted' | 'rejected' | 'cancelled'
  ai_suggested: boolean;
  created_at: string;
  responded_at: string | null;
}

// ========================================
// Deal Analytics Table
// ========================================
export interface DealAnalyticsRow {
  id: number;
  match_key: string;
  initial_profit: number | null;
  final_profit: number | null;
  time_to_close_hours: number | null;
  negotiation_count: number;
  followup_count: number;
  success_rate: number | null;
  created_at: string;
  closed_at: string | null;
}

// ========================================
// Fraud Analysis History Table
// ========================================
export interface FraudAnalysisHistoryRow {
  id: number;
  match_key: string;
  offer_url: string;
  demand_url: string;
  risk_level: string;
  risk_score: number;
  flags: string | null;  // JSON string
  recommendation: string | null;
  analyzed_at: string;
  is_resolved: number;  // SQLite uses 0/1 for boolean
  resolved_at: string | null;
  notes: string | null;
}

// ========================================
// Fraud Thresholds Table
// ========================================
export interface FraudThresholdsRow {
  id: number;
  low_risk_max: number;
  medium_risk_max: number;
  high_risk_max: number;
  critical_risk_min: number;
  auto_watchlist_threshold: number;
  enabled: number;  // SQLite uses 0/1 for boolean
  updated_at: string;
}

// ========================================
// Seller Reputation Table
// ========================================
export interface SellerReputationRow {
  id: number;
  seller_identifier: string;
  total_transactions: number;
  successful_transactions: number;
  failed_transactions: number;
  avg_response_time_hours: number;
  fraud_flags_count: number;
  reputation_score: number;
  last_transaction_at: string | null;
  created_at: string;
  updated_at: string;
}

// ========================================
// Email Settings Table
// ========================================
export interface EmailSettingsRow {
  id: number;
  smtp_host: string | null;
  smtp_port: number;
  smtp_user: string | null;
  smtp_pass: string | null;
  smtp_secure: number;  // SQLite uses 0/1 for boolean
  from_email: string | null;
  from_name: string;
  enabled: number;  // SQLite uses 0/1 for boolean
  updated_at: string;
}

// ========================================
// Email Templates Table
// ========================================
export interface EmailTemplateRow {
  id: number;
  name: string;
  subject: string;
  body: string;
  updated_at: string;
}

// ========================================
// Calendar Events Table
// ========================================
export interface CalendarEventRow {
  id: number;
  match_key: string;
  event_type: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  reminder_minutes: number;
  status: string;  // 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
  ical_data: string | null;
  created_at: string;
  updated_at: string;
}

// ========================================
// Meeting Feedback Table
// ========================================
export interface MeetingFeedbackRow {
  id: number;
  match_key: string;
  rating: number;
  feedback_text: string | null;
  would_meet_again: boolean;
  submitted_at: string;
}

// ========================================
// ML Models Table
// ========================================
export interface MLModelRow {
  id: number;
  model_name: string;
  model_type: string;
  version: string;
  model_data: string | null;  // JSON string
  trained_at: string;
  accuracy: number | null;
  is_active: boolean;
}

// ========================================
// Negotiation Patterns Table
// ========================================
export interface NegotiationPatternRow {
  id: number;
  pattern_type: string;
  pattern_data: string | null;  // JSON string
  success_rate: number;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

// ========================================
// Message Templates Table
// ========================================
export interface MessageTemplateRow {
  id: number;
  name: string;
  channel: string;  // 'bazos' | 'sms' | 'email'
  side: string;  // 'seller' | 'buyer'
  subject: string | null;
  body: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// ========================================
// Priority Weights Table
// ========================================
export interface PriorityWeightsRow {
  id: number;
  profitability_weight: number;
  trustworthiness_weight: number;
  urgency_weight: number;
  market_trend_weight: number;
  capacity_weight: number;
  updated_at: string;
}

// ========================================
// User Capacity Table
// ========================================
export interface UserCapacityRow {
  id: number;
  max_deals: number;
  available_hours_per_week: number;
  preferred_brands: string | null;  // JSON string
  updated_at: string;
}

// ========================================
// Market Trends Table
// ========================================
export interface MarketTrendRow {
  id: number;
  brand: string;
  model: string;
  avg_price: number;
  price_change_percent: number;
  demand_level: string;  // 'low' | 'medium' | 'high'
  data_points: number;
  calculated_at: string;
}

// ========================================
// Cache Table (for AI responses)
// ========================================
export interface CacheRow {
  id: number;
  cache_key: string;
  cache_value: string | null;  // JSON string
  expires_at: string;
  created_at: string;
}

// ========================================
// Runtime Logs Table
// ========================================
export interface RuntimeLogRow {
  id: number;
  message: string;
  type: string;  // 'info' | 'success' | 'error' | 'system'
  timestamp: string;
}

// ========================================
// Union type for all rows (for generic functions)
// ========================================
export type AnyRow = Record<string, any>;

// ========================================
// Additional Types (for backward compatibility)
// ========================================
export type DealState = 'new' | 'contacted' | 'negotiating' | 'agreed' | 'meeting_scheduled' | 'completed' | 'cancelled' | 'stalled';

export interface FraudFlag {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  evidence: string;
}
