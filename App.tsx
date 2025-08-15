
import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import WorkflowSidebar from './components/WorkflowSidebar';
import ConfigurationPanel from './components/ConfigurationPanel';
import ResultsDisplay from './components/ResultsDisplay';
import LogPanel from './components/LogPanel';
import MonitoringDashboard from './components/MonitoringDashboard';
import { AdType, WorkflowStepValue } from './types';
import { generateMockAds } from './services/geminiService';
import { BRANDS, AD_TYPE_OPTIONS, ITEM_COUNT_OPTIONS, INITIAL_LOG_MESSAGE } from './constants.tsx'; // Updated extension

const App = () => {
  const [config, setConfig] = useState({
    brand: BRANDS[0],
    adType: AD_TYPE_OPTIONS[0].value,
    itemCount: ITEM_COUNT_OPTIONS[0],
  });
  const [ads, setAds] = useState([]);
  const [isScraping, setIsScraping] = useState(false);
  const [currentWorkflowStep, setCurrentWorkflowStep] = useState(WorkflowStepValue.IDLE);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [logs, setLogs] = useState([{ 
    id: crypto.randomUUID(), 
    timestamp: new Date().toLocaleTimeString('cs-CZ'), 
    message: INITIAL_LOG_MESSAGE,
    type: 'system'
  }]);
  const [lastScrapeDuration, setLastScrapeDuration] = useState(null);
  const [apiKeyAvailable, setApiKeyAvailable] = useState(true); // Assume available initially


  const addLog = useCallback((message, type = 'info') => {
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

  useEffect(() => {
    let keyAvailable = false;
    try {
      if (typeof process !== 'undefined' && process.env && typeof process.env.API_KEY === 'string' && process.env.API_KEY.length > 0) {
        keyAvailable = true;
      }
    } catch (e) {
      console.warn("Chyba při přístupu k process.env.API_KEY v App.tsx:", e);
    }

    if (!keyAvailable) {
        setApiKeyAvailable(false);
        addLog("API klíč pro Gemini (process.env.API_KEY) není dostupný nebo je neplatný. Generování dat nebude fungovat. Zajistěte, aby byl klíč správně nastaven v prostředí, kde aplikace běží.", 'error');
    } else {
        setApiKeyAvailable(true);
        addLog("API klíč pro Gemini je dostupný.", 'success');
    }
    setCurrentWorkflowStep(WorkflowStepValue.CONFIG);
  }, [addLog]); 
  
  const advanceWorkflow = useCallback(async (step, delay = 500, logMessage, logType) => {
    // If moving to ERROR step, ensure it's logged distinctly
    if (step === WorkflowStepValue.ERROR && logMessage) {
        addLog(logMessage, logType || 'error');
    } else if (logMessage) {
        addLog(logMessage, logType || 'info');
    }

    setCurrentWorkflowStep(step);
    setCompletedSteps(prev => new Set(prev).add(step));
    
    // The actual delay using await for a promise
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }, [addLog]);


  const handleStartScraping = useCallback(async () => {
    if (!apiKeyAvailable) {
      addLog("Nelze spustit scrapování: API klíč pro Gemini není dostupný.", "error");
      await advanceWorkflow(WorkflowStepValue.ERROR, 0, "Chyba konfigurace: API klíč chybí.", 'error');
      return;
    }

    setIsScraping(true);
    setAds([]); 
    setLastScrapeDuration(null);
    const startTime = performance.now();
    
    setCompletedSteps(new Set()); 

    addLog(`Spouštění scrapování pro ${config.brand} (${config.adType}), ${config.itemCount} položek.`, 'system');
    
    await advanceWorkflow(WorkflowStepValue.CONFIG, 0, "Konfigurace přijata.", 'success');
    await advanceWorkflow(WorkflowStepValue.INIT_ANTI_DETECTION, 700, "Simulace inicializace anti-detection mechanismů (proxy, User-Agent)...", 'info');
    await advanceWorkflow(WorkflowStepValue.SCRAPING, 1000, `Zahájeno stahování dat pro ${config.brand} z fiktivního serveru...`, 'info');

    try {
      const mockAds = await generateMockAds(config.brand, config.adType, config.itemCount);
      setAds(mockAds);
      await advanceWorkflow(WorkflowStepValue.PARSING, 800, `Parsování ${mockAds.length} inzerátů dokončeno.`, 'success');
      await advanceWorkflow(WorkflowStepValue.SAVING, 600, `Data uložena (simulováno).`, 'success');
      await advanceWorkflow(WorkflowStepValue.DISPLAYING_RESULTS, 0, "Výsledky jsou zobrazeny.", 'info');
      addLog(`Scrapování úspěšně dokončeno. Načteno ${mockAds.length} inzerátů.`, 'success');
    } catch (error) {
      console.error("Chyba při scrapování:", error);
      // advanceWorkflow will log the message if provided
      await advanceWorkflow(WorkflowStepValue.ERROR, 0, `Chyba během scrapování: ${error.message}`, 'error');
    } finally {
      setIsScraping(false);
      const endTime = performance.now();
      setLastScrapeDuration((endTime - startTime) / 1000);
      
      // Only transition to MONITORING if not in ERROR state
      // Check currentWorkflowStep directly instead of relying on completedSteps for this logic path to avoid stale closures issues
      setCurrentWorkflowStep(prevStep => {
          if (prevStep !== WorkflowStepValue.ERROR && completedSteps.has(WorkflowStepValue.DISPLAYING_RESULTS)) {
            advanceWorkflow(WorkflowStepValue.MONITORING, 500, "Aktualizace monitoringu.", 'info').then(() => {
                setCurrentWorkflowStep(WorkflowStepValue.DISPLAYING_RESULTS);
                 setCompletedSteps(prev => new Set(prev).add(WorkflowStepValue.MONITORING).add(WorkflowStepValue.DISPLAYING_RESULTS));
            });
            return WorkflowStepValue.MONITORING; // Tentative step
          } else if (prevStep === WorkflowStepValue.ERROR) {
            setCompletedSteps(prev => new Set(prev).add(WorkflowStepValue.ERROR));
            return WorkflowStepValue.ERROR;
          }
          return prevStep; // No change if conditions not met (e.g. error occurred earlier)
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, apiKeyAvailable, addLog, advanceWorkflow, completedSteps]); // Added completedSteps due to its usage in finally block's dependency logic path


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
            apiKeyAvailable={apiKeyAvailable}
          />
          {/* Show results display unless it's an error state from the beginning or no ads AND not scraping */}
          {(ads.length > 0 || (currentWorkflowStep !== WorkflowStepValue.SCRAPING && currentWorkflowStep !== WorkflowStepValue.ERROR)) && 
            <ResultsDisplay 
              ads={ads} 
              isLoading={isScraping && (currentWorkflowStep === WorkflowStepValue.SCRAPING || currentWorkflowStep === WorkflowStepValue.PARSING)} 
            />
          }
          <MonitoringDashboard ads={ads} isScraping={isScraping} lastScrapeDuration={lastScrapeDuration} />
          <LogPanel logs={logs} />
          
          <footer className="mt-12 text-center text-sm text-slate-500 py-6 border-t border-slate-700">
            Vytvořeno s využitím React, Tailwind CSS a Gemini API. &copy; {new Date().getFullYear()}
            <p className="mt-1">Tato aplikace je určena pro demonstrační a vzdělávací účely.</p>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default App;