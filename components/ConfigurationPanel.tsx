import React from 'react';
import { BRANDS, AD_TYPE_OPTIONS, ITEM_COUNT_OPTIONS } from '../constants.tsx'; // Updated extension
import { AdType } from '../types';

const ConfigurationPanel = ({ config, setConfig, onStartScraping, isScraping, apiKeyAvailable }) => {
  const handleBrandChange = (e) => {
    setConfig(prev => ({ ...prev, brand: e.target.value }));
  };

  const handleAdTypeChange = (e) => {
    setConfig(prev => ({ ...prev, adType: e.target.value }));
  };
  
  const handleItemCountChange = (e) => {
    setConfig(prev => ({ ...prev, itemCount: parseInt(e.target.value, 10) }));
  };

  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-2xl">
      <h2 className="text-2xl font-semibold text-sky-400 mb-6 border-b border-slate-700 pb-3 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="hero-icon w-6 h-6 mr-2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0 0 15 0m-15 0a7.5 7.5 0 1 1 15 0m-15 0H3m18 0h-1.5m-15.045-4.122L2.955 7.878m15.09 0l-1.045 1.045M7.878 2.955l1.045 1.045m7.122 0l1.045-1.045M12 21v-1.5m0-15V3" />
        </svg>
        Nastavení Scrapování
      </h2>
      
      {!apiKeyAvailable && (
        <div className="mb-4 p-4 bg-red-800 border border-red-700 text-red-200 rounded-md">
          <strong className="font-semibold">Chyba konfigurace:</strong> API klíč pro Gemini (<code>process.env.API_KEY</code>) není dostupný. Generování dat nebude fungovat. Zkontrolujte konzoli prohlížeče pro více detailů.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div>
          <label htmlFor="brand" className="block text-sm font-medium text-slate-300 mb-1">
            Značka Telefonu
          </label>
          <select
            id="brand"
            value={config.brand}
            onChange={handleBrandChange}
            disabled={isScraping}
            className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 p-3 text-sm"
          >
            {BRANDS.map(brand => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="adType" className="block text-sm font-medium text-slate-300 mb-1">
            Typ Inzerátu
          </label>
          <select
            id="adType"
            value={config.adType}
            onChange={handleAdTypeChange}
            disabled={isScraping}
            className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 p-3 text-sm"
          >
            {AD_TYPE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label htmlFor="itemCount" className="block text-sm font-medium text-slate-300 mb-1">
            Počet Inzerátů (simul.)
          </label>
          <select
            id="itemCount"
            value={config.itemCount}
            onChange={handleItemCountChange}
            disabled={isScraping}
            className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 p-3 text-sm"
          >
            {ITEM_COUNT_OPTIONS.map(count => (
              <option key={count} value={count}>{count}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={onStartScraping}
        disabled={isScraping || !apiKeyAvailable}
        className={`w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white 
                    ${isScraping || !apiKeyAvailable ? 'bg-slate-600 cursor-not-allowed' : 'bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-500 transition-colors'} `}
      >
        {isScraping ? (
          <>
            <SpinnerIcon />
            Probíhá scrapování...
          </>
        ) : (
         <> <PlayIcon /> Spustit Scrapování </>
        )}
      </button>
    </div>
  );
};

const SpinnerIcon = () => (
  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const PlayIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 mr-2">
        <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
    </svg>
);


export default ConfigurationPanel;
