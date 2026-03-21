import React, { useState, useEffect } from 'react';
import { AdSource, AdSourceName } from '../types';

interface PlatformSelectorProps {
  enabledPlatforms: AdSource[];
  onTogglePlatform: (source: AdSource, enabled: boolean) => void;
}

export const PlatformSelector: React.FC<PlatformSelectorProps> = ({
  enabledPlatforms,
  onTogglePlatform,
}) => {
  const [expanded, setExpanded] = useState(false);

  // Dostupné platformy s jejich status
  const platforms: Array<{
    source: AdSource;
    name: string;
    status: 'implemented' | 'coming_soon' | 'planned';
    description: string;
    volume: 'high' | 'medium' | 'low';
  }> = [
    {
      source: 'bazos_cz',
      name: AdSourceName.bazos_cz,
      status: 'implemented',
      description: 'Největší český inzertní server',
      volume: 'high',
    },
    {
      source: 'bazos_sk',
      name: AdSourceName.bazos_sk,
      status: 'implemented',
      description: 'Slovenská verze Bazoše - stejná struktura jako CZ',
      volume: 'high',
    },
    {
      source: 'sbazar',
      name: AdSourceName.sbazar,
      status: 'planned',
      description: 'Inzertní server Seznam.cz',
      volume: 'high',
    },
    {
      source: 'mobilnet',
      name: AdSourceName.mobilnet,
      status: 'planned',
      description: 'Specializovaný portál na mobilní telefony',
      volume: 'medium',
    },
    {
      source: 'aukro',
      name: AdSourceName.aukro,
      status: 'planned',
      description: 'Aukční a inzertní portál',
      volume: 'medium',
    },
    {
      source: 'hyperinzerce',
      name: AdSourceName.hyperinzerce,
      status: 'planned',
      description: 'Agregátor inzerce z více zdrojů',
      volume: 'low',
    },
    {
      source: 'annonce',
      name: AdSourceName.annonce,
      status: 'planned',
      description: 'Klasický inzertní server',
      volume: 'low',
    },
  ];

  const togglePlatform = (source: AdSource) => {
    const currentlyEnabled = enabledPlatforms.includes(source);
    onTogglePlatform(source, !currentlyEnabled);
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-sky-400">🌍 Inzertní platformy</h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="px-3 py-1 bg-slate-700 rounded hover:bg-slate-600 text-sm"
        >
          {expanded ? 'Skrýt' : 'Zobrazit'} všechny
        </button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {platforms
          .filter(p => expanded || p.status === 'implemented' || enabledPlatforms.includes(p.source))
          .map((platform) => {
            const isEnabled = enabledPlatforms.includes(platform.source);
            const isDisabled = platform.status !== 'implemented';

            return (
              <div
                key={platform.source}
                className={`p-4 rounded-lg border transition-all ${
                  isEnabled
                    ? 'bg-emerald-900/20 border-emerald-600'
                    : isDisabled
                    ? 'bg-slate-900/50 border-slate-700 opacity-60'
                    : 'bg-slate-800 border-slate-600 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">
                      {platform.status === 'implemented' ? '✅' : platform.status === 'coming_soon' ? '🔜' : '📋'}
                    </span>
                    <span className="font-medium text-slate-200">{platform.name}</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={isEnabled}
                      onChange={() => togglePlatform(platform.source)}
                      disabled={isDisabled && !isEnabled}
                    />
                    <div className={`w-11 h-6 rounded-full peer peer-focus:ring-2 peer-focus:ring-sky-500 ${
                      isEnabled ? 'bg-emerald-600' : isDisabled ? 'bg-slate-600' : 'bg-slate-600'
                    }`}>
                    </div>
                    <div className={`absolute left-0.5 top-0.5 bg-white border rounded-full transition-transform ${
                      isEnabled ? 'translate-x-5' : 'translate-x-0'
                    } w-5 h-5`}></div>
                  </label>
                </div>

                <p className="text-sm text-slate-400 mb-2">{platform.description}</p>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Objem inzerátů:</span>
                  <div className="flex gap-1">
                    <div className={`w-2 h-2 rounded-full ${
                      platform.volume === 'high' ? 'bg-emerald-500' : 'bg-slate-600'
                    }`}></div>
                    <div className={`w-2 h-2 rounded-full ${
                      platform.volume === 'high' || platform.volume === 'medium' ? 'bg-emerald-500' : 'bg-slate-600'
                    }`}></div>
                    <div className={`w-2 h-2 rounded-full ${
                      platform.volume === 'high' || platform.volume === 'medium' || platform.volume === 'low' ? 'bg-emerald-500' : 'bg-slate-600'
                    }`}></div>
                  </div>
                  <span className="text-slate-400 capitalize">{platform.volume}</span>
                </div>

                {isDisabled && !isEnabled && (
                  <div className="mt-2 text-xs text-amber-400">
                    ⚠️ Tato platforma ještě není implementována
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {enabledPlatforms.length > 0 && (
        <div className="mt-4 p-3 bg-sky-900/20 border border-sky-700 rounded-lg">
          <p className="text-sm text-sky-300">
            ✅ Aktivní platformy: <strong>{enabledPlatforms.map(s => AdSourceName[s]).join(', ')}</strong>
          </p>
          <p className="text-xs text-sky-400 mt-1">
            💡 Tip: Více platforem = větší šance najít výhodné arbitráže
          </p>
        </div>
      )}
    </div>
  );
};

export default PlatformSelector;
