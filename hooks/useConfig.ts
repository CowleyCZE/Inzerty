import { useState, useEffect, useCallback } from 'react';
import { Config } from '../types';
import { DEFAULT_CONFIG } from '../constants.tsx';

const SETTINGS_STORAGE_KEY = 'inzerty_settings_v1';

export const useConfig = () => {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG as Config);
  const [alertsConfig, setAlertsConfig] = useState({
    telegramBotToken: '',
    telegramChatId: '',
    emailWebhookUrl: '',
  });
  const [progress, setProgress] = useState('Připraveno ke spuštění.');

  // Load from localStorage on mount
  useEffect(() => {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setConfig((prev) => ({ ...prev, ...parsed }));
      } catch {}
    }

    const alertRaw = localStorage.getItem('inzerty_alerts_config_v1');
    if (alertRaw) {
      try {
        setAlertsConfig(JSON.parse(alertRaw));
      } catch {}
    }
  }, []);

  // Load from server on mount
  useEffect(() => {
    const loadServerSettings = async () => {
      try {
        const res = await fetch('http://localhost:3001/settings');
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data.ollamaModel === 'string' && data.ollamaModel.trim()) {
          setConfig((prev) => ({ ...prev, ollamaModel: data.ollamaModel.trim() }));
        }
      } catch {
        // settings endpoint may be unavailable
      }
    };
    loadServerSettings();
  }, []);

  const handleSaveSettings = useCallback(async (nextConfig: Config) => {
    setConfig(nextConfig);
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextConfig));

    try {
      const response = await fetch('http://localhost:3001/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ollamaModel: nextConfig.ollamaModel || 'all-minilm:22m' }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Uložení nastavení selhalo.');
      }

      setProgress(payload.message || 'Nastavení bylo uloženo.');
    } catch (error) {
      setProgress(`Nastavení lokálně uloženo, ale synchronizace se serverem selhala: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    }
  }, []);

  const handleClearDatabase = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3001/database/clear', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Mazání databáze selhalo.');
      }
      setProgress(payload.message || 'Databáze byla vymazána.');
      return true;
    } catch (e) {
      setProgress(`Chyba při mazání databáze: ${e instanceof Error ? e.message : 'Neznámá chyba'}`);
      return false;
    }
  }, []);

  return {
    config,
    setConfig,
    alertsConfig,
    setAlertsConfig,
    progress,
    setProgress,
    handleSaveSettings,
    handleClearDatabase,
  };
};
