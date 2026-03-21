import { useState, useCallback } from 'react';
import { Ad, Config, MatchItem, ScrapeSummaryData } from '../types';

interface UseScrapingOptions {
  config: Config;
  setProgress: (msg: string) => void;
}

export const useScraping = ({ config, setProgress }: UseScrapingOptions) => {
  const [ads, setAds] = useState<Ad[]>([]);
  const [matchedAds, setMatchedAds] = useState<MatchItem[]>([]);
  const [isScraping, setIsScraping] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [scrapeSummary, setScrapeSummary] = useState<ScrapeSummaryData | null>(null);
  const [appState, setAppState] = useState('idle');
  const [lastScrapeDuration, setLastScrapeDuration] = useState<number | null>(null);

  const handleStartScraping = useCallback(async () => {
    setIsScraping(true);
    setAppState('scraping');
    setAds([]);
    setMatchedAds([]);
    setLastScrapeDuration(null);
    const startTime = performance.now();
    setProgress('Spouštím proces scrapování...');

    try {
      // Check backend
      try {
        const statusRes = await fetch('http://localhost:3001/ollama/status', { signal: AbortSignal.timeout(5000) });
        if (!statusRes.ok) throw new Error();
      } catch (e) {
        setProgress('❌ Backend server neběží. Spusťte: cd backend && npm start');
        setIsScraping(false);
        setAppState('idle');
        return;
      }

      const enabledPlatforms = config.enabledPlatforms || ['bazos_cz'];
      const useMultiPlatform = enabledPlatforms.length > 1 || enabledPlatforms[0] !== 'bazos_cz';
      const endpoint = useMultiPlatform ? '/scrape-all-multi' : '/scrape-all';
      
      const response = await fetch(`http://localhost:3001${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          selectors: config.selectors, 
          scrapingOptions: config.scrapingOptions || { stopOnKnownAd: true, maxAdsPerTypePerBrand: 50 },
          enabledPlatforms: useMultiPlatform ? enabledPlatforms : undefined,
        }),
        signal: AbortSignal.timeout(600000)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Server vrátil chybu ${response.status}`);
      }

      const result = await response.json();
      
      if (useMultiPlatform) {
        setScrapeSummary({
          nabidka: result.data.totalAds,
          poptavka: 0,
          savedNabidka: result.data.totalSaved,
          savedPoptavka: 0,
          healthWarning: '',
        });
        setProgress(`Multi-Platform scrapování dokončeno: ${result.data.totalAds} inzerátů`);
      } else {
        setAds(result.data.ads || []);
        setScrapeSummary({
          nabidka: result.data.nabidkaCount,
          poptavka: result.data.poptavkaCount,
          savedNabidka: result.data.savedNabidkaCount,
          savedPoptavka: result.data.savedPoptavkaCount,
          healthWarning: result.data.healthWarning || '',
        });
        setProgress('Scrapování dokončeno. Připraveno k porovnání.');
      }
      
      setAppState('scraping-done');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Neznámá chyba';
      setProgress(`❌ Scrapování selhalo: ${message}`);
      setAppState('idle');
    } finally {
      setIsScraping(false);
      setLastScrapeDuration((performance.now() - startTime) / 1000);
    }
  }, [config, setProgress]);

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

      if (!response.ok) throw new Error();
      const result = await response.json();
      setMatchedAds(result.data);
      setAppState('comparing-done');
      setProgress(`Porovnání dokončeno. Nalezeno ${result.data.length} shod.`);
    } catch (error) {
      setProgress('Porovnávání selhalo.');
      setAppState('scraping-done');
    } finally {
      setIsComparing(false);
    }
  }, [config, setProgress]);

  const handleCompareStoredAds = useCallback(async () => {
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

      if (!response.ok) throw new Error();
      const result = await response.json();
      setMatchedAds(result.data);
      setAppState('comparing-done');
      setProgress(`Porovnání uložených inzerátů dokončeno. Nalezeno ${result.data.length} shod.`);
    } catch (error) {
      setProgress('Porovnávání selhalo.');
      setAppState('idle');
    } finally {
      setIsComparing(false);
    }
  }, [config, setProgress]);

  return {
    ads,
    matchedAds,
    isScraping,
    isComparing,
    scrapeSummary,
    appState,
    lastScrapeDuration,
    handleStartScraping,
    handleStartComparison,
    handleCompareStoredAds,
    setAds,
    setMatchedAds,
    setScrapeSummary,
    setAppState,
  };
};
