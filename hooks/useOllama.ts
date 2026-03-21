import { useState, useEffect, useCallback } from 'react';

export const useOllama = (setProgress: (msg: string) => void) => {
  const [ollamaActive, setOllamaActive] = useState(false);
  const [isTogglingOllama, setIsTogglingOllama] = useState(false);

  const refreshOllamaStatus = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3001/ollama/status');
      const data = await res.json();
      setOllamaActive(Boolean(data.status));
      return Boolean(data.status);
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    refreshOllamaStatus().catch(() => undefined);
  }, [refreshOllamaStatus]);

  const toggleOllama = async () => {
    try {
      setIsTogglingOllama(true);
      const action = ollamaActive ? 'stop' : 'start';
      setProgress(`${action === 'start' ? 'Spouštím' : 'Zastavuji'} server Ollama...`);
      
      // Check backend before toggle
      try {
        const statusRes = await fetch('http://localhost:3001/ollama/status', { signal: AbortSignal.timeout(5000) });
        if (!statusRes.ok) {
          throw new Error('Backend server neběží');
        }
      } catch (e) {
        setProgress('❌ Backend server neběží. Spusťte příkaz: cd backend && npm start');
        return;
      }
      
      const res = await fetch('http://localhost:3001/ollama/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
        signal: AbortSignal.timeout(10000)
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Server vrátil chybu');
      }
      
      const data = await res.json();
      const verifiedStatus = await refreshOllamaStatus();
      setOllamaActive(verifiedStatus);
      setProgress(typeof data.message === 'string' ? data.message : verifiedStatus ? 'Ollama běží.' : 'Ollama je vypnutá.');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Neznámá chyba';
      setProgress('❌ ' + errorMsg);
    } finally {
      setIsTogglingOllama(false);
    }
  };

  return {
    ollamaActive,
    isTogglingOllama,
    refreshOllamaStatus,
    toggleOllama,
  };
};
