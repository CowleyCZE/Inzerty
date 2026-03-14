import React, { useEffect, useState } from 'react';

interface AutoNegotiationSettings {
  enabled: boolean;
  minProfit: number;
  maxDiscountPercent: number; // max sleva z poptávky v %
  autoAcceptThreshold: number; // automaticky přijmout pokud counter <= této částky
  maxAutoNegotiations: number; // max počet kol vyjednávání na match
  requireManualFinal: boolean; // vyžadovat manuální schválení finální nabídky
}

interface NegotiationStats {
  totalNegotiations: number;
  successfulNegotiations: number;
  avgSavings: number;
  avgNegotiationRounds: number;
}

const AutoNegotiationSettings: React.FC = () => {
  const [settings, setSettings] = useState<AutoNegotiationSettings>({
    enabled: false,
    minProfit: 1000,
    maxDiscountPercent: 30,
    autoAcceptThreshold: 5000,
    maxAutoNegotiations: 3,
    requireManualFinal: true,
  });

  const [stats, setStats] = useState<NegotiationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
    loadStats();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('http://localhost:3001/negotiation/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings || settings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('http://localhost:3001/negotiation/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('http://localhost:3001/negotiation/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        alert('✅ Nastavení uloženo!');
        loadStats();
      }
    } catch (error) {
      alert('❌ Chyba při ukládání');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-slate-400">Načítám nastavení...</div>;
  }

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-sky-400 flex items-center gap-2">
          <span>💰</span>
          Automatické vyjednávání cen
        </h2>
        <button
          onClick={() => setSettings(s => ({ ...s, enabled: !s.enabled }))}
          className={`relative w-16 h-8 rounded-full transition-colors ${
            settings.enabled ? 'bg-green-600' : 'bg-slate-600'
          }`}
        >
          <div
            className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${
              settings.enabled ? 'left-9' : 'left-1'
            }`}
          ></div>
        </button>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 rounded-lg p-4">
            <div className="text-xs text-slate-400">Celkem vyjednávání</div>
            <div className="text-2xl font-bold text-white">{stats.totalNegotiations}</div>
          </div>
          <div className="bg-slate-900 rounded-lg p-4">
            <div className="text-xs text-slate-400">Úspěšných</div>
            <div className="text-2xl font-bold text-green-400">{stats.successfulNegotiations}</div>
          </div>
          <div className="bg-slate-900 rounded-lg p-4">
            <div className="text-xs text-slate-400">Průměrná úspora</div>
            <div className="text-xl font-bold text-emerald-400">{stats.avgSavings} Kč</div>
          </div>
          <div className="bg-slate-900 rounded-lg p-4">
            <div className="text-xs text-slate-400">Průměrně kol</div>
            <div className="text-2xl font-bold text-purple-400">{stats.avgNegotiationRounds}</div>
          </div>
        </div>
      )}

      {/* Settings Form */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Minimální zisk (Kč)
            </label>
            <input
              type="number"
              value={settings.minProfit}
              onChange={(e) => setSettings(s => ({ ...s, minProfit: Number(e.target.value) }))}
              className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">Minimální zisk po odkoupení</p>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Max sleva z poptávky (%)
            </label>
            <input
              type="number"
              value={settings.maxDiscountPercent}
              onChange={(e) => setSettings(s => ({ ...s, maxDiscountPercent: Number(e.target.value) }))}
              className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">Maximální sleva z poptávkové ceny</p>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Auto-přijmout do (Kč)
            </label>
            <input
              type="number"
              value={settings.autoAcceptThreshold}
              onChange={(e) => setSettings(s => ({ ...s, autoAcceptThreshold: Number(e.target.value) }))}
              className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">Automaticky přijmout pokud counter ≤ této částky</p>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Max kol vyjednávání
            </label>
            <input
              type="number"
              value={settings.maxAutoNegotiations}
              onChange={(e) => setSettings(s => ({ ...s, maxAutoNegotiations: Number(e.target.value) }))}
              className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">Maximální počet kol na jeden match</p>
          </div>
        </div>

        {/* Toggle Options */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.requireManualFinal}
              onChange={(e) => setSettings(s => ({ ...s, requireManualFinal: e.target.checked }))}
              className="w-4 h-4 rounded bg-slate-700 border-slate-600"
            />
            <span className="text-sm text-slate-300">Vyžadovat manuální schválení finální nabídky</span>
          </label>
        </div>

        {/* Info Box */}
        <div className="bg-sky-900 bg-opacity-20 border border-sky-700 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">ℹ️</span>
            <div className="text-sm text-sky-200">
              <p className="font-medium mb-1">Jak to funguje:</p>
              <ul className="list-disc list-inside space-y-1 text-sky-300">
                <li>AI analyzuje protinabídku prodejce</li>
                <li>Porovná s minimálním ziskem a maximální slevou</li>
                <li>Automaticky přijme, odmítne nebo proti-nabídne</li>
                <li>Historie vyjednávání se ukládá pro analýzu</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors"
          >
            {saving ? 'Ukládám...' : 'Uložit nastavení'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AutoNegotiationSettings;
