import React from 'react';
import { Config } from '../types';

// Hooks
import { useSettingsForm } from '../hooks/useSettingsForm';
import { useFilterRules } from '../hooks/useFilterRules';

// Components
import { ScrapingSettings } from './Settings/ScrapingSettings';
import { FilterRulesSettings } from './Settings/FilterRulesSettings';
import { AdvancedSettings } from './Settings/AdvancedSettings';
import { EnvSnippet } from './Settings/EnvSnippet';

interface SettingsPageProps {
  config: Config;
  onSave: (nextConfig: Config) => Promise<void>;
  onClearDatabase: () => Promise<void>;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ config, onSave, onClearDatabase }) => {
  const {
    draft, setDraft,
    signature, setSignature,
    isSaving, isClearingDb,
    statusMessage,
    usePostgres, setUsePostgres,
    postgresUrl, setPostgresUrl,
    ollamaUrl, setOllamaUrl,
    useProxy, setUseProxy,
    proxyPool, setProxyPool,
    envSnippet,
    handleSave, handleClearDb,
  } = useSettingsForm({ config, onSave, onClearDatabase });

  const filterHooks = useFilterRules(draft, setDraft);

  return (
    <section className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <svg className="w-24 h-24 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53a8.5 8.5 0 0 0-1.42-3.41l1.1-1.1a1 1 0 0 0 0-1.41l-1.42-1.42a1 1 0 0 0-1.41 0l-1.1 1.1A8.5 8.5 0 0 0 12 5.07V3.5a1 1 0 0 0-1-1H9.58a1 1 0 0 0-1 1v1.57a8.5 8.5 0 0 0-3.41 1.42l-1.1-1.1a1 1 0 0 0-1.41 0l-1.42 1.42a1 1 0 0 0 0 1.41l1.1 1.1A8.5 8.5 0 0 0 5.07 12H3.5a1 1 0 0 0-1 1v1.42a1 1 0 0 0 1 1h1.57a8.5 8.5 0 0 0 1.42 3.41l-1.1 1.1a1 1 0 0 0 0 1.41l1.42 1.42a1 1 0 0 0 1.41 0l1.1-1.1A8.5 8.5 0 0 0 12 18.93V20.5a1 1 0 0 0 1 1h1.42a1 1 0 0 0 1-1v-1.57a8.5 8.5 0 0 0 3.41-1.42l1.1 1.1a1 1 0 0 0 1.41 0l1.42-1.42a1 1 0 0 0 0-1.41l-1.1-1.1A8.5 8.5 0 0 0 18.93 12h1.57a1 1 0 0 0 1-1V9.58a1 1 0 0 0-1-1z"></path>
          </svg>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-sky-400">
              Nastavení systému
            </h2>
            <p className="text-slate-400 text-sm mt-1 leading-relaxed max-w-md">
              Konfigurace scrapování, filtrovacích pravidel a napojení na externí AI služby
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {statusMessage && (
              <p className={`text-sm font-medium animate-in fade-in slide-in-from-right-4 duration-300 ${statusMessage.includes('❌') ? 'text-rose-400' : 'text-emerald-400'}`}>
                {statusMessage}
              </p>
            )}
            <button 
              onClick={handleSave} 
              disabled={isSaving} 
              className={`flex items-center gap-2 py-2.5 px-6 rounded-xl font-bold transition-all shadow-lg active:scale-95 disabled:grayscale ${isSaving ? 'bg-emerald-800 animate-pulse' : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white hover:shadow-emerald-500/20'}`}
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Ukládám...
                </>
              ) : (
                <>
                  <span>💾</span> Uložit změny
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Levý sloupec: Scrapování a Filtry */}
          <div className="space-y-6">
            <ScrapingSettings draft={draft} setDraft={setDraft} />
            <FilterRulesSettings {...filterHooks} />
          </div>

          {/* Pravý sloupec: Advanced a Env */}
          <div className="space-y-6">
            <AdvancedSettings 
              draft={draft} setDraft={setDraft}
              ollamaUrl={ollamaUrl} setOllamaUrl={setOllamaUrl}
              signature={signature} setSignature={setSignature}
              usePostgres={usePostgres} setUsePostgres={setUsePostgres}
              postgresUrl={postgresUrl} setPostgresUrl={setPostgresUrl}
              useProxy={useProxy} setUseProxy={setUseProxy}
              proxyPool={proxyPool} setProxyPool={setProxyPool}
              handleClearDb={handleClearDb}
              isClearingDb={isClearingDb}
            />
            <EnvSnippet envSnippet={envSnippet} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default SettingsPage;
