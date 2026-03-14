import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import ResultsDisplay from './components/ResultsDisplay';
import MonitoringDashboard from './components/MonitoringDashboard';
import FollowUpCalendar from './components/FollowUpCalendar';
import ConversationDashboard from './components/ConversationDashboard';
import AutomationControls from './components/AutomationControls';
import { Ad, Config, MatchItem, ScrapeSummaryData } from './types';
import { DEFAULT_CONFIG } from './constants.tsx';
import ProgressDisplay from './components/ProgressDisplay';
import ScrapeSummary from './components/ScrapeSummary';
import LogPanel from './components/LogPanel';
import SettingsPage from './components/SettingsPage';

type AppView = 'dashboard' | 'calendar' | 'settings' | 'conversations' | 'automation';
const SETTINGS_STORAGE_KEY = 'inzerty_settings_v1';

const App = () => {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG as Config);
  const [ads, setAds] = useState<Ad[]>([]);
  const [matchedAds, setMatchedAds] = useState<MatchItem[]>([]);
  const [isScraping, setIsScraping] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [isTogglingOllama, setIsTogglingOllama] = useState(false);
  const [scrapeSummary, setScrapeSummary] = useState<ScrapeSummaryData | null>(null);
  const [progress, setProgress] = useState('Připraveno ke spuštění.');
  const [appState, setAppState] = useState('idle');
  const [ollamaActive, setOllamaActive] = useState(false);
  const [view, setView] = useState<AppView>('dashboard');
  const [lastScrapeDuration, setLastScrapeDuration] = useState<number | null>(null);
  const [runtimeLogs, setRuntimeLogs] = useState<Array<{ id: string; timestamp: string; message: string; type: 'info' | 'success' | 'error' | 'system' }>>([]);
  const [alertsConfig, setAlertsConfig] = useState({
    telegramBotToken: '',
    telegramChatId: '',
    emailWebhookUrl: '',
  });

  useEffect(() => {
    // Load alerts config from localStorage
    const raw = localStorage.getItem('inzerty_alerts_config_v1');
    if (raw) {
      try {
        setAlertsConfig(JSON.parse(raw));
      } catch {
        // ignore
      }
    }
  }, []);

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
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setConfig((prev) => ({ ...prev, ...parsed }));
    } catch {
      // ignore invalid local settings
    }
  }, []);

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

  useEffect(() => {
    let mounted = true;
    const fetchLogs = async () => {
      try {
        const res = await fetch('http://localhost:3001/logs');
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setRuntimeLogs(Array.isArray(data.logs) ? data.logs : []);
      } catch {
        // ignore log polling errors
      }
    };

    fetchLogs();
    const timer = setInterval(fetchLogs, 1500);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    refreshOllamaStatus().catch(() => undefined);
  }, [refreshOllamaStatus]);

  const toggleOllama = async () => {
    try {
      setIsTogglingOllama(true);
      const action = ollamaActive ? 'stop' : 'start';
      setProgress(`${action === 'start' ? 'Spouštím' : 'Zastavuji'} server Ollama...`);
      
      // Nejdřív zkontrolujeme zda backend běží
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
    const response = await fetch('http://localhost:3001/database/clear', { method: 'POST' });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message || 'Mazání databáze selhalo.');
    }

    setAds([]);
    setMatchedAds([]);
    setScrapeSummary(null);
    setProgress(payload.message || 'Databáze byla vymazána.');
  }, []);

  const handleStartScraping = useCallback(async () => {
    setIsScraping(true);
    setAppState('scraping');
    setAds([]);
    setMatchedAds([]);
    setLastScrapeDuration(null);
    const startTime = performance.now();
    setProgress('Spouštím proces scrapování...');

    try {
      // Nejdřív zkontrolujeme zda backend běží
      try {
        const statusRes = await fetch('http://localhost:3001/ollama/status', { signal: AbortSignal.timeout(5000) });
        if (!statusRes.ok) {
          throw new Error('Backend server neběží');
        }
      } catch (e) {
        setProgress('❌ Backend server neběží. Spusťte: cd backend && npm start');
        setIsScraping(false);
        setAppState('idle');
        return;
      }

      const response = await fetch('http://localhost:3001/scrape-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectors: config.selectors, scrapingOptions: config.scrapingOptions || { stopOnKnownAd: true, maxAdsPerTypePerBrand: 50 } }),
        signal: AbortSignal.timeout(120000) // 2 minuty timeout
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Server vrátil chybu ${response.status}`);
      }

      const result = await response.json();
      setAds(result.data.ads || []);
      setScrapeSummary({
        nabidka: result.data.nabidkaCount,
        poptavka: result.data.poptavkaCount,
        savedNabidka: result.data.savedNabidkaCount,
        savedPoptavka: result.data.savedPoptavkaCount,
        healthWarning: result.data.healthWarning || '',
      });
      setAppState('scraping-done');
      setProgress('Scrapování dokončeno. Připraveno k porovnání.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Neznámá chyba';
      if (message.includes('timeout')) {
        setProgress('⏱️ Scrapování trvalo příliš dlouho. Zkuste to znovu.');
      } else if (message.includes('NetworkError') || message.includes('Failed to fetch')) {
        setProgress('❌ Připojení k backendu selhalo. Ujistěte se že backend běží (cd backend && npm start)');
      } else {
        setProgress(`❌ Scrapování selhalo: ${message}`);
      }
      setAppState('idle');
    }

    setIsScraping(false);
    setLastScrapeDuration((performance.now() - startTime) / 1000);
  }, [config]);

  const handleStartComparison = useCallback(async () => {
    setIsComparing(true);
    setAppState('comparing');
    setProgress('Spouštím porovnávání...');

    try {
      const response = await fetch('http://localhost:3001/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comparisonMethod: config.comparisonMethod || 'auto',
          filterRules: config.filterRules || {
            blacklistTerms: [],
            whitelistModels: [],
            minPrice: null,
            maxPrice: null,
            minStorageGb: null,
          },
          hideResolved: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Server vrátil chybu ${response.status}`);
      }

      const result = await response.json();
      setMatchedAds(result.data);
      setAppState('comparing-done');
      setProgress(`Porovnání dokončeno. Nalezeno ${result.data.length} shod.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Neznámá chyba';
      setProgress(`Porovnávání selhalo: ${message}`);
      setAppState('scraping-done');
    }

    setIsComparing(false);
  }, [config]);

  const handleCompareStoredAds = useCallback(async () => {
    // Porovnání již uložených inzerátů z databáze
    setIsComparing(true);
    setAppState('comparing');
    setProgress('Spouštím porovnání uložených inzerátů...');

    try {
      const response = await fetch('http://localhost:3001/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comparisonMethod: config.comparisonMethod || 'auto',
          filterRules: config.filterRules || {
            blacklistTerms: [],
            whitelistModels: [],
            minPrice: null,
            maxPrice: null,
            minStorageGb: null,
          },
          hideResolved: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Server vrátil chybu ${response.status}`);
      }

      const result = await response.json();
      setMatchedAds(result.data);
      setAppState('comparing-done');
      setProgress(`Porovnání uložených inzerátů dokončeno. Nalezeno ${result.data.length} shod.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Neznámá chyba';
      setProgress(`Porovnávání selhalo: ${message}`);
      setAppState('idle');
    }

    setIsComparing(false);
  }, [config]);

  const handleExportMatches = async () => {
    try {
      const response = await fetch('http://localhost:3001/matches/export');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Server vrátil chybu ${response.status}`);
      }
      
      // Stáhnout soubor
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `matches_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      alert('✅ Shody exportovány!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Neznámá chyba';
      alert(`❌ Chyba při exportu: ${message}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100">
      <Header
        onStartScraping={handleStartScraping}
        isScraping={isScraping}
        onStartComparison={handleStartComparison}
        isComparing={isComparing}
        appState={appState}
        ollamaActive={ollamaActive}
        onToggleOllama={toggleOllama}
        isTogglingOllama={isTogglingOllama}
      />

      <div className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="flex gap-2 mb-4 flex-wrap">
          <button onClick={() => setView('dashboard')} className={`px-4 py-2 rounded-lg ${view === 'dashboard' ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300'}`}>Hlavní stránka</button>
          <button onClick={() => setView('automation')} className={`px-4 py-2 rounded-lg ${view === 'automation' ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300'}`}>🤖 Automation</button>
          <button onClick={() => setView('conversations')} className={`px-4 py-2 rounded-lg ${view === 'conversations' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300'}`}>💬 Konverzace</button>
          <button onClick={() => setView('calendar')} className={`px-4 py-2 rounded-lg ${view === 'calendar' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}>⏰ Kalendář</button>
          <button onClick={() => setView('settings')} className={`px-4 py-2 rounded-lg ${view === 'settings' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}>Nastavení</button>
        </div>

        {view === 'dashboard' ? (
          <>
            <LogPanel logs={runtimeLogs} />
            <ProgressDisplay progress={progress} />
            
            {/* Tlačítko pro porovnání uložených inzerátů */}
            {appState === 'idle' && (
              <div className="bg-slate-800 p-6 rounded-xl mb-6">
                <h3 className="text-lg font-semibold text-sky-400 mb-3">Rychlé akce</h3>
                <button
                  onClick={handleCompareStoredAds}
                  disabled={isComparing}
                  className="flex items-center px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                  </svg>
                  Porovnat uložené inzeráty z databáze
                </button>
              </div>
            )}
            
            {appState === 'scraping-done' && scrapeSummary && <ScrapeSummary summary={scrapeSummary} />}
            {matchedAds.length > 0 && (
              <div>
                <div className="flex justify-end mb-4">
                  <button
                    onClick={handleExportMatches}
                    className="flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Exportovat shody (JSON)
                  </button>
                </div>
                <ResultsDisplay matchedAds={matchedAds} isLoading={isComparing} />
              </div>
            )}
            <MonitoringDashboard ads={ads} isScraping={isScraping || isComparing} lastScrapeDuration={lastScrapeDuration} />
          </>
        ) : view === 'automation' ? (
          <AutomationControls />
        ) : view === 'conversations' ? (
          <ConversationDashboard />
        ) : view === 'calendar' ? (
          <FollowUpCalendar alertsConfig={alertsConfig} />
        ) : (
          <SettingsPage config={config} onSave={handleSaveSettings} onClearDatabase={handleClearDatabase} />
        )}

        <footer className="mt-12 text-center text-sm text-slate-500 py-6 border-t border-slate-700">
          Vytvořeno s využitím React, Node.js, a Cheerio. &copy; {new Date().getFullYear()}
          <p className="mt-1">Tato aplikace je určena pro demonstrační a vzdělávací účely.</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
