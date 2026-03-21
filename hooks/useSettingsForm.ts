import { useState, useEffect, useMemo, useCallback } from 'react';
import { Config } from '../types';

interface UseSettingsFormOptions {
  config: Config;
  onSave: (nextConfig: Config) => Promise<void>;
  onClearDatabase: () => Promise<void>;
}

export const useSettingsForm = ({ config, onSave, onClearDatabase }: UseSettingsFormOptions) => {
  const [draft, setDraft] = useState<Config>(config);
  const [signature, setSignature] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isClearingDb, setIsClearingDb] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // DB/Proxy states (these are often environment variables, so we store locally for UI)
  const [usePostgres, setUsePostgres] = useState(false);
  const [postgresUrl, setPostgresUrl] = useState('postgresql://postgres:heslo@localhost:5432/inzerty');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [useProxy, setUseProxy] = useState(false);
  const [proxyPool, setProxyPool] = useState('http://user:pass@proxy1:8080,http://proxy2:8080');

  useEffect(() => {
    setDraft(config);
    const savedSignature = localStorage.getItem('inzerty_signature_v1');
    if (savedSignature) setSignature(savedSignature);
  }, [config]);

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      await onSave(draft);
      localStorage.setItem('inzerty_signature_v1', signature);
      setStatusMessage('🎯 Nastavení bylo úspěšně uloženo.');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (error) {
      setStatusMessage(`❌ Uložení selhalo: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearDb = async () => {
    const confirmed = window.confirm('Opravdu chcete vymazat databázi? Tato akce je nevratná.');
    if (!confirmed) return;

    setIsClearingDb(true);
    setStatusMessage('');
    try {
      await onClearDatabase();
      setStatusMessage('🗑️ Databáze byla vymazána.');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (error) {
      setStatusMessage(`❌ Mazání selhalo: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    } finally {
      setIsClearingDb(false);
    }
  };

  const envSnippet = useMemo(() => {
    const lines = [
      `OLLAMA_URL=${ollamaUrl}`,
      `OLLAMA_MODEL=${draft.ollamaModel || 'all-minilm:22m'}`,
      usePostgres ? 'DB_CLIENT=postgres' : 'DB_CLIENT=sqlite',
      usePostgres ? `DATABASE_URL=${postgresUrl}` : '# DATABASE_URL není potřeba pro SQLite',
      useProxy ? `SCRAPER_PROXY_URLS=${proxyPool}` : '# SCRAPER_PROXY_URLS (volitelné)',
    ];
    return lines.join('\n');
  }, [draft.ollamaModel, usePostgres, useProxy, ollamaUrl, postgresUrl, proxyPool]);

  return {
    draft,
    setDraft,
    signature,
    setSignature,
    isSaving,
    isClearingDb,
    statusMessage,
    usePostgres,
    setUsePostgres,
    postgresUrl,
    setPostgresUrl,
    ollamaUrl,
    setOllamaUrl,
    useProxy,
    setUseProxy,
    proxyPool,
    setProxyPool,
    envSnippet,
    handleSave,
    handleClearDb,
  };
};
