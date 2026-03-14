import React, { useEffect, useState } from 'react';

interface FraudThresholds {
  low_risk_max: number;
  medium_risk_max: number;
  high_risk_max: number;
  critical_risk_min: number;
  auto_watchlist_threshold: number;
  enabled: boolean;
}

const FraudThresholdsPanel: React.FC = () => {
  const [thresholds, setThresholds] = useState<FraudThresholds>({
    low_risk_max: 24,
    medium_risk_max: 49,
    high_risk_max: 79,
    critical_risk_min: 80,
    auto_watchlist_threshold: 80,
    enabled: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadThresholds();
  }, []);

  const loadThresholds = async () => {
    try {
      const response = await fetch('http://localhost:3001/fraud/thresholds');
      if (response.ok) {
        const data = await response.json();
        if (data.thresholds) {
          setThresholds(data.thresholds);
        }
      }
    } catch (error) {
      console.error('Chyba při načítání prahů:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate thresholds
    if (thresholds.low_risk_max >= thresholds.medium_risk_max) {
      alert('⚠️ Low risk maximum musí být menší než Medium risk maximum');
      return;
    }
    if (thresholds.medium_risk_max >= thresholds.high_risk_max) {
      alert('⚠️ Medium risk maximum musí být menší než High risk maximum');
      return;
    }
    if (thresholds.high_risk_max >= thresholds.critical_risk_min) {
      alert('⚠️ High risk maximum musí být menší než Critical risk minimum');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('http://localhost:3001/fraud/thresholds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(thresholds),
      });

      if (response.ok) {
        alert('✅ Prahové hodnoty uloženy!');
      }
    } catch (error) {
      alert('❌ Chyba při ukládání prahových hodnot');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    setThresholds({
      low_risk_max: 24,
      medium_risk_max: 49,
      high_risk_max: 79,
      critical_risk_min: 80,
      auto_watchlist_threshold: 80,
      enabled: true,
    });
  };

  if (loading) {
    return <div className="text-slate-400">Načítám prahové hodnoty...</div>;
  }

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-sky-400 flex items-center gap-2">
          <span>⚖️</span>
          Prahové hodnoty pro Fraud Detection
        </h3>
        <button
          onClick={resetToDefault}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          🔄 Výchozí hodnoty
        </button>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between p-4 bg-slate-900 rounded-lg">
        <div>
          <div className="font-medium text-slate-200">Povolit vlastní prahy</div>
          <div className="text-sm text-slate-400">Při vypnutí se použijí výchozí hodnoty</div>
        </div>
        <button
          onClick={() => setThresholds(s => ({ ...s, enabled: !s.enabled }))}
          className={`relative w-16 h-8 rounded-full transition-colors ${
            thresholds.enabled ? 'bg-green-600' : 'bg-slate-600'
          }`}
        >
          <div
            className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${
              thresholds.enabled ? 'left-9' : 'left-1'
            }`}
          ></div>
        </button>
      </div>

      {/* Threshold Sliders */}
      <div className="space-y-6">
        {/* Low Risk Max */}
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🟢</span>
              <div>
                <div className="font-medium text-slate-200">Low Risk (Nízké riziko)</div>
                <div className="text-xs text-slate-400">Skóre 0 - {thresholds.low_risk_max}</div>
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-400 w-16 text-right">
              {thresholds.low_risk_max}
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="40"
            value={thresholds.low_risk_max}
            onChange={(e) => setThresholds(s => ({ ...s, low_risk_max: Number(e.target.value) }))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            disabled={!thresholds.enabled}
          />
        </div>

        {/* Medium Risk Max */}
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🟡</span>
              <div>
                <div className="font-medium text-slate-200">Medium Risk (Střední riziko)</div>
                <div className="text-xs text-slate-400">Skóre {thresholds.low_risk_max + 1} - {thresholds.medium_risk_max}</div>
              </div>
            </div>
            <div className="text-2xl font-bold text-yellow-400 w-16 text-right">
              {thresholds.medium_risk_max}
            </div>
          </div>
          <input
            type="range"
            min="25"
            max="60"
            value={thresholds.medium_risk_max}
            onChange={(e) => setThresholds(s => ({ ...s, medium_risk_max: Number(e.target.value) }))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
            disabled={!thresholds.enabled}
          />
        </div>

        {/* High Risk Max */}
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🟠</span>
              <div>
                <div className="font-medium text-slate-200">High Risk (Vysoké riziko)</div>
                <div className="text-xs text-slate-400">Skóre {thresholds.medium_risk_max + 1} - {thresholds.high_risk_max}</div>
              </div>
            </div>
            <div className="text-2xl font-bold text-orange-400 w-16 text-right">
              {thresholds.high_risk_max}
            </div>
          </div>
          <input
            type="range"
            min="50"
            max="85"
            value={thresholds.high_risk_max}
            onChange={(e) => setThresholds(s => ({ ...s, high_risk_max: Number(e.target.value) }))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
            disabled={!thresholds.enabled}
          />
        </div>

        {/* Critical Risk Min */}
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔴</span>
              <div>
                <div className="font-medium text-slate-200">Critical Risk (Kritické riziko)</div>
                <div className="text-xs text-slate-400">Skóre {thresholds.critical_risk_min} - 100</div>
              </div>
            </div>
            <div className="text-2xl font-bold text-red-400 w-16 text-right">
              {thresholds.critical_risk_min}
            </div>
          </div>
          <input
            type="range"
            min="70"
            max="100"
            value={thresholds.critical_risk_min}
            onChange={(e) => setThresholds(s => ({ ...s, critical_risk_min: Number(e.target.value) }))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500"
            disabled={!thresholds.enabled}
          />
        </div>

        {/* Auto Watchlist Threshold */}
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">📋</span>
              <div>
                <div className="font-medium text-slate-200">Auto Watchlist</div>
                <div className="text-xs text-slate-400">Při skóre ≥ {thresholds.auto_watchlist_threshold} automaticky na watchlist</div>
              </div>
            </div>
            <div className="text-2xl font-bold text-purple-400 w-16 text-right">
              {thresholds.auto_watchlist_threshold}
            </div>
          </div>
          <input
            type="range"
            min="50"
            max="100"
            value={thresholds.auto_watchlist_threshold}
            onChange={(e) => setThresholds(s => ({ ...s, auto_watchlist_threshold: Number(e.target.value) }))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            disabled={!thresholds.enabled}
          />
        </div>
      </div>

      {/* Visual Representation */}
      <div className="bg-slate-900 rounded-lg p-4">
        <h4 className="text-sm font-medium text-slate-300 mb-3">Vizualizace rizikových zón</h4>
        <div className="w-full h-8 rounded-full overflow-hidden flex">
          <div 
            className="bg-emerald-500 transition-all flex items-center justify-center text-xs text-white font-medium"
            style={{ width: `${(thresholds.low_risk_max / 100) * 100}%` }}
          >
            Low
          </div>
          <div 
            className="bg-yellow-500 transition-all flex items-center justify-center text-xs text-white font-medium"
            style={{ width: `${((thresholds.medium_risk_max - thresholds.low_risk_max) / 100) * 100}%` }}
          >
            Medium
          </div>
          <div 
            className="bg-orange-500 transition-all flex items-center justify-center text-xs text-white font-medium"
            style={{ width: `${((thresholds.high_risk_max - thresholds.medium_risk_max) / 100) * 100}%` }}
          >
            High
          </div>
          <div 
            className="bg-red-500 transition-all flex items-center justify-center text-xs text-white font-medium"
            style={{ width: `${((100 - thresholds.high_risk_max) / 100) * 100}%` }}
          >
            Critical
          </div>
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-2">
          <span>0</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>100</span>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-sky-900 bg-opacity-20 border border-sky-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div className="text-sm text-sky-200">
            <div className="font-medium mb-1">Jak fungují prahové hodnoty:</div>
            <ul className="list-disc list-inside space-y-1 text-sky-300">
              <li>Low Risk (0-{thresholds.low_risk_max}): Bezpečné obchody, žádná akce</li>
              <li>Medium Risk ({thresholds.low_risk_max + 1}-{thresholds.medium_risk_max}): Střední riziko, doporučeno zkontrolovat</li>
              <li>High Risk ({thresholds.medium_risk_max + 1}-{thresholds.high_risk_max}): Vysoké riziko, upozornění</li>
              <li>Critical Risk ({thresholds.critical_risk_min}-100): Kritické, automaticky na watchlist pokud ≥ {thresholds.auto_watchlist_threshold}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-slate-700">
        <button
          onClick={handleSave}
          disabled={saving || !thresholds.enabled}
          className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors"
        >
          {saving ? '💾 Ukládám...' : '💾 Uložit prahy'}
        </button>
      </div>
    </div>
  );
};

export default FraudThresholdsPanel;
