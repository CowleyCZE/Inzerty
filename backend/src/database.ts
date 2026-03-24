/**
 * Database Module - Backend Bridge
 * 
 * Provides a unified API for database operations by aggregating exports from
 * specialized repository modules.
 */

// Core Connection & Utils
export * from './database/connection.js';
export { initDb, isPgVectorAvailable, clearDatabase } from './database/init.js';
export { runTransaction, runTransactionWithRetry, runBatch } from './database/transactions.js';
export type { TransactionCallback } from './database/transactions.js';

// Types
export * from './database/types.js';

// Schema & Builders
export { 
  POSTGRES_SCHEMA, 
  SQLITE_SCHEMA, 
  POSTGRES_COLUMN_MIGRATIONS, 
  SQLITE_COLUMN_MIGRATIONS 
} from './database/schema.js';
export type { SqliteColumnMigration } from './database/schema.js';
export * from './database/query-builders/match-filters.query-builder.js';

// Repositories
export * from './database/repositories/ads.repository.js';
export {
  saveAd,
  getAllAds,
  getAdsByType as getAllAdsByType, // Alias for legacy support
  getRecentScrapedUrls,
  updateAdModelAi,
  updateAdEmbedding,
  getAdsByBrand,
  getAdByUrl,
  getAdById,
  deleteAllAds,
  getAdsCount,
} from './database/repositories/ads.repository.js';

export * from './database/repositories/matches.repository.js';

export * from './database/repositories/fraud.repository.js';

export {
  saveDealAnalytics,
  getAnalytics,
  getAnalyticsByPeriod,
  closeDeal,
  incrementNegotiationCount,
  incrementFollowupCount as incrementFollowupCountAnalytics, // Alias for legacy support
} from './database/repositories/analytics.repository.js';

export * from './database/repositories/settings.repository.js';
export * from './database/repositories/checkpoints.repository.js';
export * from './database/repositories/conversations.repository.js';

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
} from './database/repositories/deal-states.repository.js';
export type { DealState, DealStateInput, FollowupInput, DealPipelineStats } from './database/repositories/deal-states.repository.js';

export * from './database/repositories/calendar.repository.js';

export {
  saveNegotiation,
  updateNegotiation,
  getNegotiationHistory as getNegotiationHistoryLegacy, // Alias for legacy support
  getNegotiationStats,
  saveNegotiationMessage,
  getPendingNegotiations,
  getNegotiationsByStatus,
  cancelNegotiation,
} from './database/repositories/negotiation.repository.js';

export * from './database/repositories/meeting-feedback.repository.js';
export * from './database/repositories/ml-models.repository.js';
export * from './database/repositories/negotiation-patterns.repository.js';
