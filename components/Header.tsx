import React from 'react';

interface HeaderProps {
  onStartScraping: () => void;
  isScraping: boolean;
  onStartComparison: () => void;
  isComparing: boolean;
  appState: string;
}

const Header: React.FC<HeaderProps> = ({ onStartScraping, isScraping, onStartComparison, isComparing, appState }) => {
  return (
    <header className="bg-slate-800 p-6 shadow-lg sticky top-0 z-50">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-sky-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 15.75-2.489-2.489m0 0a3.375 3.375 0 1 0-4.773-4.773 3.375 3.375 0 0 0 4.773 4.773ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <h1 className="text-3xl font-bold text-sky-500 tracking-tight">
            Český Inzertní Scraper <span className="text-slate-400 text-2xl font-normal">UI</span>
          </h1>
        </div>
        <div className="flex items-center space-x-4">
          {appState === 'idle' && (
            <button
              onClick={onStartScraping}
              disabled={isScraping}
              className="bg-sky-500 hover:bg-sky-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors duration-300"
            >
              {isScraping ? 'Scraping...' : 'Start Scraping'}
            </button>
          )}
          {appState === 'scraping-done' && (
            <button
              onClick={onStartComparison}
              disabled={isComparing}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors duration-300"
            >
              {isComparing ? 'Comparing...' : 'Start Comparison'}
            </button>
          )}
          <div className="text-sm text-slate-400">
            Simulace & Vizualizace
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
