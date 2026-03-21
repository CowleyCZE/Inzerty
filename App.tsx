import React, { useState, useCallback } from 'react';

// Components
import Header from './components/Header';
import MonitoringDashboard from './components/MonitoringDashboard';
import FollowUpCalendar from './components/FollowUpCalendar';
import ConversationDashboard from './components/ConversationDashboard';
import AutomationControls from './components/AutomationControls';
import SettingsPage from './components/SettingsPage';
import { DashboardView } from './components/views/DashboardView';

// Hooks
import { useConfig } from './hooks/useConfig';
import { useOllama } from './hooks/useOllama';
import { useLogs } from './hooks/useLogs';
import { useScraping } from './hooks/useScraping';

type AppView = 'dashboard' | 'calendar' | 'settings' | 'conversations' | 'automation';

const App = () => {
  const [view, setView] = useState<AppView>('dashboard');

  // 1. Config & Alerts
  const { 
    config, setConfig, 
    alertsConfig,
    progress, setProgress, 
    handleSaveSettings, handleClearDatabase 
  } = useConfig();

  // 2. Ollama state
  const { ollamaActive, isTogglingOllama, toggleOllama } = useOllama(setProgress);

  // 3. Runtime Logs
  const { runtimeLogs } = useLogs();

  // 4. Scraping & Comparison Logic
  const { 
    ads, setAds,
    matchedAds, setMatchedAds,
    isScraping, isComparing, 
    scrapeSummary, setScrapeSummary,
    appState, setAppState,
    lastScrapeDuration, 
    handleStartScraping, handleStartComparison, handleCompareStoredAds 
  } = useScraping({ config, setProgress });

  const onClearDatabase = async () => {
    const success = await handleClearDatabase();
    if (success) {
      setAds([]);
      setMatchedAds([]);
      setScrapeSummary(null);
      setAppState('idle');
    }
  };

  const handleExportMatches = async () => {
    try {
      const response = await fetch('http://localhost:3001/matches/export');
      if (!response.ok) throw new Error('Export failed');
      
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
      alert(`❌ Chyba při exportu: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100 font-sans selection:bg-sky-500/30">
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

      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap sticky top-0 z-10 bg-slate-900/80 backdrop-blur-md py-2 border-b border-slate-800">
          <button onClick={() => setView('dashboard')} className={`px-4 py-2 rounded-lg transition-all ${view === 'dashboard' ? 'bg-sky-600 text-white shadow-lg' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>
            Hlavní stránka
          </button>
          <button onClick={() => setView('automation')} className={`px-4 py-2 rounded-lg transition-all ${view === 'automation' ? 'bg-red-600 text-white shadow-lg' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>
            🤖 Automation
          </button>
          <button onClick={() => setView('conversations')} className={`px-4 py-2 rounded-lg transition-all ${view === 'conversations' ? 'bg-purple-600 text-white shadow-lg' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>
            💬 Konverzace
          </button>
          <button onClick={() => setView('calendar')} className={`px-4 py-2 rounded-lg transition-all ${view === 'calendar' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>
            ⏰ Kalendář
          </button>
          <button onClick={() => setView('settings')} className={`px-4 py-2 rounded-lg transition-all ${view === 'settings' ? 'bg-slate-600 text-white shadow-lg' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>
            Nastavení
          </button>
        </div>

        {/* View Content */}
        {view === 'dashboard' ? (
          <DashboardView 
            runtimeLogs={runtimeLogs}
            progress={progress}
            appState={appState}
            isComparing={isComparing}
            scrapeSummary={scrapeSummary}
            matchedAds={matchedAds}
            ads={ads}
            isScraping={isScraping}
            lastScrapeDuration={lastScrapeDuration}
            handleCompareStoredAds={handleCompareStoredAds}
            handleExportMatches={handleExportMatches}
          />
        ) : view === 'automation' ? (
          <AutomationControls />
        ) : view === 'conversations' ? (
          <ConversationDashboard />
        ) : view === 'calendar' ? (
          <FollowUpCalendar alertsConfig={alertsConfig} />
        ) : (
          <SettingsPage 
            config={config} 
            onSave={handleSaveSettings} 
            onClearDatabase={onClearDatabase} 
          />
        )}

        <footer className="mt-12 text-center text-sm text-slate-500 py-6 border-t border-slate-800">
          Vytvořeno s využitím React, Node.js a Cheerio. &copy; {new Date().getFullYear()}
          <p className="mt-1 text-slate-600 text-xs italic">Tato aplikace je určena pro demonstrační a vzdělávací účely.</p>
        </footer>
      </main>
    </div>
  );
};

export default App;
