# Plán refaktorování: App.tsx

## 📊 Stav

- **Počet řádků**: 466
- **Hlavní zodpovědnosti**:
  - Hlavní stav aplikace (ads, matches, config)
  - Navigace mezi view (dashboard, calendar, settings, automation, conversations)
  - Scraping orchestration
  - Comparison orchestration
  - Ollama toggle management
  - Settings persistence
  - Alerts config management
  - Runtime logs polling

## ⚠️ Problémy

1. **Míchání concernů** - Stav + API volání + navigace
2. **Žádná abstrakce** - Všechno v hlavním komponentu
3. **Opakující se logika** - Error handling pro každý endpoint
4. **Těžké testování** - Nelze izolovat jednotlivé funkce
5. **Prop drilling** - Předávání props do hluboké komponenty

## 📋 Navrhované rozdělení

### 1. `hooks/useAppState.ts` (Nový hook)
**Responsibility**: Hlavní stav aplikace

```typescript
import { useState, useCallback } from 'react';
import { Ad, MatchItem, Config, ScrapeSummaryData } from '../types';

type AppStateType = 'idle' | 'scraping' | 'scraping-done' | 'comparing' | 'comparing-done';

interface UseAppStateResult {
  ads: Ad[];
  matchedAds: MatchItem[];
  appState: AppStateType;
  isScraping: boolean;
  isComparing: boolean;
  scrapeSummary: ScrapeSummaryData | null;
  lastScrapeDuration: number | null;
  setAds: (ads: Ad[]) => void;
  setMatchedAds: (matches: MatchItem[]) => void;
  setAppState: (state: AppStateType) => void;
  setScrapeSummary: (summary: ScrapeSummaryData | null) => void;
  resetState: () => void;
}

export const useAppState = (): UseAppStateResult => {
  const [ads, setAds] = useState<Ad[]>([]);
  const [matchedAds, setMatchedAds] = useState<MatchItem[]>([]);
  const [appState, setAppState] = useState<AppStateType>('idle');
  const [scrapeSummary, setScrapeSummary] = useState<ScrapeSummaryData | null>(null);
  const [lastScrapeDuration, setLastScrapeDuration] = useState<number | null>(null);

  const isScraping = appState === 'scraping';
  const isComparing = appState === 'comparing';

  const resetState = () => {
    setAds([]);
    setMatchedAds([]);
    setAppState('idle');
    setScrapeSummary(null);
    setLastScrapeDuration(null);
  };

  return {
    ads,
    matchedAds,
    appState,
    isScraping,
    isComparing,
    scrapeSummary,
    lastScrapeDuration,
    setAds,
    setMatchedAds,
    setAppState,
    setScrapeSummary,
    resetState,
  };
};
```

---

### 2. `hooks/useScraping.ts` (Nový hook)
**Responsibility**: Scraping logika

```typescript
import { useCallback, useState } from 'react';
import { Config, ScrapeSummaryData } from '../types';

interface UseScrapingResult {
  isScraping: boolean;
  progress: string;
  startScraping: (config: Config) => Promise<void>;
  compareStoredAds: (config: Config) => Promise<void>;
  lastScrapeDuration: number | null;
}

export const useScraping = (
  onAdsLoaded: (ads: Ad[]) => void,
  onSummaryLoaded: (summary: ScrapeSummaryData) => void,
  onError: (message: string) => void
): UseScrapingResult => {
  const [isScraping, setIsScraping] = useState(false);
  const [progress, setProgress] = useState('');
  const [lastScrapeDuration, setLastScrapeDuration] = useState<number | null>(null);

  const startScraping = useCallback(async (config: Config) => {
    setIsScraping(true);
    setProgress('Spouštím proces scrapování...');
    const startTime = performance.now();

    try {
      // Check backend status
      const statusRes = await fetch('http://localhost:3001/ollama/status', {
        signal: AbortSignal.timeout(5000),
      });
      if (!statusRes.ok) {
        throw new Error('Backend server neběží');
      }

      const response = await fetch('http://localhost:3001/scrape-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectors: config.selectors,
          scrapingOptions: config.scrapingOptions || {
            stopOnKnownAd: true,
            maxAdsPerTypePerBrand: 50,
          },
          enabledPlatforms: config.enabledPlatforms,
        }),
        signal: AbortSignal.timeout(600000),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      const result = await response.json();
      onAdsLoaded(result.data.ads || []);
      onSummaryLoaded({
        nabidka: result.data.nabidkaCount,
        poptavka: result.data.poptavkaCount,
        savedNabidka: result.data.savedNabidkaCount,
        savedPoptavka: result.data.savedPoptavkaCount,
        healthWarning: result.data.healthWarning || '',
      });
      setProgress('Scrapování dokončeno. Připraveno k porovnání.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Neznámá chyba';
      onError(`Scrapování selhalo: ${message}`);
    } finally {
      setIsScraping(false);
      setLastScrapeDuration((performance.now() - startTime) / 1000);
    }
  }, [onAdsLoaded, onSummaryLoaded, onError]);

  const compareStoredAds = useCallback(async (config: Config) => {
    // Similar structure for comparison
  }, []);

  return {
    isScraping,
    progress,
    startScraping,
    compareStoredAds,
    lastScrapeDuration,
  };
};
```

---

### 3. `hooks/useComparison.ts` (Nový hook)
**Responsibility**: Comparison logika

```typescript
import { useCallback, useState } from 'react';
import { Config, MatchItem } from '../types';

interface UseComparisonResult {
  isComparing: boolean;
  progress: string;
  startComparison: (matchedAds: MatchItem[], config: Config) => Promise<void>;
}

export const useComparison = (
  onMatchesLoaded: (matches: MatchItem[]) => void,
  onError: (message: string) => void
): UseComparisonResult => {
  const [isComparing, setIsComparing] = useState(false);
  const [progress, setProgress] = useState('');

  const startComparison = useCallback(async (config: Config) => {
    setIsComparing(true);
    setProgress('Spouštím porovnávání...');

    try {
      const response = await fetch('http://localhost:3001/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comparisonMethod: config.comparisonMethod || 'auto',
          filterRules: config.filterRules || {
            blacklistTerms: [],
            whitelistModels: [],
            minPrice: null,
            maxPrice: null,
            minStorageGb: null,
          },
          hideResolved: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      const result = await response.json();
      onMatchesLoaded(result.data);
      setProgress(`Porovnání dokončeno. Nalezeno ${result.data.length} shod.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Neznámá chyba';
      onError(`Porovnávání selhalo: ${message}`);
    } finally {
      setIsComparing(false);
    }
  }, [onMatchesLoaded, onError]);

  return {
    isComparing,
    progress,
    startComparison,
  };
};
```

---

### 4. `hooks/useOllama.ts` (Nový hook)
**Responsibility**: Ollama management

```typescript
import { useState, useCallback } from 'react';

interface UseOllamaResult {
  ollamaActive: boolean;
  isToggling: boolean;
  toggleOllama: () => Promise<void>;
  refreshStatus: () => Promise<boolean>;
}

export const useOllama = (): UseOllamaResult => {
  const [ollamaActive, setOllamaActive] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const refreshStatus = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('http://localhost:3001/ollama/status');
      const data = await res.json();
      setOllamaActive(Boolean(data.status));
      return Boolean(data.status);
    } catch {
      return false;
    }
  }, []);

  const toggleOllama = useCallback(async () => {
    setIsToggling(true);
    const action = ollamaActive ? 'stop' : 'start';

    try {
      const res = await fetch('http://localhost:3001/ollama/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message);
      }

      const verifiedStatus = await refreshStatus();
      setOllamaActive(verifiedStatus);
    } catch (error) {
      console.error('Toggle Ollama failed:', error);
    } finally {
      setIsToggling(false);
    }
  }, [ollamaActive, refreshStatus]);

  return {
    ollamaActive,
    isToggling,
    toggleOllama,
    refreshStatus,
  };
};
```

---

### 5. `hooks/useSettings.ts` (Nový hook)
**Responsibility**: Settings persistence

```typescript
import { useState, useEffect, useCallback } from 'react';
import { Config } from '../types';

const SETTINGS_KEY = 'inzerty_settings_v1';

interface UseSettingsResult {
  config: Config;
  saveSettings: (config: Config) => Promise<void>;
  clearDatabase: () => Promise<void>;
  isLoading: boolean;
}

export const useSettings = (): UseSettingsResult => {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      try {
        setConfig(JSON.parse(raw));
      } catch {
        // ignore
      }
    }
    setIsLoading(false);
  }, []);

  const saveSettings = useCallback(async (nextConfig: Config) => {
    setConfig(nextConfig);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextConfig));

    try {
      const response = await fetch('http://localhost:3001/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ollamaModel: nextConfig.ollamaModel }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message);
      }
    } catch (error) {
      console.error('Failed to sync settings with server:', error);
    }
  }, []);

  const clearDatabase = useCallback(async () => {
    const response = await fetch('http://localhost:3001/database/clear', {
      method: 'POST',
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message);
    }
  }, []);

  return {
    config,
    saveSettings,
    clearDatabase,
    isLoading,
  };
};
```

---

### 6. `hooks/useRuntimeLogs.ts` (Nový hook)
**Responsibility**: Runtime logs polling

```typescript
import { useState, useEffect } from 'react';
import { LogEntry } from '../types';

interface UseRuntimeLogsResult {
  logs: LogEntry[];
  clearLogs: () => void;
}

export const useRuntimeLogs = (intervalMs = 1500): UseRuntimeLogsResult => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    let mounted = true;

    const fetchLogs = async () => {
      try {
        const res = await fetch('http://localhost:3001/logs');
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) {
          setLogs(Array.isArray(data.logs) ? data.logs : []);
        }
      } catch {
        // ignore
      }
    };

    fetchLogs();
    const timer = setInterval(fetchLogs, intervalMs);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [intervalMs]);

  const clearLogs = () => {
    fetch('http://localhost:3001/logs/clear', { method: 'POST' });
    setLogs([]);
  };

  return {
    logs,
    clearLogs,
  };
};
```

---

### 7. `components/Layout/` (Nová složka)
**Responsibility**: Layout komponenty

```
Layout/
├── AppLayout.tsx           # Hlavní layout
├── Header.tsx              # Header (přejmenovat z existing)
├── Navigation.tsx          # Navigační tlačítka
├── Footer.tsx              # Footer
└── index.ts
```

---

### 8. `components/views/` (Nová složka)
**Responsibility**: Jednotlivé view komponenty

```
views/
├── DashboardView.tsx       # Hlavní dashboard
├── AutomationView.tsx      # Automation Controls
├── ConversationsView.tsx   # Conversation Dashboard
├── CalendarView.tsx        # FollowUp Calendar
├── SettingsView.tsx        # Settings Page
└── index.ts
```

---

## 🔄 Změny v importech

### Původní `App.tsx`:
```typescript
// Všechno v App komponentě
const App = () => {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [ads, setAds] = useState([]);
  const [matchedAds, setMatchedAds] = useState([]);
  // ... 466 řádků
};
```

### Nový `App.tsx`:
```typescript
import { useAppState } from './hooks/useAppState';
import { useScraping } from './hooks/useScraping';
import { useComparison } from './hooks/useComparison';
import { useOllama } from './hooks/useOllama';
import { useSettings } from './hooks/useSettings';
import { useRuntimeLogs } from './hooks/useRuntimeLogs';
import { AppLayout } from './components/Layout';
import { DashboardView } from './components/views/DashboardView';
import { AutomationView } from './components/views/AutomationView';
import { ConversationsView } from './components/views/ConversationsView';
import { CalendarView } from './components/views/CalendarView';
import { SettingsView } from './components/views/SettingsView';

const App = () => {
  const { ads, matchedAds, appState, ...stateActions } = useAppState();
  const { isScraping, startScraping, compareStoredAds } = useScraping(
    stateActions.setAds,
    stateActions.setScrapeSummary,
    // error handler
  );
  const { isComparing, startComparison } = useComparison(
    stateActions.setMatchedAds,
    // error handler
  );
  const { ollamaActive, toggleOllama } = useOllama();
  const { config, saveSettings, clearDatabase } = useSettings();
  const { logs } = useRuntimeLogs();
  const [view, setView] = useState<AppView>('dashboard');

  return (
    <AppLayout>
      {view === 'dashboard' && (
        <DashboardView
          ads={ads}
          matchedAds={matchedAds}
          isScraping={isScraping}
          isComparing={isComparing}
          onStartScraping={() => startScraping(config)}
          onStartComparison={() => startComparison(config)}
          onCompareStored={() => compareStoredAds(config)}
          {...}
        />
      )}
      {view === 'automation' && <AutomationView />}
      {/* ... další view */}
    </AppLayout>
  );
};
```

---

## 📅 Fáze refaktorování

### Fáze 1: Hooks (2 dny)
- [ ] `useAppState.ts`
- [ ] `useScraping.ts`
- [ ] `useComparison.ts`
- [ ] `useOllama.ts`
- [ ] `useSettings.ts`
- [ ] `useRuntimeLogs.ts`

### Fáze 2: Layout komponenty (1 den)
- [ ] `AppLayout.tsx`
- [ ] `Navigation.tsx`
- [ ] `Footer.tsx`

### Fáze 3: Views (2 dny)
- [ ] `DashboardView.tsx`
- [ ] `AutomationView.tsx`
- [ ] `ConversationsView.tsx`
- [ ] `CalendarView.tsx`
- [ ] `SettingsView.tsx`

### Fáze 4: Integrace (1 den)
- [ ] Přepsat `App.tsx`
- [ ] Otestovat všechny view
- [ ] Odstranit původní kód

---

## ✅ Výhody po refaktorování

1. **Velikost** - App.tsx < 100 řádků
2. **Separation of Concerns** - Každý hook má jednu odpovědnost
3. **Testovatelnost** - Lze testovat každý hook zvlášť
4. **Znovupoužitelnost** - Hooks lze použít v jiných komponentách
5. **Čitelnost** - Jasná struktura
6. **Údržba** - Snadné přidávat nové view

---

*Vygenerováno: 2026-03-16*
*Autor: Autonomous Lead Fullstack Developer*
