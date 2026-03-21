import React from 'react';
import { Config } from '../../types';

interface AdvancedSettingsProps {
  draft: Config;
  setDraft: React.Dispatch<React.SetStateAction<Config>>;
  ollamaUrl: string;
  setOllamaUrl: (val: string) => void;
  signature: string;
  setSignature: (val: string) => void;
  usePostgres: boolean;
  setUsePostgres: (val: boolean) => void;
  postgresUrl: string;
  setPostgresUrl: (val: string) => void;
  useProxy: boolean;
  setUseProxy: (val: boolean) => void;
  proxyPool: string;
  setProxyPool: (val: string) => void;
  handleClearDb: () => void;
  isClearingDb: boolean;
}

export const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({
  draft, setDraft,
  ollamaUrl, setOllamaUrl,
  signature, setSignature,
  usePostgres, setUsePostgres,
  postgresUrl, setPostgresUrl,
  useProxy, setUseProxy,
  proxyPool, setProxyPool,
  handleClearDb, isClearingDb,
}) => {
  return (
    <div className="space-y-4">
      <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
        <h3 className="font-semibold text-sky-300 mb-2">Ollama AI server</h3>
        <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1 ml-1 leading-none tracking-wider">URL Ollama</label>
        <input 
          value={ollamaUrl} 
          onChange={(e) => setOllamaUrl(e.target.value)} 
          className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm focus:border-sky-500 transition-colors" 
        />
        
        <label className="block text-[10px] text-slate-500 uppercase font-bold mt-4 mb-1 ml-1 leading-none tracking-wider">Model</label>
        <input 
          value={draft.ollamaModel || ''} 
          onChange={(e) => setDraft((prev) => ({ ...prev, ollamaModel: e.target.value }))} 
          className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm focus:border-sky-500 transition-colors" 
          placeholder="all-minilm:22m"
        />
        <p className="text-[10px] text-slate-500 mt-2 italic px-1">Výchozí: all-minilm:22m | Doporučeno: llama3.1, qwen2.5</p>
      </div>

      <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
        <h3 className="font-semibold text-sky-300 mb-2">Podpis v e-mailech</h3>
        <label className="block text-xs text-slate-500 mb-1 ml-1">Váš podpis</label>
        <input 
          value={signature} 
          onChange={(e) => setSignature(e.target.value)} 
          placeholder="Jan Novák | Tel: +420 123 456 789"
          className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm focus:border-sky-500 transition-colors" 
        />
        <p className="text-[10px] text-slate-500 mt-2 italic px-1">Tento podpis bude použit v e-mailech a zprávách místo "Inzerty Bot".</p>
      </div>

      <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 shadow-sm group">
        <h3 className="font-semibold text-sky-300 mb-3 flex items-center gap-2">
          <span>🛠️ Systémové nastavení</span>
          <span className="text-[10px] bg-sky-900/40 text-sky-400 px-1 rounded font-bold border border-sky-800 tracking-wide">EXPERIMENTAL</span>
        </h3>
        
        <div className="space-y-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-300 cursor-pointer hover:text-white transition-colors">
            <input type="checkbox" checked={usePostgres} onChange={(e) => setUsePostgres(e.target.checked)} className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 bg-slate-800 border-slate-700" />
            Použít PostgreSQL <span className="text-xs text-slate-500">(jinak výchozí SQLite)</span>
          </label>
          
          {usePostgres && (
            <input value={postgresUrl} onChange={(e) => setPostgresUrl(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-xs font-mono text-emerald-400 animate-in fade-in slide-in-from-top-1 duration-200" placeholder="postgresql://..." />
          )}
          
          <div className="h-[1px] bg-slate-700 my-2"></div>
          
          <label className="inline-flex items-center gap-2 text-sm text-slate-300 cursor-pointer hover:text-white transition-colors">
            <input type="checkbox" checked={useProxy} onChange={(e) => setUseProxy(e.target.checked)} className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 bg-slate-800 border-slate-700" />
            Použít Proxy Pool <span className="text-xs text-slate-500">(proti zablokování)</span>
          </label>
          
          {useProxy && (
            <textarea value={proxyPool} onChange={(e) => setProxyPool(e.target.value)} rows={3} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-xs font-mono text-amber-400 animate-in fade-in slide-in-from-top-1 duration-200" placeholder="http://proxy1:8080\nhttp://proxy2:8080" />
          )}
        </div>

        <div className="mt-5 pt-4 border-t border-slate-700 flex justify-between items-center">
          <span className="text-xs text-slate-500 font-medium italic">Správa databáze:</span>
          <button
            onClick={handleClearDb}
            disabled={isClearingDb}
            className="bg-rose-700/80 hover:bg-rose-600 disabled:bg-slate-700 border border-rose-900 text-white text-[11px] font-bold py-1.5 px-3 rounded shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            {isClearingDb ? '♻️ Probíhá čištění...' : '🗑️ Vymazat všechny shody'}
          </button>
        </div>
      </div>
    </div>
  );
};
