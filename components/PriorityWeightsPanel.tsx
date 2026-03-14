import React, { useEffect, useState } from 'react';

interface PriorityWeights {
  profit_weight: number;
  trust_weight: number;
  urgency_weight: number;
  market_weight: number;
  capacity_weight: number;
}

interface PriorityWeightsPanelProps {
  onWeightsChange?: (weights: PriorityWeights) => void;
}

const PriorityWeightsPanel: React.FC<PriorityWeightsPanelProps> = ({ onWeightsChange }) => {
  const [weights, setWeights] = useState<PriorityWeights>({
    profit_weight: 30,
    trust_weight: 25,
    urgency_weight: 20,
    market_weight: 15,
    capacity_weight: 10,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [totalWeight, setTotalWeight] = useState(100);

  useEffect(() => {
    loadWeights();
  }, []);

  useEffect(() => {
    const total = 
      weights.profit_weight +
      weights.trust_weight +
      weights.urgency_weight +
      weights.market_weight +
      weights.capacity_weight;
    setTotalWeight(total);
  }, [weights]);

  const loadWeights = async () => {
    try {
      const response = await fetch('http://localhost:3001/priority/weights');
      if (response.ok) {
        const data = await response.json();
        if (data.weights) {
          setWeights(data.weights);
        }
      }
    } catch (error) {
      console.error('Chyba při načítání vah:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (totalWeight !== 100) {
      alert('⚠️ Součet vah musí být přesně 100%');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('http://localhost:3001/priority/weights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(weights),
      });

      if (response.ok) {
        alert('✅ Váhy uloženy!');
        onWeightsChange?.(weights);
      }
    } catch (error) {
      alert('❌ Chyba při ukládání vah');
    } finally {
      setSaving(false);
    }
  };

  const handleWeightChange = (field: keyof PriorityWeights, value: number) => {
    if (value < 0 || value > 100) return;
    setWeights(prev => ({ ...prev, [field]: value }));
  };

  const resetToDefault = () => {
    setWeights({
      profit_weight: 30,
      trust_weight: 25,
      urgency_weight: 20,
      market_weight: 15,
      capacity_weight: 10,
    });
  };

  if (loading) {
    return <div className="text-slate-400">Načítám nastavení vah...</div>;
  }

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-sky-400 flex items-center gap-2">
          <span>⚖️</span>
          Nastavení vah priority
        </h3>
        <button
          onClick={resetToDefault}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          🔄 Výchozí hodnoty
        </button>
      </div>

      {/* Total Weight Indicator */}
      <div className={`p-4 rounded-lg border-2 ${
        totalWeight === 100 
          ? 'bg-emerald-900 bg-opacity-20 border-emerald-600' 
          : 'bg-red-900 bg-opacity-20 border-red-600'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-slate-300">Celkový součet vah</div>
            <div className={`text-2xl font-bold ${
              totalWeight === 100 ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {totalWeight}%
            </div>
          </div>
          {totalWeight === 100 ? (
            <span className="text-emerald-400 text-lg">✅ Správně</span>
          ) : (
            <span className="text-red-400 text-lg">
              ⚠️ Chybí {100 - totalWeight > 0 ? 100 - totalWeight : Math.abs(100 - totalWeight)}%
            </span>
          )}
        </div>
      </div>

      {/* Weight Sliders */}
      <div className="space-y-4">
        {/* Profitabilita */}
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">💰</span>
              <div>
                <div className="font-medium text-slate-200">Profitabilita</div>
                <div className="text-xs text-slate-400">Založeno na potenciálním zisku</div>
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-400 w-16 text-right">
              {weights.profit_weight}%
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={weights.profit_weight}
            onChange={(e) => handleWeightChange('profit_weight', Number(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Důvěryhodnost */}
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🛡️</span>
              <div>
                <div className="font-medium text-slate-200">Důvěryhodnost</div>
                <div className="text-xs text-slate-400">Podobnost inzerátů a historie</div>
              </div>
            </div>
            <div className="text-2xl font-bold text-blue-400 w-16 text-right">
              {weights.trust_weight}%
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={weights.trust_weight}
            onChange={(e) => handleWeightChange('trust_weight', Number(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Urgence */}
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚡</span>
              <div>
                <div className="font-medium text-slate-200">Urgence</div>
                <div className="text-xs text-slate-400">Čas od zveřejnění inzerátu</div>
              </div>
            </div>
            <div className="text-2xl font-bold text-yellow-400 w-16 text-right">
              {weights.urgency_weight}%
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={weights.urgency_weight}
            onChange={(e) => handleWeightChange('urgency_weight', Number(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Tržní trend */}
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">📈</span>
              <div>
                <div className="font-medium text-slate-200">Tržní trend</div>
                <div className="text-xs text-slate-400">Poptávka po typu zařízení</div>
              </div>
            </div>
            <div className="text-2xl font-bold text-purple-400 w-16 text-right">
              {weights.market_weight}%
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={weights.market_weight}
            onChange={(e) => handleWeightChange('market_weight', Number(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Kapacita */}
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">👤</span>
              <div>
                <div className="font-medium text-slate-200">Kapacita</div>
                <div className="text-xs text-slate-400">Aktuální vytížení uživatele</div>
              </div>
            </div>
            <div className="text-2xl font-bold text-pink-400 w-16 text-right">
              {weights.capacity_weight}%
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={weights.capacity_weight}
            onChange={(e) => handleWeightChange('capacity_weight', Number(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* Visualization */}
      <div className="bg-slate-900 rounded-lg p-4">
        <h4 className="text-sm font-medium text-slate-300 mb-3">Vizualizace rozložení</h4>
        <div className="w-full h-8 rounded-full overflow-hidden flex">
          <div 
            className="bg-emerald-500 transition-all" 
            style={{ width: `${(weights.profit_weight / totalWeight) * 100}%` }}
            title={`Profitabilita: ${weights.profit_weight}%`}
          ></div>
          <div 
            className="bg-blue-500 transition-all" 
            style={{ width: `${(weights.trust_weight / totalWeight) * 100}%` }}
            title={`Důvěryhodnost: ${weights.trust_weight}%`}
          ></div>
          <div 
            className="bg-yellow-500 transition-all" 
            style={{ width: `${(weights.urgency_weight / totalWeight) * 100}%` }}
            title={`Urgence: ${weights.urgency_weight}%`}
          ></div>
          <div 
            className="bg-purple-500 transition-all" 
            style={{ width: `${(weights.market_weight / totalWeight) * 100}%` }}
            title={`Tržní trend: ${weights.market_weight}%`}
          ></div>
          <div 
            className="bg-pink-500 transition-all" 
            style={{ width: `${(weights.capacity_weight / totalWeight) * 100}%` }}
            title={`Kapacita: ${weights.capacity_weight}%`}
          ></div>
        </div>
        <div className="flex flex-wrap gap-3 mt-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-emerald-500"></div>
            <span className="text-slate-400">Profitabilita ({weights.profit_weight}%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-500"></div>
            <span className="text-slate-400">Důvěryhodnost ({weights.trust_weight}%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-500"></div>
            <span className="text-slate-400">Urgence ({weights.urgency_weight}%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-purple-500"></div>
            <span className="text-slate-400">Tržní trend ({weights.market_weight}%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-pink-500"></div>
            <span className="text-slate-400">Kapacita ({weights.capacity_weight}%)</span>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-slate-700">
        <button
          onClick={handleSave}
          disabled={saving || totalWeight !== 100}
          className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors"
        >
          {saving ? '💾 Ukládám...' : '💾 Uložit váhy'}
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-sky-900 bg-opacity-20 border border-sky-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div className="text-sm text-sky-200">
            <div className="font-medium mb-1">Jak fungují váhy priority:</div>
            <ul className="list-disc list-inside space-y-1 text-sky-300">
              <li>Vyšší váha = větší vliv na celkové skóre priority</li>
              <li>Součet všech vah musí být přesně 100%</li>
              <li>Změny se projeví při příštím výpočtu priority</li>
              <li>Výchozí nastavení je vyvážené pro většinu uživatelů</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PriorityWeightsPanel;
