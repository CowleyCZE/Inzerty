/**
 * Database Module
 * 
 * Central export point for database functionality
 */

// Connection management
export {
  getSqliteDb,
  getPgPool,
  usingPostgres,
  usingSqlite,
  getDbClient,
  closeDbConnections,
} from './connection.js';

// Database initialization
export {
  initDb,
  isPgVectorAvailable,
  clearDatabase,
} from './init.js';

// Transaction management
export {
  runTransaction,
  runTransactionWithRetry,
  runBatch,
} from './transactions.js';
export type { TransactionCallback } from './transactions.js';

// Type definitions
export type {
  AdRow,
  MatchRow,
  MatchMetaRow,
  ScrapeCheckpointRow,
  ConversationRow,
  DealStateRow,
  FollowupScheduleRow,
  FraudFlagRow,
  SellerWatchlistRow,
  NegotiationHistoryRow,
  DealAnalyticsRow,
  FraudAnalysisHistoryRow,
  FraudThresholdsRow,
  SellerReputationRow,
  EmailSettingsRow,
  EmailTemplateRow,
  CalendarEventRow,
  MeetingFeedbackRow,
  MLModelRow,
  NegotiationPatternRow,
  MessageTemplateRow,
  PriorityWeightsRow,
  UserCapacityRow,
  MarketTrendRow,
  CacheRow,
  RuntimeLogRow,
  AnyRow,
  FraudFlag,
} from './types.js';

// Schema definitions
export {
  POSTGRES_SCHEMA,
  SQLITE_SCHEMA,
  POSTGRES_COLUMN_MIGRATIONS,
  SQLITE_COLUMN_MIGRATIONS,
} from './schema.js';
export type { SqliteColumnMigration } from './schema.js';

// Query builders
export * from './query-builders/match-filters.query-builder.js';

// Repositories
export * from './repositories/ads.repository.js';
export * from './repositories/matches.repository.js';
export * from './repositories/fraud.repository.js';
export {
  saveDealAnalytics,
  getAnalytics,
  getAnalyticsByPeriod,
  closeDeal,
  incrementNegotiationCount,
} from './repositories/analytics.repository.js';
export * from './repositories/settings.repository.js';
export * from './repositories/checkpoints.repository.js';
export * from './repositories/conversations.repository.js';
export {
  initDealState,
  updateDealState,
  getDealState,
  getAllDealStates,
  markDealContacted,
  markDealStalled,
  incrementFollowupCount,
  scheduleFollowup,
  getPendingFollowups,
  markFollowupSent,
  getDealPipeline,
  getStalledDeals,
} from './repositories/deal-states.repository.js';
export type { DealState, DealStateInput, FollowupInput, DealPipelineStats } from './repositories/deal-states.repository.js';
export * from './repositories/calendar.repository.js';
export * from './repositories/negotiation.repository.js';
export * from './repositories/meeting-feedback.repository.js';
export * from './repositories/ml-models.repository.js';
export * from './repositories/negotiation-patterns.repository.js';
