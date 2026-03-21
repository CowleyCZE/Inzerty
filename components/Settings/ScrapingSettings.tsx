import React from 'react';
import { Config, AdSource } from '../../types';
import { PlatformSelector } from '../PlatformSelector';

interface ScrapingSettingsProps {
  draft: Config;
  setDraft: React.Dispatch<React.SetStateAction<Config>>;
}

export const ScrapingSettings: React.FC<ScrapingSettingsProps> = ({ draft, setDraft }) => {
  const scrapingOptions = draft.scrapingOptions || {
    stopOnKnownAd: true,
    maxAdsPerTypePerBrand: 50,
  };

  return (
    <div className="space-y-4">
      <PlatformSelector
        enabledPlatforms={draft.enabledPlatforms || ['bazos_cz']}
        onTogglePlatform={(source, enabled) => {
          setDraft((prev) => {
            const current = (prev.enabledPlatforms || ['bazos_cz']) as AdSource[];
            const updated = enabled
              ? [...current, source]
              : current.filter(s => s !== source);
            return { ...prev, enabledPlatforms: updated };
          });
        }}
      />

      <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
        <h3 className="font-semibold text-sky-300 mb-2">Nastavení scrapování</h3>
        <label className="inline-flex items-center gap-3 text-sm text-slate-300 cursor-pointer group">
          <input
            type="checkbox"
            checked={scrapingOptions.stopOnKnownAd}
            onChange={(e) => setDraft((prev) => ({
              ...prev,
              scrapingOptions: {
                stopOnKnownAd: e.target.checked,
                maxAdsPerTypePerBrand: prev.scrapingOptions?.maxAdsPerTypePerBrand ?? 50,
              },
            }))}
            className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 bg-slate-800 border-slate-700"
          />
          <span className="group-hover:text-white transition-colors">
            Zastavit inkrementální scraping po nalezení již dříve staženého inzerátu
          </span>
        </label>
        <p className="text-xs text-slate-500 mt-2 italic px-7 leading-relaxed">
          Pro kompletní přestažení všech inzerátů (testování) můžete vypnout.
        </p>

        <label className="block text-xs uppercase font-bold text-slate-500 mt-5 mb-1.5 ml-1">Limit inzerátů na značku + typ</label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={10}
            max={500}
            step={10}
            value={scrapingOptions.maxAdsPerTypePerBrand}
            onChange={(e) => setDraft((prev) => ({
              ...prev,
              scrapingOptions: {
                stopOnKnownAd: prev.scrapingOptions?.stopOnKnownAd ?? true,
                maxAdsPerTypePerBrand: Number(e.target.value),
              },
            }))}
            className="flex-1 accent-sky-600 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-sm font-mono text-sky-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 min-w-[3rem] text-center">
            {scrapingOptions.maxAdsPerTypePerBrand}
          </span>
        </div>
      </div>
    </div>
  );
};
