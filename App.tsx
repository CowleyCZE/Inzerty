import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import ResultsDisplay from './components/ResultsDisplay';
import MonitoringDashboard from './components/MonitoringDashboard';
import { Ad, Config, MatchItem, ScrapeSummaryData } from './types';
import { DEFAULT_CONFIG } from './constants.tsx';
import ProgressDisplay from './components/ProgressDisplay';
import ScrapeSummary from './components/ScrapeSummary';
import LogPanel from './components/LogPanel';
import SettingsPage from './components/SettingsPage';

type AppView = 'dashboard' | 'settings';

const App = () => {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG as Config);
  const [ads, setAds] = useState<Ad[]>([]);
  const [matchedAds, setMatchedAds] = useState<MatchItem[]>([]);
  const [isScraping, setIsScraping] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [scrapeSummary, setScrapeSummary] = useState<ScrapeSummaryData | null>(null);
  const [progress, setProgress] = useState('Připraveno ke spuštění.');
  const [appState, setAppState] = useState('idle');
  const [ollamaActive, setOllamaActive] = useState(false);
  const [view, setView] = useState<AppView>('dashboard');
  const [lastScrapeDuration, setLastScrapeDuration] = useState<number | null>(null);
  const [runtimeLogs, setRuntimeLogs] = useState<Array<{ id: string; timestamp: string; message: string; type: 'info' | 'success' | 'error' | 'system' }>>([]);

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
    const checkOllama = async () => {
      try {
        const res = await fetch('http://localhost:3001/ollama/status');
        const data = await res.json();
        setOllamaActive(data.status);
      } catch {
        console.error('Nepodařilo se ověřit stav Ollama serveru');
      }
    };
    checkOllama();
  }, []);

  const toggleOllama = async () => {
    try {
      const action = ollamaActive ? 'stop' : 'start';
      setProgress(`${action === 'start' ? 'Spouštím' : 'Zastavuji'} server Ollama...`);
      const res = await fetch('http://localhost:3001/ollama/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      setOllamaActive(data.status);
      setProgress(data.message);
    } catch {
      setProgress('Nepodařilo se změnit stav Ollama serveru.');
    }
  };

  const handleStartScraping = useCallback(async () => {
    setIsScraping(true);
    setAppState('scraping');
    setAds([]);
    setMatchedAds([]);
    setLastScrapeDuration(null);
    const startTime = performance.now();
    setProgress('Spouštím proces scrapování...');

    try {
      const response = await fetch('http://localhost:3001/scrape-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectors: config.selectors, scrapingOptions: config.scrapingOptions || { stopOnKnownAd: true, maxAdsPerTypePerBrand: 50 } }),
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
      setProgress(`Scrapování selhalo: ${message}`);
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
      />

      <div className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="flex gap-2 mb-4">
          <button onClick={() => setView('dashboard')} className={`px-4 py-2 rounded-lg ${view === 'dashboard' ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300'}`}>Hlavní stránka</button>
          <button onClick={() => setView('settings')} className={`px-4 py-2 rounded-lg ${view === 'settings' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}>Nastavení</button>
        </div>

        {view === 'dashboard' ? (
          <>
            <LogPanel logs={runtimeLogs} />
            <ProgressDisplay progress={progress} />
            {appState === 'scraping-done' && scrapeSummary && <ScrapeSummary summary={scrapeSummary} />}
            {matchedAds.length > 0 && <ResultsDisplay matchedAds={matchedAds} isLoading={isComparing} />}
            <MonitoringDashboard ads={ads} isScraping={isScraping || isComparing} lastScrapeDuration={lastScrapeDuration} />
          </>
        ) : (
          <SettingsPage config={config} setConfig={setConfig} />
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
