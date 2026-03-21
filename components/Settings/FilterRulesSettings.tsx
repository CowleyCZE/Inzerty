import React from 'react';

interface FilterRulesSettingsProps {
  filterRules: any;
  blacklistInput: string;
  setBlacklistInput: (val: string) => void;
  whitelistInput: string;
  setWhitelistInput: (val: string) => void;
  showBlacklistHelp: boolean;
  setShowBlacklistHelp: (val: boolean) => void;
  showWhitelistHelp: boolean;
  setShowWhitelistHelp: (val: boolean) => void;
  updateRules: (patch: any) => void;
  addToBlacklist: (term: string) => void;
  removeFromBlacklist: (term: string) => void;
  addToWhitelist: (model: string) => void;
  removeFromWhitelist: (model: string) => void;
}

const parseList = (raw: string) => raw.split(',').map((s) => s.trim()).filter(Boolean);

export const FilterRulesSettings: React.FC<FilterRulesSettingsProps> = ({
  filterRules,
  blacklistInput, setBlacklistInput,
  whitelistInput, setWhitelistInput,
  showBlacklistHelp, setShowBlacklistHelp,
  showWhitelistHelp, setShowWhitelistHelp,
  updateRules,
  addToBlacklist, removeFromBlacklist,
  addToWhitelist, removeFromWhitelist,
}) => {
  return (
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
          <div className="mb-3 p-3 bg-slate-800 border border-slate-600 rounded text-xs text-slate-300 animate-in fade-in slide-in-from-top-2 duration-300">
            <p className="font-semibold mb-1 italic">Jak funguje blacklist:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Inzeráty obsahující tyto výrazy budou <strong className="text-rose-400">vyřazeny</strong>.</li>
              <li>Porovnává se s názvem, popisem i modelem inzerátu (case-insensitive).</li>
            </ul>
          </div>
        )}
        
        <div className="flex gap-2">
          <input 
            value={blacklistInput} 
            onChange={(e) => setBlacklistInput(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && addToBlacklist(blacklistInput)}
            className="flex-1 bg-slate-700 border border-slate-600 rounded p-2 text-sm focus:border-rose-500 transition-colors" 
            placeholder="Přidat výraz (např. rozbitý)" 
          />
          <button 
            onClick={() => addToBlacklist(blacklistInput)}
            className="px-3 py-2 bg-rose-700 hover:bg-rose-600 rounded text-sm font-medium transition-colors"
          >
            ➕ Přidat
          </button>
        </div>
        
        <div className="flex flex-wrap gap-2 mt-3">
          {filterRules.blacklistTerms.map((term: string) => (
            <span key={term} className="inline-flex items-center gap-1 px-2 py-1 bg-rose-900/40 border border-rose-700 rounded text-xs text-rose-300">
              🚫 {term}
              <button onClick={() => removeFromBlacklist(term)} className="hover:text-white font-bold ml-1">×</button>
            </span>
          ))}
        </div>
        
        <input 
          value={filterRules.blacklistTerms.join(', ')} 
          onChange={(e) => updateRules({ blacklistTerms: parseList(e.target.value) })} 
          className="w-full mt-3 bg-slate-700 border border-slate-600 rounded p-2 text-xs text-slate-400 opacity-70 italic focus:opacity-100 transition-opacity" 
          placeholder="Nebo hromadně oddělené čárkou..." 
        />
      </div>
      
      {/* Whitelist Section */}
      <div className="border-t border-slate-700 pt-4 mt-6">
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
            <p className="font-semibold mb-1 italic">Jak funguje whitelist:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Pokud je vyplněn, zahrne <strong className="text-emerald-400">pouze</strong> inzeráty s těmito modely.</li>
              <li>Prazdný whitelist = všechny modely jsou povoleny.</li>
            </ul>
          </div>
        )}
        
        <div className="flex gap-2">
          <input 
            value={whitelistInput} 
            onChange={(e) => setWhitelistInput(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && addToWhitelist(whitelistInput)}
            className="flex-1 bg-slate-700 border border-slate-600 rounded p-2 text-sm focus:border-emerald-500 transition-colors" 
            placeholder="Přidat model (např. iphone 14 pro)" 
          />
          <button 
            onClick={() => addToWhitelist(whitelistInput)}
            className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 rounded text-sm font-medium transition-colors"
          >
            ➕ Přidat
          </button>
        </div>
        
        <div className="flex flex-wrap gap-2 mt-3">
          {filterRules.whitelistModels.map((model: string) => (
            <span key={model} className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-900/40 border border-emerald-700 rounded text-xs text-emerald-300">
              ✅ {model}
              <button onClick={() => removeFromWhitelist(model)} className="hover:text-white font-bold ml-1">×</button>
            </span>
          ))}
        </div>
      </div>
      
      {/* Numbers Section */}
      <div className="border-t border-slate-700 pt-4 mt-6">
        <label className="block text-sm text-slate-300 mb-2 font-medium">💰 Číselné limity</label>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold mb-1">Min cena</span>
            <input type="number" value={filterRules.minPrice ?? ''} onChange={(e) => updateRules({ minPrice: e.target.value ? Number(e.target.value) : null })} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm" placeholder="0" title="Cena v Kč" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold mb-1">Max cena</span>
            <input type="number" value={filterRules.maxPrice ?? ''} onChange={(e) => updateRules({ maxPrice: e.target.value ? Number(e.target.value) : null })} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm" placeholder="50000" title="Cena v Kč" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold mb-1">Min GB</span>
            <input type="number" value={filterRules.minStorageGb ?? ''} onChange={(e) => updateRules({ minStorageGb: e.target.value ? Number(e.target.value) : null })} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm" placeholder="128" />
          </div>
        </div>
      </div>
    </div>
  );
};
