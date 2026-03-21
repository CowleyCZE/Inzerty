/**
 * AI Response Cache - Cache pro AI odpovědi
 * 
 * Poskytuje caching pro AI responses s:
 * - Time-to-live (TTL) pro každý záznam
 * - Automatickým cleanupem expirovaných záznamů
 * - Omezováním počtu záznamů (max 1000)
 * - Pattern-based mazáním
 */

export interface CachedResponse {
  data: any;
  timestamp: number;
  ttl: number; // time to live in ms
}

export interface CacheConfig {
  defaultTTL: number;
  maxEntries: number;
  cleanupInterval?: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  defaultTTL: 15 * 60 * 1000, // 15 minutes
  maxEntries: 1000,
  cleanupInterval: 5 * 60 * 1000, // 5 minutes
};

export class AIResponseCache {
  private cache: Map<string, CachedResponse>;
  private config: CacheConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new Map();
    this.startAutoCleanup();
  }

  /**
   * Vytvoří cache key z promptu a modelu
   */
  static generateKey(prompt: string, model: string): string {
    return `ai:${model}:${Buffer.from(prompt).toString('base64').substring(0, 64)}`;
  }

  /**
   * Získá cached response podle key
   */
  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    // Expirovaný záznam - odstranit
    this.cache.delete(key);
    return null;
  }

  /**
   * Uloží response do cache
   */
  set(key: string, data: any, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.config.defaultTTL,
    });

    // Cleanup pokud je příliš mnoho záznamů
    if (this.cache.size > this.config.maxEntries) {
      this.cleanup();
    }
  }

  /**
   * Smaže záznam z cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Smaže všechny záznamy matching pattern
   */
  deleteByPattern(pattern: string): void {
    this.cache.forEach((_, key) => {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    });
  }

  /**
   * Vymaže celou cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Cleanup expirovaných záznamů
   */
  cleanup(): number {
    const now = Date.now();
    let expiredCount = 0;
    const keysToDelete: string[] = [];

    this.cache.forEach((value, key) => {
      if (now - value.timestamp > value.ttl) {
        keysToDelete.push(key);
        expiredCount++;
      }
    });
    keysToDelete.forEach(key => this.cache.delete(key));

    // Pokud stále máme příliš mnoho záznamů, odstranit nejstarší
    if (this.cache.size > this.config.maxEntries) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = this.cache.size - this.config.maxEntries;
      for (let i = 0; i < toRemove; i++) {
        const entry = entries[i];
        if (entry) {
          this.cache.delete(entry[0]);
        }
      }
    }

    return expiredCount;
  }

  /**
   * Spustí automatický cleanup
   */
  private startAutoCleanup(): void {
    if (this.config.cleanupInterval && !this.cleanupInterval) {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, this.config.cleanupInterval);
    }
  }

  /**
   * Zastaví automatický cleanup
   */
  stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Získá statistiky cache
   */
  getStats(): {
    size: number;
    maxEntries: number;
    defaultTTL: number;
    entries: Array<{
      key: string;
      age: number;
      ttl: number;
      isExpired: boolean;
    }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, value]) => ({
      key,
      age: now - value.timestamp,
      ttl: value.ttl,
      isExpired: now - value.timestamp >= value.ttl,
    }));

    return {
      size: this.cache.size,
      maxEntries: this.config.maxEntries,
      defaultTTL: this.config.defaultTTL,
      entries,
    };
  }

  /**
   * Získá počet platných záznamů
   */
  getValidCount(): number {
    const now = Date.now();
    let count = 0;
    this.cache.forEach((value) => {
      if (now - value.timestamp < value.ttl) {
        count++;
      }
    });
    return count;
  }

  /**
   * Získá počet expirovaných záznamů
   */
  getExpiredCount(): number {
    const now = Date.now();
    let count = 0;
    for (const value of this.cache.values()) {
      if (value && now - value.timestamp >= value.ttl) {
        count++;
      }
    }
    return count;
  }

  /**
   * Uvolní zdroje
   */
  dispose(): void {
    this.stopAutoCleanup();
    this.clear();
  }
}

// Singleton instance pro globální použití
export const aiResponseCache = new AIResponseCache();

// Export convenience funkcí pro kompatibilitu s původním kódem
export const getCachedAIResponse = (key: string): any | null => {
  return aiResponseCache.get(key);
};

export const setCachedAIResponse = (key: string, data: any, ttl?: number): void => {
  aiResponseCache.set(key, data, ttl);
};

export const clearAICache = (pattern?: string): void => {
  if (pattern) {
    aiResponseCache.deleteByPattern(pattern);
  } else {
    aiResponseCache.clear();
  }
};

export const getAICacheKey = (prompt: string, model: string): string => {
  return AIResponseCache.generateKey(prompt, model);
};
