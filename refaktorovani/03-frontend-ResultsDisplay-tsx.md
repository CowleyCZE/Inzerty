# Plán refaktorování: components/ResultsDisplay.tsx

## 📊 Stav

- **Počet řádků**: 1121
- **Hlavní zodpovědnosti**:
  - Zobrazení matchů (arbitrážních příležitostí)
  - Filtrace a řazení
  - Stavová logika (status, priority, follow-up)
  - Due Diligence Checklist
  - Šablony zpráv (Bazoš/SMS/E-mail)
  - AI message generation
  - Bulk actions
  - Export CSV/Google Sheets
  - Alerts konfigurace
  - Douplication (seen matches)

## ⚠️ Problémy

1. **Extrémní velikost** - 1121 řádků v jedné komponentě
2. **Míchání concernů** - UI + business logic + API volání
3. **Žádná separace stavu** - Všechno v jednom `useState`
4. **Duplicitní kód** - Šablony zpráv pro různé kanály
5. **Těžké testování** - Nelze izolovat logiku

## 📋 Navrhované rozdělení

### 1. `hooks/useMatchFilters.ts` (Nový hook)
**Responsibility**: Filtrace a řazení matchů

```typescript
import { useState, useMemo } from 'react';
import { MatchItem, MatchMeta } from '../types';

interface UseMatchFiltersOptions {
  matches: MatchItem[];
  metaByMatch: Record<string, MatchMeta>;
  previouslySeenKeys: Set<string>;
}

export const useMatchFilters = ({
  matches,
  metaByMatch,
  previouslySeenKeys,
}: UseMatchFiltersOptions) => {
  const [minProfit, setMinProfit] = useState(0);
  const [sortBy, setSortBy] = useState<'profit' | 'opportunity'>('opportunity');
  const [hideResolved, setHideResolved] = useState(true);
  const [hidePreviouslySeen, setHidePreviouslySeen] = useState(false);

  const filteredMatches = useMemo(() => {
    let list = matches
      .filter((match) => (match.arbitrageScore || 0) >= minProfit)
      .filter((match) => {
        if (!hideResolved) return true;
        const meta = metaByMatch[getMatchKey(match.offer, match.demand)] || defaultMeta();
        return !meta.resolved;
      });

    if (hidePreviouslySeen) {
      list = list.filter((match) => !previouslySeenKeys.has(getMatchKey(match.offer, match.demand)));
    }

    return [...list].sort((a, b) => {
      if (sortBy === 'profit') return (b.arbitrageScore || 0) - (a.arbitrageScore || 0);
      return (b.realOpportunityScore || 0) - (a.realOpportunityScore || 0);
    });
  }, [matches, minProfit, sortBy, hideResolved, hidePreviouslySeen, metaByMatch, previouslySeenKeys]);

  return {
    filteredMatches,
    minProfit,
    setMinProfit,
    sortBy,
    setSortBy,
    hideResolved,
    setHideResolved,
    hidePreviouslySeen,
    setHidePreviouslySeen,
  };
};
```

---

### 2. `hooks/useMatchMeta.ts` (Nový hook)
**Responsibility**: Správa metadat pro matche

```typescript
import { useState, useEffect } from 'react';
import { MatchMeta, MatchStatus, MatchPriority, DueDiligenceChecklist } from '../types';

const STORAGE_KEY = 'inzerty_match_meta_v2';

export const useMatchMeta = () => {
  const [metaByMatch, setMetaByMatch] = useState<Record<string, MatchMeta>>({});

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setMetaByMatch(JSON.parse(raw));
      } catch {
        setMetaByMatch({});
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(metaByMatch));
  }, [metaByMatch]);

  const updateMatchMeta = async (matchKey: string, patch: Partial<MatchMeta>) => {
    const next = {
      ...defaultMeta(),
      ...(metaByMatch[matchKey] || {}),
      ...patch,
      lastActionAt: new Date().toISOString(),
    };
    setMetaByMatch((prev) => ({ ...prev, [matchKey]: next }));
    
    // Sync with backend
    await fetch('http://localhost:3001/match-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchKey, ...next }),
    });
  };

  const updateStatus = (matchKey: string, status: MatchStatus) =>
    updateMatchMeta(matchKey, { status });

  const updatePriority = (matchKey: string, priority: MatchPriority) =>
    updateMatchMeta(matchKey, { priority });

  const updateChecklist = (matchKey: string, checklist: Partial<DueDiligenceChecklist>) =>
    updateMatchMeta(matchKey, { 
      checklist: { ...metaByMatch[matchKey]?.checklist, ...checklist } 
    });

  const toggleResolved = (matchKey: string) =>
    updateMatchMeta(matchKey, { resolved: !metaByMatch[matchKey]?.resolved });

  return {
    metaByMatch,
    updateMatchMeta,
    updateStatus,
    updatePriority,
    updateChecklist,
    toggleResolved,
  };
};
```

---

### 3. `hooks/useBulkActions.ts` (Nový hook)
**Responsibility**: Hromadné akce

```typescript
import { useState } from 'react';

export const useBulkActions = () => {
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  const toggleSelectMatch = (matchKey: string) => {
    setSelectedMatches((prev) => {
      const next = new Set(prev);
      if (next.has(matchKey)) {
        next.delete(matchKey);
      } else {
        next.add(matchKey);
      }
      return next;
    });
  };

  const selectAll = (matchKeys: string[]) => {
    matchKeys.forEach((key) => {
      setSelectedMatches((prev) => new Set(prev).add(key));
    });
  };

  const clearSelection = () => {
    setSelectedMatches(new Set());
  };

  const bulkUpdate = async (updates: Record<string, any>) => {
    const response = await fetch('http://localhost:3001/matches/bulk-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        matchKeys: Array.from(selectedMatches), 
        updates 
      }),
    });
    clearSelection();
    return response.json();
  };

  const bulkMarkAsResolved = () => bulkUpdate({ resolved: true });
  const bulkMarkAsContacted = () => bulkUpdate({ status: 'contacted' });

  return {
    selectedMatches,
    selectedCount: selectedMatches.size,
    showBulkActions,
    setShowBulkActions,
    toggleSelectMatch,
    selectAll,
    clearSelection,
    bulkMarkAsResolved,
    bulkMarkAsContacted,
  };
};
```

---

### 4. `components/MatchCard/` (Nová složka)
**Responsibility**: Karta jednotlivého matche

```
MatchCard/
├── MatchCard.tsx           # Hlavní komponenta
├── MatchCardHeader.tsx     # Header se statusem a prioritou
├── MatchCardDetails.tsx    # Detaily nabídky a poptávky
├── MatchCardControls.tsx   # Selectory pro status/priority
├── MatchCardFollowUp.tsx   # Follow-up nastavení
├── DueDiligenceChecklist.tsx # Checklist komponenta
├── MatchActions.tsx        # Akční tlačítka
└── index.ts                # Exporty
```

**Příklad** (`MatchCard.tsx`):
```typescript
import { MatchItem, MatchMeta } from '../../types';
import { MatchCardHeader } from './MatchCardHeader';
import { MatchCardDetails } from './MatchCardDetails';
import { MatchCardControls } from './MatchCardControls';
import { DueDiligenceChecklist } from './DueDiligenceChecklist';
import { MatchActions } from './MatchActions';

interface MatchCardProps {
  match: MatchItem;
  meta: MatchMeta;
  isSelected: boolean;
  onSelect: (matchKey: string) => void;
  onStatusChange: (matchKey: string, status: any) => void;
  onPriorityChange: (matchKey: string, priority: any) => void;
  onChecklistChange: (matchKey: string, checklist: any) => void;
  onRunAutomation: (match: MatchItem) => void;
}

export const MatchCard: React.FC<MatchCardProps> = ({
  match,
  meta,
  isSelected,
  onSelect,
  onStatusChange,
  onPriorityChange,
  onChecklistChange,
  onRunAutomation,
}) => {
  const matchKey = `${match.offer.url}__${match.demand.url}`;

  return (
    <div className="bg-slate-700/50 rounded-xl p-5 border border-slate-600">
      <MatchCardHeader
        match={match}
        meta={meta}
        isSelected={isSelected}
        onSelect={() => onSelect(matchKey)}
      />
      <MatchCardDetails match={match} />
      <MatchCardControls
        meta={meta}
        onStatusChange={(status) => onStatusChange(matchKey, status)}
        onPriorityChange={(priority) => onPriorityChange(matchKey, priority)}
      />
      <DueDiligenceChecklist
        checklist={meta.checklist}
        onChange={(checklist) => onChecklistChange(matchKey, checklist)}
      />
      <MatchActions
        match={match}
        meta={meta}
        onRunAutomation={() => onRunAutomation(match)}
      />
    </div>
  );
};
```

---

### 5. `components/MatchFilters/` (Nová složka)
**Responsibility**: Filtrační ovládací prvky

```
MatchFilters/
├── MatchFilters.tsx        # Hlavní kontejner
├── MinProfitInput.tsx      # Input pro minimální zisk
├── SortSelect.tsx          # Select pro řazení
├── HideResolvedToggle.tsx  # Toggle pro vyřešené
├── HideSeenToggle.tsx      # Toggle pro dříve zobrazené
└── index.ts
```

---

### 6. `components/MatchList/` (Nová složka)
**Responsibility**: Seznam matchů s bulk actions

```
MatchList/
├── MatchList.tsx           # Hlavní seznam
├── MatchListHeader.tsx     # Header s "Označit všechny"
├── BulkActionsPanel.tsx    # Panel hromadných akcí
├── SelectionInfo.tsx       # Informace o výběru
└── index.ts
```

---

### 7. `components/ExportPanel/` (Nová složka)
**Responsibility**: Export funkcionalita

```
ExportPanel/
├── ExportPanel.tsx         # Hlavní panel
├── CsvExportButton.tsx     # CSV export tlačítko
├── GoogleSheetsPanel.tsx   # Google Sheets konfigurace
├── DailyReportButton.tsx   # Denní report
└── index.ts
```

---

### 8. `components/AlertsPanel/` (Nová složka)
**Responsibility**: Alerts konfigurace

```
AlertsPanel/
├── AlertsPanel.tsx         # Hlavní panel
├── TelegramConfig.tsx      # Telegram nastavení
├── EmailConfig.tsx         # Email nastavení
├── DiscordConfig.tsx       # Discord nastavení
├── AlertFilters.tsx        # Filtry pro alerty
└── index.ts
```

---

### 9. `services/messageTemplates.ts` (Nový soubor)
**Responsibility**: Šablony zpráv

```typescript
import { MatchItem } from '../types';

interface MessageTemplate {
  subject?: string;
  text: string;
}

export const createSellerMessage = (
  match: MatchItem,
  channel: 'bazos' | 'sms' | 'email',
  signature: string
): MessageTemplate => {
  const { offer, demand } = match;

  if (channel === 'email') {
    return {
      subject: `${demand.title} - nabídka k prodeji`,
      text: `Dobrý den,\n\nnarazil jsem na Váš inzerát "${demand.title}"...\n\nHezký den,\n${signature}`,
    };
  }

  if (channel === 'sms') {
    const text = `Dobrý den, mám ${offer.title} za ${offer.price}. Máte zájem? Děkuji, ${signature}`;
    return {
      text: text.length > 160 ? text.substring(0, 157) + '...' : text,
    };
  }

  return {
    text: `Dobrý den,\n\nmám ${offer.title} za ${offer.price}.\n\nHezký den, ${signature}`,
  };
};

export const createBuyerMessage = (/* ... */): MessageTemplate => {
  // ...
};

export const generateAIMessage = async (/* ... */): Promise<string | null> => {
  // AI message generation logic
};
```

---

### 10. `services/automation.service.ts` (Nový soubor)
**Responsibility**: Autonomous process logic

```typescript
import { MatchItem } from '../types';

export interface AutomationResult {
  step: string;
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export const runAutonomousProcess = async (match: MatchItem): Promise<{
  results: AutomationResult[];
  summary: {
    total: number;
    success: number;
    failed: number;
  };
}> => {
  const matchKey = `${match.offer.url}__${match.demand.url}`;

  const response = await fetch(`http://localhost:3001/automation/run-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      matchKey,
      match: {
        offer: { title: match.offer.title, price: match.offer.price, ... },
        demand: { title: match.demand.title, price: match.demand.price, ... },
        arbitrageScore: match.arbitrageScore,
        similarityScore: match.similarity,
      },
    }),
  });

  return response.json();
};
```

---

## 🔄 Změny v importech

### Původní `ResultsDisplay.tsx`:
```typescript
// Všechno v jedné komponentě
const ResultsDisplay = ({ matchedAds }) => {
  // 1121 řádků kódu
};
```

### Nový `ResultsDisplay.tsx`:
```typescript
import { useMatchFilters } from '../hooks/useMatchFilters';
import { useMatchMeta } from '../hooks/useMatchMeta';
import { useBulkActions } from '../hooks/useBulkActions';
import { MatchCard } from '../components/MatchCard';
import { MatchFilters } from '../components/MatchFilters';
import { MatchList } from '../components/MatchList';
import { ExportPanel } from '../components/ExportPanel';
import { AlertsPanel } from '../components/AlertsPanel';
import { runAutonomousProcess } from '../services/automation.service';

const ResultsDisplay = ({ matchedAds }) => {
  const { metaByMatch, updateStatus, updatePriority, updateChecklist } = useMatchMeta();
  const { filteredMatches, ...filters } = useMatchFilters({ matches: matchedAds, metaByMatch, ... });
  const { selectedMatches, ...bulkActions } = useBulkActions();

  const handleRunAutomation = async (match: MatchItem) => {
    const result = await runAutonomousProcess(match);
    // Handle result
  };

  return (
    <div>
      <MatchFilters {...filters} />
      <ExportPanel matches={filteredMatches} />
      <AlertsPanel />
      <MatchList
        matches={filteredMatches}
        selectedMatches={selectedMatches}
        {...bulkActions}
      >
        {filteredMatches.map((match) => (
          <MatchCard
            key={getMatchKey(match.offer, match.demand)}
            match={match}
            meta={metaByMatch[getMatchKey(match.offer, match.demand)]}
            {...}
          />
        ))}
      </MatchList>
    </div>
  );
};
```

---

## 📅 Fáze refaktorování

### Fáze 1: Hooks (2 dny)
- [ ] `useMatchFilters.ts`
- [ ] `useMatchMeta.ts`
- [ ] `useBulkActions.ts`
- [ ] `usePreviouslySeen.ts`

### Fáze 2: MatchCard komponenty (2-3 dny)
- [ ] `MatchCard.tsx`
- [ ] `MatchCardHeader.tsx`
- [ ] `MatchCardDetails.tsx`
- [ ] `MatchCardControls.tsx`
- [ ] `DueDiligenceChecklist.tsx`
- [ ] `MatchActions.tsx`

### Fáze 3: Ostatní komponenty (2 dny)
- [ ] `MatchFilters/`
- [ ] `MatchList/`
- [ ] `ExportPanel/`
- [ ] `AlertsPanel/`

### Fáze 4: Services (1 den)
- [ ] `messageTemplates.ts`
- [ ] `automation.service.ts`

### Fáze 5: Integrace (1 den)
- [ ] Přepsat `ResultsDisplay.tsx`
- [ ] Otestovat všechny funkce
- [ ] Odstranit původní kód

---

## ✅ Výhody po refaktorování

1. **Velikost** - Žádná komponenta > 200 řádků
2. **Znovupoužitelnost** - Hooks a komponenty lze použít jinde
3. **Testovatelnost** - Lze testovat každý hook/komponentu zvlášť
4. **Čitelnost** - Jasná struktura a odpovědnosti
5. **Údržba** - Snadné přidávat nové features
6. **Performance** - Memoized hooks optimalizují renderování

---

*Vygenerováno: 2026-03-16*
*Autor: Autonomous Lead Fullstack Developer*
