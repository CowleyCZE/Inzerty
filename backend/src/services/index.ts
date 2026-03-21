/**
 * Services - Business logic services
 * 
 * Export všech services z jednoho místa pro snadné importování
 */

// Scraping Service
export {
  scrapeAllBrands,
  scrapeUrl,
} from './scraping.service.js';
export type {
  ScrapingOptions,
  ScrapingResult,
  ScrapingSummary,
} from './scraping.service.js';

// Matching Service
export {
  findMatches,
} from './matching.service.js';
export type {
  MatchResult,
  MatchingOptions,
  MatchingSummary,
} from './matching.service.js';

// AI Service
export {
  extractModelWithAI,
  extractModelHeuristic,
  getEmbeddingFromOllama,
  generateAIMessage,
  analyzeFraud,
  suggestMeetingPlaces,
  calculatePriorityScore,
} from './ai.service.js';
export type {
  MessageContext,
  AIMessageResult,
  FraudAnalysisResult,
  FraudFlag,
  MeetingSuggestion,
} from './ai.service.js';
