import React, { useEffect, useMemo, useState } from 'react';
import { Config } from '../types';

interface SettingsPageProps {
  config: Config;
  onSave: (nextConfig: Config) => Promise<void>;
  onClearDatabase: () => Promise<void>;
}

const parseList = (raw: string) => raw.split(',').map((s) => s.trim()).filter(Boolean);

const SettingsPage: React.FC<SettingsPageProps> = ({ config, onSave, onClearDatabase }) => {
  const [draft, setDraft] = useState<Config>(config);
  const [usePostgres, setUsePostgres] = useState(false);
  const [useProxy, setUseProxy] = useState(false);
  const [postgresUrl, setPostgresUrl] = useState('postgresql://postgres:heslo@localhost:5432/inzerty');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [proxyPool, setProxyPool] = useState('http://user:pass@proxy1:8080,http://proxy2:8080');
  const [isSaving, setIsSaving] = useState(false);
  const [isClearingDb, setIsClearingDb] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    setDraft(config);
  }, [config]);

  const filterRules = draft.filterRules || {
    blacklistTerms: [],
    whitelistModels: [],
    minPrice: null,
    maxPrice: null,
    minStorageGb: null,
  };

  const scrapingOptions = draft.scrapingOptions || {
    stopOnKnownAd: true,
    maxAdsPerTypePerBrand: 50,
  };

  const envSnippet = useMemo(() => {
    const lines = [
      `OLLAMA_URL=${ollamaUrl}`,
      `OLLAMA_MODEL=${draft.ollamaModel || 'all-minilm:22m'}`,
      usePostgres ? 'DB_CLIENT=postgres' : 'DB_CLIENT=sqlite',
      usePostgres ? `DATABASE_URL=${postgresUrl}` : '# DATABASE_URL není potřeba pro SQLite',
      useProxy ? `SCRAPER_PROXY_URLS=${proxyPool}` : '# SCRAPER_PROXY_URLS (volitelné)',
    ];
    return lines.join('\n');
  }, [draft.ollamaModel, usePostgres, useProxy, ollamaUrl, postgresUrl, proxyPool]);

  const updateRules = (patch: Partial<typeof filterRules>) => {
    setDraft((prev) => ({ ...prev, filterRules: { ...filterRules, ...patch } }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      await onSave(draft);
      setStatusMessage('Nastavení bylo úspěšně uloženo.');
    } catch (error) {
      setStatusMessage(`Uložení selhalo: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearDb = async () => {
    const confirmed = window.confirm('Opravdu chcete vymazat databázi? Tato akce je nevratná.');
    if (!confirmed) return;

    setIsClearingDb(true);
    setStatusMessage('');
    try {
      await onClearDatabase();
      setStatusMessage('Databáze byla vymazána.');
    } catch (error) {
      setStatusMessage(`Mazání databáze selhalo: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    } finally {
      setIsClearingDb(false);
    }
  };

  return (
    <section className="mt-6 bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-2xl">
      <h2 className="text-2xl font-semibold text-emerald-400 mb-4">Nastavení aplikace</h2>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
            <h3 className="font-semibold text-sky-300 mb-2">Nastavení scrapování</h3>
            <label className="inline-flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={scrapingOptions.stopOnKnownAd}
                onChange={(e) => setDraft((prev) => ({
                  ...prev,
                  scrapingOptions: {
                    stopOnKnownAd: e.target.checked,
                    maxAdsPerTypePerBrand: prev.scrapingOptions?.maxAdsPerTypePerBrand ?? 50,
                  },
                }))}
              />
              Zastavit inkrementální scraping po nalezení již dříve staženého inzerátu
            </label>
            <p className="text-xs text-slate-400 mt-2">Pro testování můžete vypnout, aby scraper vždy pokračoval dál.</p>

            <label className="block text-sm text-slate-300 mt-3 mb-1">Limit inzerátů na značku + typ (nabídka/poptávka)</label>
            <input
              type="number"
              min={1}
              max={500}
              value={scrapingOptions.maxAdsPerTypePerBrand}
              onChange={(e) => setDraft((prev) => ({
                ...prev,
                scrapingOptions: {
                  stopOnKnownAd: prev.scrapingOptions?.stopOnKnownAd ?? true,
                  maxAdsPerTypePerBrand: Math.max(1, Number(e.target.value) || 50),
                },
              }))}
              className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm"
            />
          </div>

          <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
            <h3 className="font-semibold text-sky-300 mb-2">Blacklist / whitelist pravidla</h3>
            <label className="block text-sm text-slate-300 mb-1">Blacklist výrazů (oddělené čárkou)</label>
            <input value={filterRules.blacklistTerms.join(', ')} onChange={(e) => updateRules({ blacklistTerms: parseList(e.target.value) })} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm" placeholder="rozbitý, na díly, bez displeje" />
            <label className="block text-sm text-slate-300 mt-3 mb-1">Whitelist modelů/variant</label>
            <input value={filterRules.whitelistModels.join(', ')} onChange={(e) => updateRules({ whitelistModels: parseList(e.target.value) })} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm" placeholder="iphone 14 pro, iphone 15 pro max" />
            <div className="grid grid-cols-3 gap-2 mt-3">
              <input type="number" value={filterRules.minPrice ?? ''} onChange={(e) => updateRules({ minPrice: e.target.value ? Number(e.target.value) : null })} className="bg-slate-700 border border-slate-600 rounded p-2 text-sm" placeholder="Min cena" />
              <input type="number" value={filterRules.maxPrice ?? ''} onChange={(e) => updateRules({ maxPrice: e.target.value ? Number(e.target.value) : null })} className="bg-slate-700 border border-slate-600 rounded p-2 text-sm" placeholder="Max cena" />
              <input type="number" value={filterRules.minStorageGb ?? ''} onChange={(e) => updateRules({ minStorageGb: e.target.value ? Number(e.target.value) : null })} className="bg-slate-700 border border-slate-600 rounded p-2 text-sm" placeholder="Min GB" />
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
            <h3 className="font-semibold text-sky-300 mb-2">Ollama</h3>
            <label className="block text-sm text-slate-300 mb-1">URL Ollama</label>
            <input value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm" />
            <label className="block text-sm text-slate-300 mt-3 mb-1">Model</label>
            <input value={draft.ollamaModel || ''} onChange={(e) => setDraft((prev) => ({ ...prev, ollamaModel: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm" />
            <p className="text-xs text-slate-400 mt-2">Výchozí model je nastaven na all-minilm:22m.</p>
          </div>

          <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
            <h3 className="font-semibold text-sky-300 mb-2">Databáze / Proxy</h3>
            <label className="inline-flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={usePostgres} onChange={(e) => setUsePostgres(e.target.checked)} /> Použít PostgreSQL</label>
            {usePostgres && <input value={postgresUrl} onChange={(e) => setPostgresUrl(e.target.value)} className="mt-2 w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm" />}
            <label className="inline-flex items-center gap-2 text-sm text-slate-300 mt-3"><input type="checkbox" checked={useProxy} onChange={(e) => setUseProxy(e.target.checked)} /> Použít proxy pool</label>
            {useProxy && <textarea value={proxyPool} onChange={(e) => setProxyPool(e.target.value)} rows={3} className="mt-2 w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm" />}

            <button
              onClick={handleClearDb}
              disabled={isClearingDb}
              className="mt-4 bg-rose-700 hover:bg-rose-800 disabled:bg-rose-900 text-white text-sm font-semibold py-2 px-3 rounded"
            >
              {isClearingDb ? 'Mažu databázi...' : 'Vymazat databáze'}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-900 text-white font-semibold py-2 px-4 rounded-lg">
              {isSaving ? 'Ukládám...' : 'Uložit'}
            </button>
            {statusMessage && <p className="text-sm text-slate-300">{statusMessage}</p>}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
          <h3 className="font-semibold text-emerald-300 mb-2">Vygenerované .env nastavení</h3>
          <pre className="text-xs text-slate-200 bg-slate-950 border border-slate-700 rounded p-3 overflow-auto">{envSnippet}</pre>
        </div>
      </div>
    </section>
  );
};

export default SettingsPage;
