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

const App = () => {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [ads, setAds] = useState<Ad[]>([]);
  const [matchedAds, setMatchedAds] = useState<{ offer: Ad, demand: Ad }[]>([]);
  const [isScraping, setIsScraping] = useState(false);
  const [currentWorkflowStep, setCurrentWorkflowStep] = useState<WorkflowStepValue>(WorkflowStepValue.IDLE);
  const [completedSteps, setCompletedSteps] = useState(new Set<WorkflowStepValue>());
  const [logs, setLogs] = useState([{
    id: crypto.randomUUID(),
    timestamp: new Date().toLocaleTimeString('cs-CZ'),
    message: INITIAL_LOG_MESSAGE,
    type: 'system'
  }]);
  const [lastScrapeDuration, setLastScrapeDuration] = useState<number | null>(null);
  const [apiKeyAvailable, setApiKeyAvailable] = useState(true); // Placeholder, will be replaced by backend check

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<{ offer: Ad, demand: Ad } | null>(null);

  const addLog = useCallback((message: string, type = 'info') => {
    setLogs(prevLogs => [
      ...prevLogs,
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        message,
        type
      }
    ]);
  }, []);

  const handleMatchClick = useCallback((offer: Ad, demand: Ad) => {
    setSelectedMatch({ offer, demand });
    setShowDetailModal(true);
  }, []);

  useEffect(() => {
    // This can be used for a future check to see if the backend is available
    addLog("Frontend inicializován. Připraven ke komunikaci s backendem.", 'system');
    setCurrentWorkflowStep(WorkflowStepValue.CONFIG);
  }, [addLog]);

  const advanceWorkflow = useCallback(async (step: WorkflowStepValue, delay = 100, logMessage?: string, logType?: string) => {
    if (logMessage) {
      addLog(logMessage, logType || 'info');
    }
    setCurrentWorkflowStep(step);
    setCompletedSteps(prev => new Set(prev).add(step));
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }, [addLog]);

  const handleStartScraping = useCallback(async () => {
    setIsScraping(true);
    setAds([]);
    setMatchedAds([]); // Clear previous matches
    setLastScrapeDuration(null);
    setCompletedSteps(new Set());
    const startTime = performance.now();

    const scrapedDataByBrand: Map<string, { nabidka: Ad[], poptavka: Ad[] }> = new Map();

    addLog(`Spouštím scrapování pro všechny značky a typy inzerátů...`, 'system');
    await advanceWorkflow(WorkflowStepValue.SCRAPING, 0, "Odesílám požadavky na server...", 'info');

    for (const brand of BRANDS) { // Iterate over all brands
      // Initialize for each brand
      scrapedDataByBrand.set(brand, { nabidka: [], poptavka: [] });

      let brandUrlSegment = brand.toLowerCase().replace(/ /g, '-');
      if (brand === 'Sony') {
        brandUrlSegment = 'ericsson';
      } else if (brand === 'Ostatní') {
        brandUrlSegment = 'mobily';
      }

      for (const adTypeOption of AD_TYPE_OPTIONS) { // Iterate over ad types
        const adType = adTypeOption.value;

        const primaryScrapeUrl = `https://mobil.bazos.cz/${brandUrlSegment}/`;
        const genericScrapeUrl = `https://mobil.bazos.cz/mobily/`; // Fallback URL

        const urlsToTry = [primaryScrapeUrl];
        if (brand !== 'Sony' && brand !== 'Ostatní' && primaryScrapeUrl !== genericScrapeUrl) {
            // Only add generic fallback if it's not Sony or Ostatní, and not already the generic URL
            urlsToTry.push(genericScrapeUrl);
        }

        let scrapedSuccessfully = false;
        for (const urlToUse of urlsToTry) {
            const configToSend = { ...config, brand: brand, adType: adType, url: urlToUse };

            addLog(`Scrapuji pro značku: ${brand}, typ: ${adType} (${urlToUse})`, 'system');

            try {
                const response = await fetch('http://localhost:3001/scrape', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(configToSend),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || `Server odpověděl chybou ${response.status}`);
                }

                const result = await response.json();
                if (result.data.length > 0) { // Only consider it successful if data is found
                    addLog(`Úspěšně scrapováno ${result.data.length} inzerátů pro ${brand} (${adType}) z ${urlToUse}.`, 'success');
                    const currentBrandData = scrapedDataByBrand.get(brand);
                    if (currentBrandData) {
                        if (adType === AdType.NABIDKA) {
                            currentBrandData.nabidka.push(...result.data);
                        } else {
                            currentBrandData.poptavka.push(...result.data);
                        }
                    }
                    scrapedSuccessfully = true;
                    break; // Break from urlsToTry loop if successful
                } else {
                    addLog(`Nenalezeny žádné inzeráty pro ${brand} (${adType}) z ${urlToUse}.`, 'info');
                }

            } catch (error) {
                console.error(`Chyba při komunikaci s backendem pro značku ${brand}, typ ${adType} z ${urlToUse}:`, error);
                addLog(`Chyba při scrapování pro značku ${brand}, typ ${adType} z ${urlToUse}: ${error.message}`, 'error');
            }
        }

        if (!scrapedSuccessfully) {
            addLog(`Nepodařilo se scrapovat pro značku ${brand}, typ ${adType} z žádné URL.`, 'error');
        }
      }
    }

    // Now, perform the comparison
    const foundMatches: { offer: Ad, demand: Ad }[] = [];

    scrapedDataByBrand.forEach((data, brandName) => {
      data.poptavka.forEach(demandAd => {
        const demandPrice = parsePrice(demandAd.price);
        if (demandPrice === null) return; // Skip if demand price cannot be parsed

        data.nabidka.forEach(offerAd => {
          const offerPrice = parsePrice(offerAd.price);
          if (offerPrice === null) return; // Skip if offer price cannot be parsed

          if (demandPrice > offerPrice) {
            foundMatches.push({ offer: offerAd, demand: demandAd });
          }
        });
      });
    });

    setMatchedAds(foundMatches); // Update the new state variable
    await advanceWorkflow(WorkflowStepValue.DISPLAYING_RESULTS, 0, `Scrapování a porovnání dokončeno. Nalezeno ${foundMatches.length} shod.`, 'success');

    setIsScraping(false);
    const endTime = performance.now();
    setLastScrapeDuration((endTime - startTime) / 1000);
  }, [config, addLog, advanceWorkflow]); // Odebrání parsePrice, protože je definováno mimo komponentu

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <WorkflowSidebar currentStep={currentWorkflowStep} completedSteps={completedSteps} />
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <ConfigurationPanel
            config={config}
            setConfig={setConfig}
            onStartScraping={handleStartScraping}
            isScraping={isScraping}
            apiKeyAvailable={true} // Assuming backend handles this, simplifying for now
          />
          {matchedAds.length > 0 &&
            <ResultsDisplay
              matchedAds={matchedAds}
              isLoading={isScraping}
              onMatchClick={handleMatchClick}
            />
          }
          <MonitoringDashboard ads={ads} isScraping={isScraping} lastScrapeDuration={lastScrapeDuration} />
          <LogPanel logs={logs} />

          <footer className="mt-12 text-center text-sm text-slate-500 py-6 border-t border-slate-700">
            Vytvořeno s využitím React, Node.js, a Cheerio. &copy; {new Date().getFullYear()}
            <p className="mt-1">Tato aplikace je určena pro demonstrační a vzdělávací účely.</p>
          </footer>
        </main>
      </div>
      <DetailModal show={showDetailModal} onClose={() => setShowDetailModal(false)} match={selectedMatch} />
    </div>
  );
};

const DetailModal: React.FC<{
  show: boolean;
  onClose: () => void;
  match: { offer: Ad, demand: Ad } | null;
}> = ({ show, onClose, match }) => {
  if (!show || !match) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-slate-800 p-8 rounded-lg shadow-lg max-w-2xl w-full relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 text-2xl">&times;</button>
        <h2 className="text-2xl font-bold text-sky-400 mb-4">Detail Shody</h2>

        <div className="mb-6">
          <h3 className="text-xl font-semibold text-amber-400 mb-2">Nabídka</h3>
          <p className="text-slate-300"><strong>Značka:</strong> {match.offer.brand}</p>
          <p className="text-slate-300"><strong>Název:</strong> {match.offer.title}</p>
          <p className="text-slate-300"><strong>Cena:</strong> {match.offer.price}</p>
          <p className="text-slate-300"><strong>Popis:</strong> {match.offer.description}</p>
          <p className="text-slate-300"><strong>Datum:</strong> {match.offer.date_posted}</p>
          <p className="text-slate-300"><strong>Lokalita:</strong> {match.offer.location}</p>
          <a href={match.offer.link} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">Zobrazit inzerát</a>
        </div>

        <div>
          <h3 className="text-xl font-semibold text-amber-400 mb-2">Poptávka</h3>
          <p className="text-slate-300"><strong>Značka:</strong> {match.demand.brand}</p>
          <p className="text-slate-300"><strong>Název:</strong> {match.demand.title}</p>
          <p className="text-slate-300"><strong>Cena:</strong> {match.demand.price}</p>
          <p className="text-slate-300"><strong>Popis:</strong> {match.demand.description}</p>
          <p className="text-slate-300"><strong>Datum:</strong> {match.demand.date_posted}</p>
          <p className="text-slate-300"><strong>Lokalita:</strong> {match.demand.location}</p>
          <a href={match.demand.link} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">Zobrazit inzerát</a>
        </div>
      </div>
    </div>
  );
};

export default App;
