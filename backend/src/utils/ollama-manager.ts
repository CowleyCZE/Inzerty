/**
 * Ollama Manager - Správa Ollama procesu
 * 
 * Poskytuje management pro Ollama server s:
 * - Start/Stop funkcionalitou
 * - Status checking
 * - Remote Ollama podporou
 * - Process management
 */

import axios from 'axios';
import { spawn, ChildProcess } from 'child_process';

export interface OllamaManagerConfig {
  baseUrl: string;
  isLocal: boolean;
  defaultModel: string;
}

export interface OllamaStatus {
  isRunning: boolean;
  isLocal: boolean;
  baseUrl: string;
  model?: string;
}

export interface OllamaToggleResult {
  success: boolean;
  message: string;
  isRunning: boolean;
}

export class OllamaManager {
  private config: OllamaManagerConfig;
  private ollamaProcess: ChildProcess | null = null;
  private isRunning: boolean = false;
  private currentModel: string;

  constructor(config: Partial<OllamaManagerConfig> = {}) {
    const baseUrl = config.baseUrl || process.env.OLLAMA_URL || 'http://localhost:11434';
    this.config = {
      baseUrl,
      isLocal: baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1'),
      defaultModel: config.defaultModel || process.env.OLLAMA_MODEL || 'all-minilm:22m',
    };
    this.currentModel = this.config.defaultModel;
  }

  /**
   * Zkontroluje zda Ollama běží
   */
  async checkStatus(): Promise<boolean> {
    try {
      await axios.get(`${this.config.baseUrl}/api/tags`, { timeout: 5000 });
      this.isRunning = true;
      return true;
    } catch (e) {
      this.isRunning = false;
      return false;
    }
  }

  /**
   * Spustí Ollama server
   */
  async start(): Promise<OllamaToggleResult> {
    // Zkontrolovat zda už neběží
    const alreadyRunning = await this.checkStatus();
    if (alreadyRunning) {
      return {
        success: true,
        message: 'Ollama již běží.',
        isRunning: true,
      };
    }

    // Remote Ollama nelze spustit
    if (!this.config.isLocal) {
      return {
        success: false,
        message: `Nelze spustit vzdálený Ollama server na ${this.config.baseUrl}`,
        isRunning: false,
      };
    }

    // Spustit Ollama v backgroundu
    try {
      this.ollamaProcess = spawn('ollama', ['serve'], {
        detached: true,
        stdio: 'ignore',
        shell: true,
      });

      // Odpojit proces od rodiče
      this.ollamaProcess.unref();

      // Nastavit flag že se spouští
      this.isRunning = true;

      return {
        success: true,
        message: 'Ollama se spouští...',
        isRunning: false, // Ještě neběží, jen se spouští
      };
    } catch (error) {
      this.isRunning = false;
      return {
        success: false,
        message: `Chyba při spouštění Ollama: ${error instanceof Error ? error.message : 'Neznámá chyba'}`,
        isRunning: false,
      };
    }
  }

  /**
   * Zastaví Ollama server
   */
  async stop(): Promise<OllamaToggleResult> {
    console.log('[OllamaManager] Stopping Ollama');
    this.isRunning = false;

    // Remote Ollama nelze zastavit
    if (!this.config.isLocal) {
      return {
        success: true,
        message: 'Vzdálený Ollama server nelze zastavit z této aplikace.',
        isRunning: false,
      };
    }

    // Lokální proces lze zastavit
    if (this.ollamaProcess) {
      try {
        // Kill the process tree
        process.kill(-this.ollamaProcess.pid!, 'SIGTERM');
        this.ollamaProcess = null;
      } catch (error) {
        console.error('[OllamaManager] Error stopping process:', error);
      }
    }

    return {
      success: true,
      message: 'Ollama zastavena.',
      isRunning: false,
    };
  }

  /**
   * Toggle mezi start/stop
   */
  async toggle(action: 'start' | 'stop'): Promise<OllamaToggleResult> {
    if (action === 'start') {
      return this.start();
    } else {
      return this.stop();
    }
  }

  /**
   * Získá aktuální status
   */
  async getStatus(): Promise<OllamaStatus> {
    const isRunning = await this.checkStatus();
    return {
      isRunning,
      isLocal: this.config.isLocal,
      baseUrl: this.config.baseUrl,
      model: this.currentModel,
    };
  }

  /**
   * Nastaví model
   */
  setModel(model: string): void {
    this.currentModel = model.trim();
  }

  /**
   * Získá aktuální model
   */
  getModel(): string {
    return this.currentModel;
  }

  /**
   * Získá base URL
   */
  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  /**
   * Získá zda je lokální
   */
  isLocal(): boolean {
    return this.config.isLocal;
  }

  /**
   * Získá zda běží
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Vytvoří URL pro API endpoint
   */
  createUrl(endpoint: string): string {
    return `${this.config.baseUrl}${endpoint}`;
  }

  /**
   * Cleanup při ukončení
   */
  dispose(): void {
    if (this.ollamaProcess) {
      try {
        process.kill(-this.ollamaProcess.pid!, 'SIGTERM');
      } catch {
        // Ignore errors during cleanup
      }
      this.ollamaProcess = null;
    }
    this.isRunning = false;
  }
}

// Singleton instance pro globální použití
export const ollamaManager = new OllamaManager();

// Export convenience funkcí pro kompatibilitu s původním kódem
export const checkOllamaStatus = (): Promise<boolean> => {
  return ollamaManager.checkStatus();
};

export const startOllama = (): Promise<OllamaToggleResult> => {
  return ollamaManager.start();
};

export const stopOllama = (): Promise<OllamaToggleResult> => {
  return ollamaManager.stop();
};

export const toggleOllama = (action: 'start' | 'stop'): Promise<OllamaToggleResult> => {
  return ollamaManager.toggle(action);
};

export const getOllamaStatus = (): Promise<OllamaStatus> => {
  return ollamaManager.getStatus();
};

export const setOllamaModel = (model: string): void => {
  ollamaManager.setModel(model);
};

export const getOllamaModel = (): string => {
  return ollamaManager.getModel();
};

export const getOllamaBaseUrl = (): string => {
  return ollamaManager.getBaseUrl();
};

export const isOllamaLocal = (): boolean => {
  return ollamaManager.isLocal();
};
