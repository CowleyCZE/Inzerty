import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import WorkflowSidebar from './components/WorkflowSidebar';
import ConfigurationPanel from './components/ConfigurationPanel';
import ResultsDisplay from './components/ResultsDisplay';
import LogPanel from './components/LogPanel';
import MonitoringDashboard from './components/MonitoringDashboard';
import { Ad, Config, WorkflowStepValue, AdType } from './types';
import { DEFAULT_CONFIG, INITIAL_LOG_MESSAGE, BRANDS, AD_TYPE_OPTIONS } from './constants.tsx';

// Move parsePrice outside the App component
const parsePrice = (priceString: string): number | null => {
  if (!priceString) return null;
  const cleanedPrice = priceString.replace(/[^0-9,-]+/g, '').replace(',', '.');
  const price = parseFloat(cleanedPrice);
  return isNaN(price) ? null : price;
};

import ProgressDisplay from './components/ProgressDisplay';
import ScrapeSummary from './components/ScrapeSummary';

const App = () => {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [ads, setAds] = useState<Ad[]>([]);
  const [matchedAds, setMatchedAds] = useState<{ offer: Ad, demand: Ad }[]>([]);
  const [isScraping, setIsScraping] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [scrapedData, setScrapedData] = useState(null);
  const [scrapeSummary, setScrapeSummary] = useState(null);
  const [progress, setProgress] = useState('Ready to start.');
  const [appState, setAppState] = useState('idle');

  const [lastScrapeDuration, setLastScrapeDuration] = useState<number | null>(null);

  const handleStartScraping = useCallback(async () => {
    setIsScraping(true);
    setAppState('scraping');
    setAds([]);
    setMatchedAds([]);
    setLastScrapeDuration(null);
    const startTime = performance.now();

    setProgress('Starting scraping process...');

    try {
      const response = await fetch('http://localhost:3001/scrape-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ selectors: config.selectors }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Server responded with error ${response.status}`);
      }

      const result = await response.json();
      setScrapedData(result.data);
      setScrapeSummary({ 
        nabidka: result.data.nabidka.length,
        poptavka: result.data.poptavka.length
      });
      setAppState('scraping-done');
      setProgress('Scraping finished. Ready to compare.');

    } catch (error) {
      console.error('Error during scraping:', error);
      setProgress(`Scraping failed: ${error.message}`);
      setAppState('idle');
    }

    setIsScraping(false);
    const endTime = performance.now();
    setLastScrapeDuration((endTime - startTime) / 1000);
  }, [config]);

  const handleStartComparison = useCallback(async () => {
    if (!scrapedData) {
      setProgress('No scraped data to compare.');
      return;
    }

    setIsComparing(true);
    setAppState('comparing');
    setProgress('Starting comparison process...');

    try {
      const response = await fetch('http://localhost:3001/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scrapedData }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Server responded with error ${response.status}`);
      }

      const result = await response.json();
      setMatchedAds(result.data);
      setAppState('comparing-done');
      setProgress(`Comparison finished. Found ${result.data.length} matches.`);

    } catch (error) {
      console.error('Error during comparison:', error);
      setProgress(`Comparison failed: ${error.message}`);
      setAppState('scraping-done'); // Revert to previous state
    }

    setIsComparing(false);
  }, [scrapedData]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100">
      <Header onStartScraping={handleStartScraping} isScraping={isScraping} onStartComparison={handleStartComparison} isComparing={isComparing} appState={appState} />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <ProgressDisplay progress={progress} />
          {appState === 'scraping-done' && <ScrapeSummary summary={scrapeSummary} />}
          {matchedAds.length > 0 &&
            <ResultsDisplay
              matchedAds={matchedAds}
              isLoading={isComparing}
            />
          }
          <MonitoringDashboard ads={ads} isScraping={isScraping || isComparing} lastScrapeDuration={lastScrapeDuration} />
          <footer className="mt-12 text-center text-sm text-slate-500 py-6 border-t border-slate-700">
            Vytvořeno s využitím React, Node.js, a Cheerio. &copy; {new Date().getFullYear()}
            <p className="mt-1">Tato aplikace je určena pro demonstrační a vzdělávací účely.</p>
          </footer>
        </main>
      </div>
    </div>
  );
};


export default App;
