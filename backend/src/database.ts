/**
 * Database Module - Backward Compatibility Layer
 * 
 * This file re-exports all functions from the new repository structure
 * to maintain backward compatibility with existing imports.
 * 
 * New code should import directly from the repository files:
 * - import { saveAd } from './database/repositories/ads.repository.js';
 * 
 * Legacy code can continue to import from this file:
 * - import { saveAd } from './database.js';
 */

// ========================================
// Core Database Functions
// ========================================
export {
  getSqliteDb,
  getPgPool,
  usingPostgres,
  usingSqlite,
  getDbClient,
  closeDbConnections,
} from './database/connection.js';

// Database initialization
export { initDb, isPgVectorAvailable, clearDatabase } from './database/init.js';

// ========================================
// Transaction Management
// ========================================
export {
  runTransaction,
  runTransactionWithRetry,
  runBatch,
} from './database/transactions.js';
export type { TransactionCallback } from './database/transactions.js';

// ========================================
// Type Definitions
// ========================================
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
  DealState,
} from './database/types.js';

// ========================================
// Schema Definitions
// ========================================
export {
  POSTGRES_SCHEMA,
  SQLITE_SCHEMA,
  POSTGRES_COLUMN_MIGRATIONS,
  SQLITE_COLUMN_MIGRATIONS,
} from './database/schema.js';
export type { SqliteColumnMigration } from './database/schema.js';

// ========================================
// Query Builders
// ========================================
export {
  buildMatchFilterQuery,
  buildMatchStatsQuery,
  buildMatchesByBrandQuery,
} from './database/query-builders/match-filters.query-builder.js';
export type { MatchFilterOptions, MatchFilterResult } from './database/query-builders/match-filters.query-builder.js';

// ========================================
// Ads Repository
// ========================================
export {
  saveAd,
  getAllAds,
  getAdsByType as getAllAdsByType,
  getRecentScrapedUrls,
  updateAdModelAi,
  updateAdEmbedding,
  getAdsByBrand,
  getAdByUrl,
  getAdById,
  deleteAllAds,
  getAdsCount,
} from './database/repositories/ads.repository.js';
export type { AdInput } from './database/repositories/ads.repository.js';

// ========================================
// Matches Repository
// ========================================
export {
  saveMatch,
  getPgVectorSimilarities,
  saveMatchMeta,
  getAllMatchMeta,
  getResolvedMatchKeys,
  getPreviouslySeenMatchKeys,
  markMatchesAsSeen,
  bulkUpdateMatches,
  getFollowUps,
  getMatchMetaByKey,
  getDailyMetaStats,
} from './database/repositories/matches.repository.js';
export type {
  MatchInput,
  MatchMetaInput,
  FollowUpFilter,
  FollowUpResult,
} from './database/repositories/matches.repository.js';

// ========================================
// Fraud Repository
// ========================================
export {
  saveFraudFlag,
  getFraudFlags,
  resolveFraudFlag,
  addToWatchlist,
  getWatchlist,
  isSellerOnWatchlist,
  removeFromWatchlist,
  saveFraudAnalysis,
  getFraudAnalysisHistory,
  getFraudAnalysisStats,
  saveFraudThresholds,
  getFraudThresholds,
  getRiskLevel,
} from './database/repositories/fraud.repository.js';
export type { FraudFlagInput, WatchlistInput } from './database/repositories/fraud.repository.js';

// ========================================
// Analytics Repository
// ========================================
export {
  saveDealAnalytics,
  getAnalytics,
  getAnalyticsByPeriod,
  closeDeal,
  incrementNegotiationCount,
  incrementFollowupCount as incrementFollowupCountAnalytics,
} from './database/repositories/analytics.repository.js';
export type { DealAnalyticsInput } from './database/repositories/analytics.repository.js';

// ========================================
// Settings Repository
// ========================================
export {
  saveEmailSettings,
  getEmailSettings,
  saveEmailTemplate,
  getEmailTemplate,
  getAllEmailTemplates,
  saveMessageTemplate,
  getMessageTemplate,
  getAllMessageTemplates,
  savePriorityWeights,
  getPriorityWeights,
  logEmailNotification,
} from './database/repositories/settings.repository.js';
export type {
  EmailSettingsInput,
  EmailTemplateInput,
  MessageTemplateInput,
} from './database/repositories/settings.repository.js';

// ========================================
// Checkpoints Repository
// ========================================
export {
  getScrapeCheckpoint,
  updateScrapeCheckpoint,
  getAllCheckpoints,
  deleteCheckpoint,
  clearAllCheckpoints,
} from './database/repositories/checkpoints.repository.js';

// ========================================
// Conversations Repository
// ========================================
export {
  saveConversation,
  getConversationHistory,
  getLastConversation,
  getConversationStats,
  getConversationsByChannel,
  deleteConversations,
} from './database/repositories/conversations.repository.js';
export type { ConversationInput } from './database/repositories/conversations.repository.js';

// ========================================
// Deal States Repository
// ========================================
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
export type { DealStateInput, FollowupInput, DealPipelineStats } from './database/repositories/deal-states.repository.js';

// ========================================
// Calendar Repository
// ========================================
export {
  saveCalendarEvent,
  getCalendarEvent,
  getUpcomingCalendarEvents,
  updateCalendarEventStatus,
  generateICal,
  deleteCalendarEvent,
  getCalendarEventsByStatus,
} from './database/repositories/calendar.repository.js';
export type { CalendarEventInput } from './database/repositories/calendar.repository.js';

// ========================================
// Negotiation Repository
// ========================================
export {
  saveNegotiation,
  updateNegotiation,
  getNegotiationHistory as getNegotiationHistoryLegacy,
  getNegotiationStats,
  saveNegotiationMessage,
  getPendingNegotiations,
  getNegotiationsByStatus,
  cancelNegotiation,
} from './database/repositories/negotiation.repository.js';
export type { NegotiationInput, NegotiationStats } from './database/repositories/negotiation.repository.js';

// ========================================
// Meeting Feedback Repository
// ========================================
export {
  saveMeetingFeedback,
  getMeetingFeedback,
  getFeedbackStats,
} from './database/repositories/meeting-feedback.repository.js';
export type { MeetingFeedbackInput } from './database/repositories/meeting-feedback.repository.js';

// ========================================
// ML Models Repository
// ========================================
export {
  saveMLModel,
  getMLModel,
  getAllMLModels,
  getActiveMLModels,
  setModelActive,
  deleteMLModel,
  getModelsByType,
} from './database/repositories/ml-models.repository.js';
export type { MLModelInput } from './database/repositories/ml-models.repository.js';

// ========================================
// Negotiation Patterns Repository
// ========================================
export {
  saveNegotiationPattern,
  getNegotiationPatterns,
  getNegotiationPattern,
  updatePatternUsage,
  getMostSuccessfulPatterns,
  deleteNegotiationPattern,
  getPatternStats,
} from './database/repositories/negotiation-patterns.repository.js';
export type { NegotiationPatternInput } from './database/repositories/negotiation-patterns.repository.js';

// ========================================
// Legacy Functions (not yet migrated)
// ========================================
// All functions have been migrated. This section is kept for future use.
