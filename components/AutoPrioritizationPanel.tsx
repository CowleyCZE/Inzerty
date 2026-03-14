import React, { useEffect, useState } from 'react';

interface AutoPrioritizationSettings {
  enabled: boolean;
  auto_sort_matches: boolean;
  highlight_top_priority: boolean;
  min_priority_score: number;
  notification_threshold: number;
  sort_order: 'sestupně' | 'vzestupně';
}

interface AutoPrioritizationPanelProps {
  onSettingsChange?: (settings: AutoPrioritizationSettings) => void;
}

const AutoPrioritizationPanel: React.FC<AutoPrioritizationPanelProps> = ({ onSettingsChange }) => {
  const [settings, setSettings] = useState<AutoPrioritizationSettings>({
    enabled: false,
    auto_sort_matches: true,
    highlight_top_priority: true,
    min_priority_score: 50,
    notification_threshold: 80,
    sort_order: 'sestupně',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('http://localhost:3001/priority/auto-prioritization');
      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setSettings(data.settings);
        }
      }
    } catch (error) {
      console.error('Chyba při načítání nastavení:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('http://localhost:3001/priority/auto-prioritization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        alert('✅ Nastavení uloženo!');
        onSettingsChange?.(settings);
      }
    } catch (error) {
      alert('❌ Chyba při ukládání nastavení');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-slate-400">Načítám nastavení automatizace...</div>;
  }

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-sky-400 flex items-center gap-2">
          <span>🤖</span>
          Automatická prioritizace
        </h3>
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

      {/* Enable/Disable Info */}
      <div className={`p-4 rounded-lg border-2 ${
        settings.enabled 
          ? 'bg-emerald-900 bg-opacity-20 border-emerald-600' 
          : 'bg-slate-900 border-slate-700'
      }`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{settings.enabled ? '✅' : '⏸️'}</span>
          <div>
            <div className="font-medium text-slate-200">
              {settings.enabled ? 'Automatická prioritizace je zapnuta' : 'Automatická prioritizace je vypnuta'}
            </div>
            <div className="text-sm text-slate-400">
              {settings.enabled 
                ? 'Obchody budou automaticky řazeny podle priority' 
                : 'Řazení obchodů je manuální'}
            </div>
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="space-y-4">
        {/* Auto Sort */}
        <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
          <div>
            <div className="font-medium text-slate-200">Automatické řazení obchodů</div>
            <div className="text-sm text-slate-400">Řadit obchody podle priority automaticky</div>
          </div>
          <button
            onClick={() => setSettings(s => ({ ...s, auto_sort_matches: !s.auto_sort_matches }))}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              settings.auto_sort_matches ? 'bg-green-600' : 'bg-slate-600'
            }`}
          >
            <div
              className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                settings.auto_sort_matches ? 'left-8' : 'left-1'
              }`}
            ></div>
          </button>
        </div>

        {/* Highlight Top Priority */}
        <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
          <div>
            <div className="font-medium text-slate-200">Zvýraznit top prioritu</div>
            <div className="text-sm text-slate-400">Zvýraznit obchody s vysokou prioritou</div>
          </div>
          <button
            onClick={() => setSettings(s => ({ ...s, highlight_top_priority: !s.highlight_top_priority }))}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              settings.highlight_top_priority ? 'bg-green-600' : 'bg-slate-600'
            }`}
          >
            <div
              className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                settings.highlight_top_priority ? 'left-8' : 'left-1'
              }`}
            ></div>
          </button>
        </div>

        {/* Min Priority Score */}
        <div className="p-3 bg-slate-900 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="font-medium text-slate-200">Minimální skóre priority</div>
              <div className="text-sm text-slate-400">Obchody pod tímto skóre se skryjí</div>
            </div>
            <span className="text-2xl font-bold text-sky-400">{settings.min_priority_score}</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.min_priority_score}
            onChange={(e) => setSettings(s => ({ ...s, min_priority_score: Number(e.target.value) }))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>

        {/* Notification Threshold */}
        <div className="p-3 bg-slate-900 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="font-medium text-slate-200">Práh pro upozornění</div>
              <div className="text-sm text-slate-400">Upozornit při prioritě nad tímto prahem</div>
            </div>
            <span className="text-2xl font-bold text-emerald-400">{settings.notification_threshold}</span>
          </div>
          <input
            type="range"
            min="50"
            max="100"
            value={settings.notification_threshold}
            onChange={(e) => setSettings(s => ({ ...s, notification_threshold: Number(e.target.value) }))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
        </div>

        {/* Sort Order */}
        <div className="p-3 bg-slate-900 rounded-lg">
          <div className="font-medium text-slate-200 mb-3">Směr řazení</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSettings(s => ({ ...s, sort_order: 'sestupně' }))}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                settings.sort_order === 'sestupně'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              ⬇️ Sestupně (nejvyšší první)
            </button>
            <button
              onClick={() => setSettings(s => ({ ...s, sort_order: 'vzestupně' }))}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                settings.sort_order === 'vzestupně'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              ⬆️ Vzestupně (nejnižší první)
            </button>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-sky-900 bg-opacity-20 border border-sky-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div className="text-sm text-sky-200">
            <div className="font-medium mb-1">Jak funguje automatická prioritizace:</div>
            <ul className="list-disc list-inside space-y-1 text-sky-300">
              <li>Obchody se automaticky řadí podle vypočítaného skóre priority</li>
              <li>Top priority obchody jsou zvýrazněny barvou</li>
              <li>Při dosažení prahu pro upozornění se zobrazí notifikace</li>
              <li>Obchody pod minimálním skórem se mohou skrýt</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-slate-700">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors"
        >
          {saving ? '💾 Ukládám...' : '💾 Uložit nastavení'}
        </button>
      </div>
    </div>
  );
};

export default AutoPrioritizationPanel;
