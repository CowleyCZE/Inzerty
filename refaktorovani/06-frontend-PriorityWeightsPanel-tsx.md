# Plán refaktorování: components/PriorityWeightsPanel.tsx

## 📊 Stav

- **Počet řádků**: 374
- **Hlavní zodpovědnosti**:
  - Nastavení vah pro priority scoring (5 komponent)
  - Profitabilita váha (30%)
  - Důvěryhodnost váha (25%)
  - Urgence váha (20%)
  - Tržní trend váha (15%)
  - Kapacita váha (10%)
  - Validace součtu vah (musí být 100%)
  - Reset na výchozí hodnoty
  - Ukládání do backendu

## ⚠️ Problémy

1. **Komplexní validace** - Logika pro validaci součtu na 100%
2. **Opakující se kód** - 5 sliderů se stejnou strukturou
3. **Stavová logika** - Míchání UI a business logiky
4. **Žádná znovupoužitelnost** - Slider komponenta není extrahována
5. **Těžké testování** - Validace je součástí komponenty

## 📋 Navrhované rozdělení

### 1. `hooks/usePriorityWeights.ts` (Nový hook)
**Responsibility**: Stavová logika pro váhy

```typescript
import { useState, useCallback, useMemo } from 'react';

interface PriorityWeights {
  profitability: number;
  trustworthiness: number;
  urgency: number;
  marketTrend: number;
  capacity: number;
}

const DEFAULT_WEIGHTS: PriorityWeights = {
  profitability: 30,
  trustworthiness: 25,
  urgency: 20,
  marketTrend: 15,
  capacity: 10,
};

interface UsePriorityWeightsResult {
  weights: PriorityWeights;
  totalWeight: number;
  isValid: boolean;
  validationError: string | null;
  updateWeight: (key: keyof PriorityWeights, value: number) => void;
  resetToDefaults: () => void;
  saveWeights: () => Promise<void>;
  isLoading: boolean;
}

export const usePriorityWeights = (): UsePriorityWeightsResult => {
  const [weights, setWeights] = useState<PriorityWeights>(DEFAULT_WEIGHTS);
  const [isLoading, setIsLoading] = useState(false);

  const totalWeight = useMemo(() => {
    return Object.values(weights).reduce((sum, value) => sum + value, 0);
  }, [weights]);

  const isValid = totalWeight === 100;
  const validationError = totalWeight !== 100 
    ? `Součet vah musí být 100%, aktuálně: ${totalWeight}%` 
    : null;

  const updateWeight = useCallback((key: keyof PriorityWeights, value: number) => {
    const clampedValue = Math.max(0, Math.min(100, value));
    setWeights((prev) => ({ ...prev, [key]: clampedValue }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setWeights(DEFAULT_WEIGHTS);
  }, []);

  const saveWeights = useCallback(async () => {
    if (!isValid) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3001/priority/weights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(weights),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save weights');
      }
    } catch (error) {
      console.error('Error saving weights:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [weights, isValid]);

  return {
    weights,
    totalWeight,
    isValid,
    validationError,
    updateWeight,
    resetToDefaults,
    saveWeights,
    isLoading,
  };
};
```

---

### 2. `components/common/WeightSlider.tsx` (Nová komponenta)
**Responsibility**: Opakovaně použitelný slider pro váhy

```typescript
import React from 'react';

interface WeightSliderProps {
  label: string;
  description: string;
  value: number;
  icon: string;
  color: 'sky' | 'emerald' | 'amber' | 'violet' | 'rose';
  onChange: (value: number) => void;
  disabled?: boolean;
}

export const WeightSlider: React.FC<WeightSliderProps> = ({
  label,
  description,
  value,
  icon,
  color,
  onChange,
  disabled = false,
}) => {
  const colorClasses = {
    sky: 'accent-sky-500 text-sky-400',
    emerald: 'accent-emerald-500 text-emerald-400',
    amber: 'accent-amber-500 text-amber-400',
    violet: 'accent-violet-500 text-violet-400',
    rose: 'accent-rose-500 text-rose-400',
  };

  return (
    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <div>
            <h4 className="font-medium text-slate-200">{label}</h4>
            <p className="text-xs text-slate-400">{description}</p>
          </div>
        </div>
        <div className={`text-2xl font-bold ${colorClasses[color]}`}>
          {value}%
        </div>
      </div>

      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className={`w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer ${colorClasses[color]}`}
      />

      <div className="flex justify-between text-xs text-slate-500 mt-1">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  );
};
```

---

### 3. `components/Priority/WeightSummary.tsx` (Nová komponenta)
**Responsibility**: Souhrn vah s validací

```typescript
import React from 'react';

interface WeightSummaryProps {
  total: number;
  isValid: boolean;
  error?: string | null;
}

export const WeightSummary: React.FC<WeightSummaryProps> = ({
  total,
  isValid,
  error,
}) => {
  return (
    <div className={`p-4 rounded-lg border ${
      isValid 
        ? 'bg-emerald-900/20 border-emerald-600' 
        : 'bg-rose-900/20 border-rose-600'
    }`}>
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-slate-200">Součet vah</h4>
          <p className="text-sm text-slate-400">
            Musí být přesně 100%
          </p>
        </div>
        <div className={`text-3xl font-bold ${
          isValid ? 'text-emerald-400' : 'text-rose-400'
        }`}>
          {total}%
        </div>
      </div>

      {!isValid && error && (
        <p className="text-sm text-rose-400 mt-2">
          ⚠️ {error}
        </p>
      )}

      {isValid && (
        <p className="text-sm text-emerald-400 mt-2">
          ✅ Váhy jsou správně nastaveny
        </p>
      )}
    </div>
  );
};
```

---

### 4. `components/Priority/WeightPresets.tsx` (Nová komponenta)
**Responsibility**: Přednastavené konfigurace vah

```typescript
import React from 'react';

interface WeightPreset {
  name: string;
  description: string;
  weights: {
    profitability: number;
    trustworthiness: number;
    urgency: number;
    marketTrend: number;
    capacity: number;
  };
}

const PRESETS: WeightPreset[] = [
  {
    name: 'Vyvážené',
    description: 'Rovnoměrné rozložení pro obecné použití',
    weights: {
      profitability: 30,
      trustworthiness: 25,
      urgency: 20,
      marketTrend: 15,
      capacity: 10,
    },
  },
  {
    name: 'Agresivní',
    description: 'Důraz na zisk a rychlost',
    weights: {
      profitability: 40,
      trustworthiness: 20,
      urgency: 25,
      marketTrend: 10,
      capacity: 5,
    },
  },
  {
    name: 'Opatrné',
    description: 'Důraz na důvěryhodnost',
    weights: {
      profitability: 20,
      trustworthiness: 35,
      urgency: 15,
      marketTrend: 20,
      capacity: 10,
    },
  },
  {
    name: 'Tržní',
    description: 'Sledování trendů',
    weights: {
      profitability: 25,
      trustworthiness: 20,
      urgency: 15,
      marketTrend: 30,
      capacity: 10,
    },
  },
];

interface WeightPresetsProps {
  onApplyPreset: (weights: WeightPreset['weights']) => void;
}

export const WeightPresets: React.FC<WeightPresetsProps> = ({
  onApplyPreset,
}) => {
  return (
    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
      <h4 className="font-medium text-slate-200 mb-3">📋 Přednastavené konfigurace</h4>
      
      <div className="grid grid-cols-2 gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => onApplyPreset(preset.weights)}
            className="p-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-left transition-colors"
          >
            <div className="font-medium text-sm">{preset.name}</div>
            <div className="text-xs text-slate-400">{preset.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
};
```

---

### 5. `components/Priority/WeightsPanel.tsx` (Nová komponenta - hlavní)
**Responsibility**: Hlavní panel pro nastavení vah

```typescript
import React from 'react';
import { usePriorityWeights } from '../../hooks/usePriorityWeights';
import { WeightSlider } from '../common/WeightSlider';
import { WeightSummary } from './WeightSummary';
import { WeightPresets } from './WeightPresets';

export const WeightsPanel: React.FC = () => {
  const {
    weights,
    totalWeight,
    isValid,
    validationError,
    updateWeight,
    resetToDefaults,
    saveWeights,
    isLoading,
  } = usePriorityWeights();

  const handleApplyPreset = (presetWeights: typeof weights) => {
    Object.entries(presetWeights).forEach(([key, value]) => {
      updateWeight(key as keyof typeof weights, value);
    });
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold text-sky-400">⚖️ Nastavení vah priority</h3>
        <div className="flex gap-2">
          <button
            onClick={resetToDefaults}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm"
          >
            Resetovat
          </button>
          <button
            onClick={saveWeights}
            disabled={!isValid || isLoading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 rounded text-sm"
          >
            {isLoading ? 'Ukládání...' : 'Uložit'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <WeightSummary
          total={totalWeight}
          isValid={isValid}
          error={validationError}
        />

        <WeightPresets onApplyPreset={handleApplyPreset} />

        <div className="grid md:grid-cols-2 gap-4">
          <WeightSlider
            label="Profitabilita"
            description="Váha zisku z obchodu"
            value={weights.profitability}
            icon="💰"
            color="emerald"
            onChange={(v) => updateWeight('profitability', v)}
          />

          <WeightSlider
            label="Důvěryhodnost"
            description="Váha důvěryhodnosti ceny"
            value={weights.trustworthiness}
            icon="🛡️"
            color="sky"
            onChange={(v) => updateWeight('trustworthiness', v)}
          />

          <WeightSlider
            label="Urgence"
            description="Váha rychlosti obchodu"
            value={weights.urgency}
            icon="⚡"
            color="amber"
            onChange={(v) => updateWeight('urgency', v)}
          />

          <WeightSlider
            label="Tržní trend"
            description="Váha tržních trendů"
            value={weights.marketTrend}
            icon="📈"
            color="violet"
            onChange={(v) => updateWeight('marketTrend', v)}
          />

          <WeightSlider
            label="Kapacita"
            description="Vaše aktuální kapacita"
            value={weights.capacity}
            icon="👤"
            color="rose"
            onChange={(v) => updateWeight('capacity', v)}
          />
        </div>
      </div>
    </div>
  );
};
```

---

### 6. `services/priority.service.ts` (Nový soubor)
**Responsibility**: API volání pro priority

```typescript
import { PriorityWeights } from '../types';

export const priorityService = {
  async getWeights(): Promise<PriorityWeights> {
    const response = await fetch('http://localhost:3001/priority/weights');
    if (!response.ok) {
      throw new Error('Failed to fetch weights');
    }
    return response.json();
  },

  async saveWeights(weights: PriorityWeights): Promise<void> {
    const response = await fetch('http://localhost:3001/priority/weights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(weights),
    });
    if (!response.ok) {
      throw new Error('Failed to save weights');
    }
  },

  async recalculateAll(): Promise<void> {
    const response = await fetch('http://localhost:3001/priority/recalculate-all', {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Failed to recalculate priorities');
    }
  },
};
```

---

## 🔄 Změny v importech

### Původní `PriorityWeightsPanel.tsx`:
```typescript
// Všechno v jedné komponentě (374 řádků)
const PriorityWeightsPanel = () => {
  // Všechna logika uvnitř
};
```

### Nový `PriorityWeightsPanel.tsx`:
```typescript
export { WeightsPanel as PriorityWeightsPanel } from './Priority/WeightsPanel';
```

### Nový `Priority/WeightsPanel.tsx`:
```typescript
import { usePriorityWeights } from '../../hooks/usePriorityWeights';
import { WeightSlider } from '../../components/common/WeightSlider';
import { WeightSummary } from './WeightSummary';
import { WeightPresets } from './WeightPresets';

export const WeightsPanel: React.FC = () => {
  const { weights, totalWeight, isValid, ...actions } = usePriorityWeights();

  return (
    <div>
      <WeightSummary total={totalWeight} isValid={isValid} />
      <WeightPresets onApplyPreset={...} />
      <div className="grid md:grid-cols-2 gap-4">
        <WeightSlider label="Profitabilita" {...} />
        <WeightSlider label="Důvěryhodnost" {...} />
        {/* ... další slidery */}
      </div>
    </div>
  );
};
```

---

## 📅 Fáze refaktorování

### Fáze 1: Hook (0.5 dne)
- [ ] `usePriorityWeights.ts`

### Fáze 2: Common komponenty (0.5 dne)
- [ ] `WeightSlider.tsx`

### Fáze 3: Priority komponenty (1 den)
- [ ] `WeightSummary.tsx`
- [ ] `WeightPresets.tsx`
- [ ] `WeightsPanel.tsx`

### Fáze 4: Service (0.5 dne)
- [ ] `priority.service.ts`

### Fáze 5: Integrace (0.5 dne)
- [ ] Aktualizovat importy
- [ ] Otestovat všechny funkce
- [ ] Odstranit původní kód

---

## ✅ Výhody po refaktorování

1. **Velikost** - Žádná komponenta > 150 řádků
2. **Znovupoužitelnost** - WeightSlider lze použít jinde
3. **Testovatelnost** - Hook lze testovat izolovaně
4. **Údržba** - Snadné přidávat nové presety
5. **Čitelnost** - Jasná struktura
6. **Validace** - Centralizovaná v hooku

---

*Vygenerováno: 2026-03-16*
*Autor: Autonomous Lead Fullstack Developer*
