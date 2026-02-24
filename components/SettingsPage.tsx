import React, { useMemo, useState } from 'react';

const SettingsPage: React.FC = () => {
  const [usePostgres, setUsePostgres] = useState(false);
  const [useProxy, setUseProxy] = useState(false);
  const [ollamaModel, setOllamaModel] = useState('llama3.2:1b');
  const [postgresUrl, setPostgresUrl] = useState('postgresql://postgres:heslo@localhost:5432/inzerty');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [proxyPool, setProxyPool] = useState('http://user:pass@proxy1:8080,http://proxy2:8080');

  const envSnippet = useMemo(() => {
    const lines = [
      `OLLAMA_URL=${ollamaUrl}`,
      usePostgres ? 'DB_CLIENT=postgres' : 'DB_CLIENT=sqlite',
      usePostgres ? `DATABASE_URL=${postgresUrl}` : '# DATABASE_URL není potřeba pro SQLite',
      useProxy ? `SCRAPER_PROXY_URLS=${proxyPool}` : '# SCRAPER_PROXY_URLS (volitelné)',
    ];
    return lines.join('\n');
  }, [usePostgres, useProxy, ollamaUrl, postgresUrl, proxyPool]);

  return (
    <section className="mt-6 bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-2xl">
      <h2 className="text-2xl font-semibold text-emerald-400 mb-4">Nastavení aplikace</h2>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
            <h3 className="font-semibold text-sky-300 mb-2">Ollama</h3>
            <label className="block text-sm text-slate-300 mb-1">URL Ollama</label>
            <input value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm" />
            <label className="block text-sm text-slate-300 mt-3 mb-1">Model</label>
            <input value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm" />
            <p className="text-xs text-slate-400 mt-2">Tip: V terminálu spusťte <code>ollama pull {ollamaModel}</code> a poté <code>ollama serve</code>.</p>
          </div>

          <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
            <h3 className="font-semibold text-sky-300 mb-2">Databáze</h3>
            <label className="inline-flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={usePostgres} onChange={(e) => setUsePostgres(e.target.checked)} />
              Použít PostgreSQL místo SQLite
            </label>
            {usePostgres && (
              <>
                <label className="block text-sm text-slate-300 mt-3 mb-1">DATABASE_URL</label>
                <input value={postgresUrl} onChange={(e) => setPostgresUrl(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm" />
              </>
            )}
          </div>

          <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
            <h3 className="font-semibold text-sky-300 mb-2">Proxy pool</h3>
            <label className="inline-flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={useProxy} onChange={(e) => setUseProxy(e.target.checked)} />
              Použít rotaci proxy pro scraper
            </label>
            {useProxy && (
              <>
                <label className="block text-sm text-slate-300 mt-3 mb-1">SCRAPER_PROXY_URLS</label>
                <textarea value={proxyPool} onChange={(e) => setProxyPool(e.target.value)} rows={3} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm" />
              </>
            )}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
          <h3 className="font-semibold text-emerald-300 mb-2">Vygenerované .env nastavení</h3>
          <pre className="text-xs text-slate-200 bg-slate-950 border border-slate-700 rounded p-3 overflow-auto">{envSnippet}</pre>
          <p className="text-xs text-slate-400 mt-3">Zkopírujte do <code>backend/.env</code> nebo exportujte v terminálu před spuštěním backendu.</p>
        </div>
      </div>
    </section>
  );
};

export default SettingsPage;
