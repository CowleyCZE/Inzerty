import React from 'react';
import LogPanel from '../LogPanel';
import ProgressDisplay from '../ProgressDisplay';
import ScrapeSummary from '../ScrapeSummary';
import ResultsDisplay from '../ResultsDisplay';
import MonitoringDashboard from '../MonitoringDashboard';
import { Ad, MatchItem, ScrapeSummaryData, LogEntry } from '../../types';

interface DashboardViewProps {
  runtimeLogs: LogEntry[];
  progress: string;
  appState: string;
  isComparing: boolean;
  scrapeSummary: ScrapeSummaryData | null;
  matchedAds: MatchItem[];
  ads: Ad[];
  isScraping: boolean;
  lastScrapeDuration: number | null;
  handleCompareStoredAds: () => void;
  handleExportMatches: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  runtimeLogs,
  progress,
  appState,
  isComparing,
  scrapeSummary,
  matchedAds,
  ads,
  isScraping,
  lastScrapeDuration,
  handleCompareStoredAds,
  handleExportMatches,
}) => {
  return (
    <>
      <LogPanel logs={runtimeLogs as any} />
      <ProgressDisplay progress={progress} />
      
      {appState === 'idle' && (
        <div className="bg-slate-800 p-6 rounded-xl mb-6 shadow-lg border border-slate-700">
          <h3 className="text-lg font-semibold text-sky-400 mb-3">Rychlé akce</h3>
          <button
            onClick={handleCompareStoredAds}
            disabled={isComparing}
            className="flex items-center px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white rounded-lg font-medium transition-all transform hover:scale-[1.02] active:scale-[0.98]"
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
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-end mb-4">
            <button
              onClick={handleExportMatches}
              className="flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors shadow-md"
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
  );
};
