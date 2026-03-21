/**
 * Runtime Logger - Správa runtime logů pro backend
 * 
 * Poskytuje centrální logging funkcionalitu s:
 * - Automatickým omezováním počtu záznamů
 * - Různými typy logů (info, success, error, system)
 * - Konzolovým výstupem
 * - In-memory úložištěm pro API endpointy
 */

import { randomUUID } from 'crypto';

export type LogType = 'info' | 'success' | 'error' | 'system';

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: LogType;
}

export interface LoggerConfig {
  maxEntries: number;
  consoleOutput: boolean;
}

const DEFAULT_CONFIG: LoggerConfig = {
  maxEntries: 500,
  consoleOutput: true,
};

class RuntimeLogger {
  private logs: LogEntry[] = [];
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Přidá nový log entry
   */
  log(message: string, type: LogType = 'info'): LogEntry {
    const entry: LogEntry = {
      id: randomUUID(),
      timestamp: new Date().toLocaleTimeString('cs-CZ'),
      message,
      type,
    };

    this.logs.push(entry);

    // Omezit počet záznamů
    if (this.logs.length > this.config.maxEntries) {
      this.logs.splice(0, this.logs.length - this.config.maxEntries);
    }

    // Konzolový výstup
    if (this.config.consoleOutput) {
      if (type === 'error') {
        console.error(`[${entry.timestamp}] ${message}`);
      } else {
        console.log(`[${entry.timestamp}] ${message}`);
      }
    }

    return entry;
  }

  /**
   * Získá všechny logy
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Získá logy podle typu
   */
  getLogsByType(type: LogType): LogEntry[] {
    return this.logs.filter((log) => log.type === type);
  }

  /**
   * Získá posledních N logů
   */
  getRecentLogs(limit: number = 100): LogEntry[] {
    return this.logs.slice(-limit);
  }

  /**
   * Vymaže všechny logy
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Vymaže staré error logy
   */
  cleanupOldErrors(maxAgeMinutes: number = 60): void {
    const cutoff = Date.now() - maxAgeMinutes * 60 * 1000;
    this.logs = this.logs.filter((log) => {
      if (log.type !== 'error') return true;
      const logTime = new Date(log.timestamp).getTime();
      return logTime > cutoff;
    });
  }

  /**
   * Získá statistiky logů
   */
  getStats(): {
    total: number;
    byType: Record<LogType, number>;
    oldestTimestamp: string | null;
    newestTimestamp: string | null;
  } {
    const byType = {
      info: this.logs.filter((l) => l.type === 'info').length,
      success: this.logs.filter((l) => l.type === 'success').length,
      error: this.logs.filter((l) => l.type === 'error').length,
      system: this.logs.filter((l) => l.type === 'system').length,
    };

    return {
      total: this.logs.length,
      byType,
      oldestTimestamp: this.logs[0]?.timestamp || null,
      newestTimestamp: this.logs[this.logs.length - 1]?.timestamp || null,
    };
  }

  /**
   * Convenience metody pro různé typy logů
   */
  info(message: string): LogEntry {
    return this.log(message, 'info');
  }

  success(message: string): LogEntry {
    return this.log(message, 'success');
  }

  error(message: string): LogEntry {
    return this.log(message, 'error');
  }

  system(message: string): LogEntry {
    return this.log(message, 'system');
  }
}

// Singleton instance pro globální použití
export const runtimeLogger = new RuntimeLogger();

// Export convenience funkcí pro kompatibilitu s původním kódem
export const pushRuntimeLog = (message: string, type: LogType = 'info'): LogEntry => {
  return runtimeLogger.log(message, type);
};

export const getRuntimeLogs = (): LogEntry[] => {
  return runtimeLogger.getLogs();
};

export const clearRuntimeLogs = (): void => {
  runtimeLogger.clear();
};

export { RuntimeLogger };
