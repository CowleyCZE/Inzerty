import React, { useEffect, useMemo, useState } from 'react';
import { Config, AdSource } from '../types';
import { PlatformSelector } from './PlatformSelector';

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
  const [signature, setSignature] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isClearingDb, setIsClearingDb] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  
  // Blacklist/whitelist management
  const [blacklistInput, setBlacklistInput] = useState('');
  const [whitelistInput, setWhitelistInput] = useState('');
  const [showBlacklistHelp, setShowBlacklistHelp] = useState(false);
  const [showWhitelistHelp, setShowWhitelistHelp] = useState(false);

  useEffect(() => {
    setDraft(config);
    // Načíst podpis z localStorage
    const savedSignature = localStorage.getItem('inzerty_signature_v1');
    if (savedSignature) {
      setSignature(savedSignature);
    }
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

  // Add item to blacklist
  const addToBlacklist = (term: string) => {
    const trimmed = term.trim().toLowerCase();
    if (!trimmed) return;
    if (filterRules.blacklistTerms.includes(trimmed)) {
      setStatusMessage('⚠️ Tento výraz již je v blacklistu');
      setTimeout(() => setStatusMessage(''), 3000);
      return;
    }
    updateRules({ blacklistTerms: [...filterRules.blacklistTerms, trimmed] });
    setBlacklistInput('');
  };

  // Remove item from blacklist
  const removeFromBlacklist = (term: string) => {
    updateRules({ blacklistTerms: filterRules.blacklistTerms.filter(t => t !== term) });
  };

  // Add item to whitelist
  const addToWhitelist = (model: string) => {
    const trimmed = model.trim().toLowerCase();
    if (!trimmed) return;
    if (filterRules.whitelistModels.includes(trimmed)) {
      setStatusMessage('⚠️ Tento model již je ve whitelistu');
      setTimeout(() => setStatusMessage(''), 3000);
      return;
    }
    updateRules({ whitelistModels: [...filterRules.whitelistModels, trimmed] });
    setWhitelistInput('');
  };

  // Remove item from whitelist
  const removeFromWhitelist = (model: string) => {
    updateRules({ whitelistModels: filterRules.whitelistModels.filter(m => m !== model) });
  };

  // Handle keyboard events for quick add
  const handleBlacklistKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addToBlacklist(blacklistInput);
    }
  };

  const handleWhitelistKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addToWhitelist(whitelistInput);
    }
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
      // Uložit podpis do localStorage
      localStorage.setItem('inzerty_signature_v1', signature);
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

      <div className="space-y-6">
        {/* Platform Selector */}
        <PlatformSelector
          enabledPlatforms={draft.enabledPlatforms || ['bazos_cz']}
          onTogglePlatform={(source, enabled) => {
            setDraft((prev) => {
              const current = prev.enabledPlatforms || ['bazos_cz'];
              const updated = enabled
                ? [...current, source]
                : current.filter(s => s !== source);
              return { ...prev, enabledPlatforms: updated };
            });
          }}
        />

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
            <h3 className="font-semibold text-sky-300 mb-2">🚫 Blacklist / ✅ Whitelist pravidla</h3>
            
            {/* Blacklist Section */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm text-slate-300 font-medium">
                  🚫 Blacklist výrazů ({filterRules.blacklistTerms.length} položek)
                </label>
                <button 
                  onClick={() => setShowBlacklistHelp(!showBlacklistHelp)}
                  className="text-xs text-sky-400 hover:text-sky-300"
                >
                  {showBlacklistHelp ? 'Skrýt nápovědu' : 'Zobrazit nápovědu'}
                </button>
              </div>
              
              {showBlacklistHelp && (
                <div className="mb-3 p-3 bg-slate-800 border border-slate-600 rounded text-xs text-slate-300">
                  <p className="font-semibold mb-1">Jak funguje blacklist:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Inzeráty obsahující tyto výrazy budou <strong className="text-rose-400">vyřazeny</strong></li>
                    <li>Porovnává se s názvem, popisem i modelem inzerátu</li>
                    <li>Na malých písmenech nezáleží (case-insensitive)</li>
                    <li>Příklady: <code className="bg-slate-700 px-1 rounded">rozbitý</code>, <code className="bg-slate-700 px-1 rounded">na díly</code>, <code className="bg-slate-700 px-1 rounded">bez displeje</code>, <code className="bg-slate-700 px-1 rounded">poškozený</code></li>
                  </ul>
                </div>
              )}
              
              <div className="flex gap-2 mb-2">
                <input 
                  value={blacklistInput} 
                  onChange={(e) => setBlacklistInput(e.target.value)} 
                  onKeyDown={handleBlacklistKeyDown}
                  className="flex-1 bg-slate-700 border border-slate-600 rounded p-2 text-sm" 
                  placeholder="Přidat výraz (např. rozbitý)" 
                />
                <button 
                  onClick={() => addToBlacklist(blacklistInput)}
                  className="px-3 py-2 bg-rose-700 hover:bg-rose-600 rounded text-sm font-medium"
                >
                  ➕ Přidat
                </button>
              </div>
              
              {/* Blacklist Tags */}
              <div className="flex flex-wrap gap-2 mt-2">
                {filterRules.blacklistTerms.length === 0 ? (
                  <span className="text-xs text-slate-500 italic">Žádné blacklist výrazy</span>
                ) : (
                  filterRules.blacklistTerms.map((term) => (
                    <span 
                      key={term} 
                      className="inline-flex items-center gap-1 px-2 py-1 bg-rose-900/50 border border-rose-700 rounded text-xs text-rose-300"
                    >
                      🚫 {term}
                      <button 
                        onClick={() => removeFromBlacklist(term)}
                        className="hover:text-white"
                        title="Odstranit"
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>
              
              <input 
                value={filterRules.blacklistTerms.join(', ')} 
                onChange={(e) => updateRules({ blacklistTerms: parseList(e.target.value) })} 
                className="w-full mt-2 bg-slate-700 border border-slate-600 rounded p-2 text-xs text-slate-400" 
                placeholder="Nebo hromadně oddělené čárkou..." 
              />
            </div>
            
            {/* Whitelist Section */}
            <div className="border-t border-slate-700 pt-4">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm text-slate-300 font-medium">
                  ✅ Whitelist modelů/variant ({filterRules.whitelistModels.length} položek)
                </label>
                <button 
                  onClick={() => setShowWhitelistHelp(!showWhitelistHelp)}
                  className="text-xs text-emerald-400 hover:text-emerald-300"
                >
                  {showWhitelistHelp ? 'Skrýt nápovědu' : 'Zobrazit nápovědu'}
                </button>
              </div>
              
              {showWhitelistHelp && (
                <div className="mb-3 p-3 bg-slate-800 border border-slate-600 rounded text-xs text-slate-300">
                  <p className="font-semibold mb-1">Jak funguje whitelist:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Pokud je vyplněn, zahrne <strong className="text-emerald-400">pouze</strong> inzeráty s těmito modely</li>
                    <li>Prazdný whitelist = všechny modely jsou povoleny</li>
                    <li>Porovnává se s názvem a modelem inzerátu</li>
                    <li>Na malých písmenech nezáleží (case-insensitive)</li>
                    <li>Příklady: <code className="bg-slate-700 px-1 rounded">iphone 14 pro</code>, <code className="bg-slate-700 px-1 rounded">samsung s23 ultra</code>, <code className="bg-slate-700 px-1 rounded">256gb</code></li>
                  </ul>
                </div>
              )}
              
              <div className="flex gap-2 mb-2">
                <input 
                  value={whitelistInput} 
                  onChange={(e) => setWhitelistInput(e.target.value)} 
                  onKeyDown={handleWhitelistKeyDown}
                  className="flex-1 bg-slate-700 border border-slate-600 rounded p-2 text-sm" 
                  placeholder="Přidat model (např. iphone 14 pro)" 
                />
                <button 
                  onClick={() => addToWhitelist(whitelistInput)}
                  className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 rounded text-sm font-medium"
                >
                  ➕ Přidat
                </button>
              </div>
              
              {/* Whitelist Tags */}
              <div className="flex flex-wrap gap-2 mt-2">
                {filterRules.whitelistModels.length === 0 ? (
                  <span className="text-xs text-slate-500 italic">Žádný whitelist (všechny modely povoleny)</span>
                ) : (
                  filterRules.whitelistModels.map((model) => (
                    <span 
                      key={model} 
                      className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-900/50 border border-emerald-700 rounded text-xs text-emerald-300"
                    >
                      ✅ {model}
                      <button 
                        onClick={() => removeFromWhitelist(model)}
                        className="hover:text-white"
                        title="Odstranit"
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>
              
              <input 
                value={filterRules.whitelistModels.join(', ')} 
                onChange={(e) => updateRules({ whitelistModels: parseList(e.target.value) })} 
                className="w-full mt-2 bg-slate-700 border border-slate-600 rounded p-2 text-xs text-slate-400" 
                placeholder="Nebo hromadně oddělené čárkou..." 
              />
            </div>
            
            {/* Price & Storage Filters */}
            <div className="border-t border-slate-700 pt-4 mt-4">
              <label className="block text-sm text-slate-300 mb-2">💰 Cenové filtry a úložiště</label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-xs text-slate-400">Min cena (Kč)</span>
                  <input 
                    type="number" 
                    value={filterRules.minPrice ?? ''} 
                    onChange={(e) => updateRules({ minPrice: e.target.value ? Number(e.target.value) : null })} 
                    className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm" 
                    placeholder="0" 
                  />
                </div>
                <div>
                  <span className="text-xs text-slate-400">Max cena (Kč)</span>
                  <input 
                    type="number" 
                    value={filterRules.maxPrice ?? ''} 
                    onChange={(e) => updateRules({ maxPrice: e.target.value ? Number(e.target.value) : null })} 
                    className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm" 
                    placeholder="50000" 
                  />
                </div>
                <div>
                  <span className="text-xs text-slate-400">Min úložiště (GB)</span>
                  <input 
                    type="number" 
                    value={filterRules.minStorageGb ?? ''} 
                    onChange={(e) => updateRules({ minStorageGb: e.target.value ? Number(e.target.value) : null })} 
                    className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm" 
                    placeholder="128" 
                  />
                </div>
              </div>
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
            <h3 className="font-semibold text-sky-300 mb-2">Podpis v e-mailech</h3>
            <label className="block text-sm text-slate-300 mb-1">Váš podpis</label>
            <input 
              value={signature} 
              onChange={(e) => setSignature(e.target.value)} 
              placeholder="Jan Novák | Tel: +420 123 456 789"
              className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm" 
            />
            <p className="text-xs text-slate-400 mt-2">Tento podpis bude použit v e-mailech a zprávách místo "Inzerty Bot".</p>
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

          {/* Druhý sloupec */}
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
              <h3 className="font-semibold text-emerald-300 mb-2">Vygenerované .env nastavení</h3>
              <pre className="text-xs text-slate-200 bg-slate-950 border border-slate-700 rounded p-3 overflow-auto">{envSnippet}</pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SettingsPage;
