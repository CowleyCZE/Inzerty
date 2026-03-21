# Plán refaktorování: components/SettingsPage.tsx

## 📊 Stav

- **Počet řádků**: 452
- **Hlavní zodpovědnosti**:
  - Nastavení scrapování (stopOnKnownAd, maxAdsPerTypePerBrand)
  - Blacklist/Whitelist management
  - Cenové filtry a úložiště
  - Ollama konfigurace
  - Podpis v e-mailech
  - Databáze/Proxy nastavení
  - Platform selector (multi-platform support)
  - .env snippet generování
  - Ukládání do localStorage i backendu

## ⚠️ Problémy

1. **Příliš mnoho responsibilit** - Jedna komponenta dělá vše
2. **Komplexní stavová logika** - Mnoho useState hooků
3. **Duplicitní kód** - Blacklist/Whitelist mají stejnou logiku
4. **Žádná validace** - Chybí validace vstupů
5. **Těžké testování** - Nelze izolovat jednotlivé sekce

## 📋 Navrhované rozdělení

### 1. `hooks/useSettingsForm.ts` (Nový hook)
**Responsibility**: Stavová logika pro formuláře

```typescript
import { useState, useEffect, useCallback } from 'react';
import { Config, AdSource } from '../types';

const SETTINGS_STORAGE_KEY = 'inzerty_settings_v1';

interface UseSettingsFormResult {
  draft: Config;
  signature: string;
  usePostgres: boolean;
  useProxy: boolean;
  postgresUrl: string;
  proxyPool: string;
  ollamaUrl: string;
  setDraft: React.Dispatch<React.SetStateAction<Config>>;
  setSignature: (signature: string) => void;
  setUsePostgres: (value: boolean) => void;
  setUseProxy: (value: boolean) => void;
  loadSettings: () => void;
  saveToLocalStorage: () => void;
}

export const useSettingsForm = (config: Config): UseSettingsFormResult => {
  const [draft, setDraft] = useState<Config>(config);
  const [signature, setSignature] = useState('');
  const [usePostgres, setUsePostgres] = useState(false);
  const [useProxy, setUseProxy] = useState(false);
  const [postgresUrl, setPostgresUrl] = useState('postgresql://...');
  const [proxyPool, setProxyPool] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');

  useEffect(() => {
    setDraft(config);
    const savedSignature = localStorage.getItem('inzerty_signature_v1');
    if (savedSignature) setSignature(savedSignature);
  }, [config]);

  const loadSettings = useCallback(() => {
    // Load from localStorage
  }, []);

  const saveToLocalStorage = useCallback(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(draft));
    localStorage.setItem('inzerty_signature_v1', signature);
  }, [draft, signature]);

  return {
    draft,
    signature,
    usePostgres,
    useProxy,
    postgresUrl,
    proxyPool,
    ollamaUrl,
    setDraft,
    setSignature,
    setUsePostgres,
    setUseProxy,
    loadSettings,
    saveToLocalStorage,
  };
};
```

---

### 2. `hooks/useFilterRules.ts` (Nový hook)
**Responsibility**: Blacklist/Whitelist management

```typescript
import { useState, useCallback } from 'react';
import { FilterRules } from '../types';

interface UseFilterRulesResult {
  filterRules: FilterRules;
  blacklistInput: string;
  whitelistInput: string;
  addToBlacklist: (term: string) => void;
  removeFromBlacklist: (term: string) => void;
  addToWhitelist: (model: string) => void;
  removeFromWhitelist: (model: string) => void;
  updateRules: (updates: Partial<FilterRules>) => void;
  importFromText: (text: string, type: 'blacklist' | 'whitelist') => void;
}

export const useFilterRules = (initialRules: FilterRules): UseFilterRulesResult => {
  const [filterRules, setFilterRules] = useState<FilterRules>(initialRules);
  const [blacklistInput, setBlacklistInput] = useState('');
  const [whitelistInput, setWhitelistInput] = useState('');

  const updateRules = useCallback((updates: Partial<FilterRules>) => {
    setFilterRules((prev) => ({ ...prev, ...updates }));
  }, []);

  const addToBlacklist = useCallback((term: string) => {
    const trimmed = term.trim().toLowerCase();
    if (!trimmed || filterRules.blacklistTerms.includes(trimmed)) return;
    updateRules({ blacklistTerms: [...filterRules.blacklistTerms, trimmed] });
  }, [filterRules.blacklistTerms, updateRules]);

  const removeFromBlacklist = useCallback((term: string) => {
    updateRules({ 
      blacklistTerms: filterRules.blacklistTerms.filter(t => t !== term) 
    });
  }, [filterRules.blacklistTerms, updateRules]);

  const addToWhitelist = useCallback((model: string) => {
    const trimmed = model.trim().toLowerCase();
    if (!trimmed || filterRules.whitelistModels.includes(trimmed)) return;
    updateRules({ whitelistModels: [...filterRules.whitelistModels, trimmed] });
  }, [filterRules.whitelistModels, updateRules]);

  const removeFromWhitelist = useCallback((model: string) => {
    updateRules({ 
      whitelistModels: filterRules.whitelistModels.filter(m => m !== model) 
    });
  }, [filterRules.whitelistModels, updateRules]);

  const importFromText = useCallback((text: string, type: 'blacklist' | 'whitelist') => {
    const items = text.split(',').map(s => s.trim()).filter(Boolean);
    if (type === 'blacklist') {
      updateRules({ 
        blacklistTerms: [...filterRules.blacklistTerms, ...items] 
      });
    } else {
      updateRules({ 
        whitelistModels: [...filterRules.whitelistModels, ...items] 
      });
    }
  }, [filterRules, updateRules]);

  return {
    filterRules,
    blacklistInput,
    whitelistInput,
    addToBlacklist,
    removeFromBlacklist,
    addToWhitelist,
    removeFromWhitelist,
    updateRules,
    importFromText,
  };
};
```

---

### 3. `components/Settings/` (Nová složka)
**Responsibility**: Jednotlivé sekce nastavení

```
Settings/
├── SettingsPage.tsx        # Hlavní stránka (přejmenovat původní)
├── ScrapingSettings.tsx    # Nastavení scrapování
├── FilterRulesSettings.tsx # Blacklist/Whitelist
├── PriceFilters.tsx        # Cenové filtry
├── OllamaSettings.tsx      # Ollama konfigurace
├── SignatureSettings.tsx   # Podpis v e-mailech
├── DatabaseSettings.tsx    # Databáze/Proxy
├── PlatformSelector.tsx    # Výběr platforem (přesunout z root)
├── EnvSnippet.tsx          # .env generování
└── index.ts                # Exporty
```

---

### 4. `components/Settings/ScrapingSettings.tsx` (Nová komponenta)
**Responsibility**: Nastavení scrapování

```typescript
import React from 'react';

interface ScrapingSettingsProps {
  stopOnKnownAd: boolean;
  maxAdsPerTypePerBrand: number;
  onStopOnKnownAdChange: (value: boolean) => void;
  onMaxAdsChange: (value: number) => void;
}

export const ScrapingSettings: React.FC<ScrapingSettingsProps> = ({
  stopOnKnownAd,
  maxAdsPerTypePerBrand,
  onStopOnKnownAdChange,
  onMaxAdsChange,
}) => {
  return (
    <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
      <h3 className="font-semibold text-sky-300 mb-2">Nastavení scrapování</h3>
      
      <label className="inline-flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={stopOnKnownAd}
          onChange={(e) => onStopOnKnownAdChange(e.target.checked)}
        />
        Zastavit inkrementální scraping po nalezení známého inzerátu
      </label>
      <p className="text-xs text-slate-400 mt-2">
        Pro testování můžete vypnout, aby scraper vždy pokračoval dál.
      </p>

      <div className="mt-3">
        <label className="block text-sm text-slate-300 mb-1">
          Limit inzerátů na značku + typ
        </label>
        <input
          type="number"
          min={1}
          max={500}
          value={maxAdsPerTypePerBrand}
          onChange={(e) => onMaxAdsChange(Math.max(1, Number(e.target.value) || 50))}
          className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm"
        />
      </div>
    </div>
  );
};
```

---

### 5. `components/Settings/FilterRulesSettings.tsx` (Nová komponenta)
**Responsibility**: Blacklist/Whitelist sekce

```typescript
import React, { useState } from 'react';
import { FilterRules } from '../../types';
import { TagInput } from '../common/TagInput';

interface FilterRulesSettingsProps {
  filterRules: FilterRules;
  onChange: (rules: FilterRules) => void;
}

export const FilterRulesSettings: React.FC<FilterRulesSettingsProps> = ({
  filterRules,
  onChange,
}) => {
  const [showBlacklistHelp, setShowBlacklistHelp] = useState(false);
  const [showWhitelistHelp, setShowWhitelistHelp] = useState(false);

  return (
    <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
      <h3 className="font-semibold text-sky-300 mb-2">🚫 Blacklist / ✅ Whititelist</h3>

      {/* Blacklist Section */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium">
            🚫 Blacklist ({filterRules.blacklistTerms.length})
          </label>
          <button onClick={() => setShowBlacklistHelp(!showBlacklistHelp)}>
            {showBlacklistHelp ? 'Skrýt' : 'Zobrazit'} nápovědu
          </button>
        </div>

        {showBlacklistHelp && (
          <div className="mb-3 p-3 bg-slate-800 rounded text-xs">
            <p className="font-semibold mb-1">Jak funguje blacklist:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Inzeráty s těmito výrazy budou vyřazeny</li>
              <li>Porovnává se s názvem, popisem i modelem</li>
              <li>Na malých písmenech nezáleží</li>
            </ul>
          </div>
        )}

        <TagInput
          items={filterRules.blacklistTerms}
          onAdd={(term) => onChange({ ...filterRules, blacklistTerms: [...filterRules.blacklistTerms, term] })}
          onRemove={(term) => onChange({ ...filterRules, blacklistTerms: filterRules.blacklistTerms.filter(t => t !== term) })}
          placeholder="Přidat výraz..."
          icon="🚫"
          color="rose"
        />
      </div>

      {/* Whitelist Section */}
      <div className="border-t border-slate-700 pt-4">
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium">
            ✅ Whititelist ({filterRules.whitelistModels.length})
          </label>
          <button onClick={() => setShowWhitelistHelp(!showWhitelistHelp)}>
            {showWhitelistHelp ? 'Skrýt' : 'Zobrazit'} nápovědu
          </button>
        </div>

        {showWhitelistHelp && (
          <div className="mb-3 p-3 bg-slate-800 rounded text-xs">
            <p className="font-semibold mb-1">Jak funguje whitelist:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Pokud je vyplněn, zahrne pouze tyto modely</li>
              <li>Prázdný whitelist = všechny modely povoleny</li>
            </ul>
          </div>
        )}

        <TagInput
          items={filterRules.whitelistModels}
          onAdd={(model) => onChange({ ...filterRules, whitelistModels: [...filterRules.whitelistModels, model] })}
          onRemove={(model) => onChange({ ...filterRules, whitelistModels: filterRules.whitelistModels.filter(m => m !== model) })}
          placeholder="Přidat model..."
          icon="✅"
          color="emerald"
        />
      </div>
    </div>
  );
};
```

---

### 6. `components/common/TagInput.tsx` (Nová komponenta)
**Responsibility**: Opakovaně použitelný input pro tagy

```typescript
import React, { useState, KeyboardEvent } from 'react';

interface TagInputProps {
  items: string[];
  onAdd: (item: string) => void;
  onRemove: (item: string) => void;
  placeholder?: string;
  icon?: string;
  color?: 'rose' | 'emerald' | 'sky' | 'amber';
  maxItems?: number;
}

export const TagInput: React.FC<TagInputProps> = ({
  items,
  onAdd,
  onRemove,
  placeholder = 'Přidat...',
  icon,
  color = 'sky',
  maxItems,
}) => {
  const [input, setInput] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = input.trim().toLowerCase();
      if (trimmed && !items.includes(trimmed)) {
        if (!maxItems || items.length < maxItems) {
          onAdd(trimmed);
        }
      }
      setInput('');
    }
  };

  const colorClasses = {
    rose: 'bg-rose-900/50 border-rose-700 text-rose-300',
    emerald: 'bg-emerald-900/50 border-emerald-700 text-emerald-300',
    sky: 'bg-sky-900/50 border-sky-700 text-sky-300',
    amber: 'bg-amber-900/50 border-amber-700 text-amber-300',
  };

  return (
    <div>
      <div className="flex gap-2 mb-2 flex-wrap">
        {items.map((item) => (
          <span
            key={item}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border ${colorClasses[color]}`}
          >
            {icon && <span>{icon}</span>}
            {item}
            <button
              onClick={() => onRemove(item)}
              className="hover:text-white"
              title="Odstranit"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-slate-700 border border-slate-600 rounded p-2 text-sm"
          placeholder={placeholder}
        />
        <button
          onClick={() => {
            const trimmed = input.trim().toLowerCase();
            if (trimmed && !items.includes(trimmed)) {
              onAdd(trimmed);
            }
            setInput('');
          }}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded text-sm"
        >
          Přidat
        </button>
      </div>

      <input
        value={items.join(', ')}
        onChange={(e) => {
          // Bulk import from comma-separated text
          const imported = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
          imported.forEach(item => {
            if (!items.includes(item.toLowerCase())) {
              onAdd(item.toLowerCase());
            }
          });
        }}
        className="w-full mt-2 bg-slate-700 border border-slate-600 rounded p-2 text-xs text-slate-400"
        placeholder="Nebo hromadně oddělené čárkou..."
      />
    </div>
  );
};
```

---

### 7. `components/Settings/PriceFilters.tsx` (Nová komponenta)

```typescript
import React from 'react';

interface PriceFiltersProps {
  minPrice: number | null;
  maxPrice: number | null;
  minStorageGb: number | null;
  onMinPriceChange: (value: number | null) => void;
  onMaxPriceChange: (value: number | null) => void;
  onMinStorageChange: (value: number | null) => void;
}

export const PriceFilters: React.FC<PriceFiltersProps> = ({
  minPrice,
  maxPrice,
  minStorageGb,
  onMinPriceChange,
  onMaxPriceChange,
  onMinStorageChange,
}) => {
  return (
    <div className="border-t border-slate-700 pt-4 mt-4">
      <label className="block text-sm text-slate-300 mb-2">💰 Cenové filtry a úložiště</label>
      
      <div className="grid grid-cols-3 gap-2">
        <div>
          <span className="text-xs text-slate-400">Min cena (Kč)</span>
          <input
            type="number"
            value={minPrice ?? ''}
            onChange={(e) => onMinPriceChange(e.target.value ? Number(e.target.value) : null)}
            className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm"
            placeholder="0"
          />
        </div>
        
        <div>
          <span className="text-xs text-slate-400">Max cena (Kč)</span>
          <input
            type="number"
            value={maxPrice ?? ''}
            onChange={(e) => onMaxPriceChange(e.target.value ? Number(e.target.value) : null)}
            className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm"
            placeholder="50000"
          />
        </div>
        
        <div>
          <span className="text-xs text-slate-400">Min úložiště (GB)</span>
          <input
            type="number"
            value={minStorageGb ?? ''}
            onChange={(e) => onMinStorageChange(e.target.value ? Number(e.target.value) : null)}
            className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm"
            placeholder="128"
          />
        </div>
      </div>
    </div>
  );
};
```

---

### 8. `components/Settings/DatabaseSettings.tsx` (Nová komponenta)

```typescript
import React from 'react';

interface DatabaseSettingsProps {
  usePostgres: boolean;
  useProxy: boolean;
  postgresUrl: string;
  proxyPool: string;
  onUsePostgresChange: (value: boolean) => void;
  onUseProxyChange: (value: boolean) => void;
  onPostgresUrlChange: (value: string) => void;
  onProxyPoolChange: (value: string) => void;
  onClearDatabase: () => Promise<void>;
  isClearing: boolean;
}

export const DatabaseSettings: React.FC<DatabaseSettingsProps> = ({
  usePostgres,
  useProxy,
  postgresUrl,
  proxyPool,
  onUsePostgresChange,
  onUseProxyChange,
  onPostgresUrlChange,
  onProxyPoolChange,
  onClearDatabase,
  isClearing,
}) => {
  return (
    <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
      <h3 className="font-semibold text-sky-300 mb-2">Databáze / Proxy</h3>
      
      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={usePostgres}
          onChange={(e) => onUsePostgresChange(e.target.checked)}
        />
        Použít PostgreSQL
      </label>
      
      {usePostgres && (
        <input
          value={postgresUrl}
          onChange={(e) => onPostgresUrlChange(e.target.value)}
          className="mt-2 w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm"
          placeholder="postgresql://user:pass@localhost:5432/db"
        />
      )}

      <label className="inline-flex items-center gap-2 text-sm mt-3">
        <input
          type="checkbox"
          checked={useProxy}
          onChange={(e) => onUseProxyChange(e.target.checked)}
        />
        Použít proxy pool
      </label>
      
      {useProxy && (
        <textarea
          value={proxyPool}
          onChange={(e) => onProxyPoolChange(e.target.value)}
          rows={3}
          className="mt-2 w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm"
          placeholder="http://proxy1:8080,http://proxy2:8080"
        />
      )}

      <button
        onClick={onClearDatabase}
        disabled={isClearing}
        className="mt-4 bg-rose-700 hover:bg-rose-800 disabled:bg-rose-900 text-white text-sm font-semibold py-2 px-3 rounded"
      >
        {isClearing ? 'Mažu...' : 'Vymazat databázi'}
      </button>
    </div>
  );
};
```

---

## 🔄 Změny v importech

### Původní `SettingsPage.tsx`:
```typescript
// Všechno v jedné komponentě (452 řádků)
const SettingsPage = ({ config, onSave, onClearDatabase }) => {
  // Všechna logika uvnitř
};
```

### Nový `SettingsPage.tsx`:
```typescript
import { useSettingsForm } from '../hooks/useSettingsForm';
import { useFilterRules } from '../hooks/useFilterRules';
import { ScrapingSettings } from './Settings/ScrapingSettings';
import { FilterRulesSettings } from './Settings/FilterRulesSettings';
import { PriceFilters } from './Settings/PriceFilters';
import { OllamaSettings } from './Settings/OllamaSettings';
import { SignatureSettings } from './Settings/SignatureSettings';
import { DatabaseSettings } from './Settings/DatabaseSettings';
import { PlatformSelector } from '../components/PlatformSelector';
import { EnvSnippet } from './Settings/EnvSnippet';

const SettingsPage = ({ config, onSave, onClearDatabase }) => {
  const { draft, signature, ...formState } = useSettingsForm(config);
  const { filterRules, ...filterActions } = useFilterRules(draft.filterRules);

  const handleSave = async () => {
    formState.saveToLocalStorage();
    await onSave({ ...draft, filterRules });
  };

  return (
    <section>
      <h2>Nastavení aplikace</h2>
      
      <PlatformSelector
        enabledPlatforms={draft.enabledPlatforms || ['bazos_cz']}
        onTogglePlatform={(source, enabled) => {
          // Update platforms
        }}
      />

      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <ScrapingSettings
            stopOnKnownAd={draft.scrapingOptions?.stopOnKnownAd}
            maxAdsPerTypePerBrand={draft.scrapingOptions?.maxAdsPerTypePerBrand}
            onStopOnKnownAdChange={...}
            onMaxAdsChange={...}
          />
          
          <FilterRulesSettings
            filterRules={filterRules}
            onChange={filterActions.updateRules}
          />
          
          <PriceFilters
            minPrice={filterRules.minPrice}
            maxPrice={filterRules.maxPrice}
            minStorageGb={filterRules.minStorageGb}
            onMinPriceChange={...}
            onMaxPriceChange={...}
            onMinStorageChange={...}
          />
        </div>

        <div>
          <OllamaSettings
            ollamaUrl={formState.ollamaUrl}
            ollamaModel={draft.ollamaModel}
            onUrlChange={formState.setOllamaUrl}
            onModelChange={...}
          />
          
          <SignatureSettings
            signature={signature}
            onChange={formState.setSignature}
          />
          
          <DatabaseSettings
            usePostgres={formState.usePostgres}
            useProxy={formState.useProxy}
            postgresUrl={formState.postgresUrl}
            proxyPool={formState.proxyPool}
            onUsePostgresChange={formState.setUsePostgres}
            onUseProxyChange={formState.setUseProxy}
            onPostgresUrlChange={formState.setPostgresUrl}
            onProxyPoolChange={formState.setProxyPool}
            onClearDatabase={onClearDatabase}
            isClearing={isClearingDb}
          />
        </div>
      </div>

      <EnvSnippet config={draft} />
      
      <button onClick={handleSave}>Uložit</button>
    </section>
  );
};
```

---

## 📅 Fáze refaktorování

### Fáze 1: Hooks (1 den)
- [ ] `useSettingsForm.ts`
- [ ] `useFilterRules.ts`

### Fáze 2: Common komponenty (0.5 dne)
- [ ] `TagInput.tsx`

### Fáze 3: Settings komponenty (2 dny)
- [ ] `ScrapingSettings.tsx`
- [ ] `FilterRulesSettings.tsx`
- [ ] `PriceFilters.tsx`
- [ ] `OllamaSettings.tsx`
- [ ] `SignatureSettings.tsx`
- [ ] `DatabaseSettings.tsx`
- [ ] `EnvSnippet.tsx`

### Fáze 4: Integrace (0.5 dne)
- [ ] Přepsat `SettingsPage.tsx`
- [ ] Otestovat všechny sekce
- [ ] Odstranit původní kód

---

## ✅ Výhody po refaktorování

1. **Velikost** - Žádná komponenta > 150 řádků
2. **Znovupoužitelnost** - TagInput lze použít jinde
3. **Testovatelnost** - Každou sekci lze testovat zvlášť
4. **Údržba** - Snadné přidávat nové sekce
5. **Čitelnost** - Jasná struktura a odpovědnosti

---

*Vygenerováno: 2026-03-16*
*Autor: Autonomous Lead Fullstack Developer*
