/**
 * Utils - Helper utility moduly
 * 
 * Export všech utilit z jednoho místa pro snadné importování
 */

// Logger
export {
  RuntimeLogger,
  runtimeLogger,
  pushRuntimeLog,
  getRuntimeLogs,
  clearRuntimeLogs,
} from './logger.js';
export type { LogEntry, LogType, LoggerConfig } from './logger.js';

// Cache
export {
  AIResponseCache,
  aiResponseCache,
  getCachedAIResponse,
  setCachedAIResponse,
  clearAICache,
  getAICacheKey,
} from './cache.js';
export type { CachedResponse, CacheConfig } from './cache.js';

// Ollama Manager
export {
  OllamaManager,
  ollamaManager,
  checkOllamaStatus,
  startOllama,
  stopOllama,
  toggleOllama,
  getOllamaStatus,
  setOllamaModel,
  getOllamaModel,
  getOllamaBaseUrl,
  isOllamaLocal,
} from './ollama-manager.js';
export type {
  OllamaManagerConfig,
  OllamaStatus,
  OllamaToggleResult,
} from './ollama-manager.js';
