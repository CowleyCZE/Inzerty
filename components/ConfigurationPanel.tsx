import React from 'react';
import { BRANDS, AD_TYPE_OPTIONS, ITEM_COUNT_OPTIONS } from '../constants.tsx';
import { Config } from '../types';

interface ConfigurationPanelProps {
  config: Config;
  setConfig: React.Dispatch<React.SetStateAction<Config>>;
  onStartScraping: () => void;
  isScraping: boolean;
  apiKeyAvailable: boolean;
}

const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({ config, setConfig, onStartScraping, isScraping, apiKeyAvailable }) => {
  const handleBrandChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setConfig(prev => ({ ...prev, brand: e.target.value }));
  };

  const handleAdTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setConfig(prev => ({ ...prev, adType: e.target.value }));
  };
  
  const handleItemCountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setConfig(prev => ({ ...prev, itemCount: parseInt(e.target.value, 10) }));
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig(prev => ({ ...prev, url: e.target.value }));
  };

  const handleComparisonMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setConfig(prev => ({ ...prev, comparisonMethod: e.target.value } as any));
  };

  const handleSelectorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({
      ...prev,
      selectors: {
        ...prev.selectors,
        [name]: value,
      }
    }));
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
          <strong className="font-semibold">Chyba konfigurace:</strong> API klíč pro Gemini není dostupný. Zkontrolujte, že je správně nastaven v <code>.env.local</code> souboru a restartovali jste server.
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div>
          <label htmlFor="url" className="block text-sm font-medium text-slate-300 mb-1">
            Cílová URL
          </label>
          <input
            type="text"
            id="url"
            value={config.url}
            onChange={handleUrlChange}
            disabled={isScraping}
            className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 p-3 text-sm"
          />
        </div>
        <div>
          <label htmlFor="comparisonMethod" className="block text-sm font-medium text-slate-300 mb-1">
            Metoda porovnávání inzerátů
          </label>
          <select
            id="comparisonMethod"
            value={(config as any).comparisonMethod || 'auto'}
            onChange={handleComparisonMethodChange}
            disabled={isScraping}
            className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 p-3 text-sm"
          >
            <option value="auto">Automatický výběr (Auto)</option>
            <option value="local-keyword">Bez AI (Termux / Rychlé - přesná shoda)</option>
            <option value="ollama">Lokální AI (Ollama)</option>
          </select>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-sky-400 mb-4 mt-6">CSS Selektory</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div>
          <label htmlFor="item" className="block text-sm font-medium text-slate-300 mb-1">Položka inzerátu</label>
          <input type="text" id="item" name="item" value={config.selectors.item} onChange={handleSelectorChange} disabled={isScraping} className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg p-2 text-sm" />
        </div>
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-slate-300 mb-1">Název</label>
          <input type="text" id="title" name="title" value={config.selectors.title} onChange={handleSelectorChange} disabled={isScraping} className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg p-2 text-sm" />
        </div>
        <div>
          <label htmlFor="price" className="block text-sm font-medium text-slate-300 mb-1">Cena</label>
          <input type="text" id="price" name="price" value={config.selectors.price} onChange={handleSelectorChange} disabled={isScraping} className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg p-2 text-sm" />
        </div>
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-slate-300 mb-1">Datum</label>
          <input type="text" id="date" name="date" value={config.selectors.date} onChange={handleSelectorChange} disabled={isScraping} className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg p-2 text-sm" />
        </div>
        <div>
          <label htmlFor="link" className="block text-sm font-medium text-slate-300 mb-1">Odkaz</label>
          <input type="text" id="link" name="link" value={config.selectors.link} onChange={handleSelectorChange} disabled={isScraping} className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg p-2 text-sm" />
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
