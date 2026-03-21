import React from 'react';
import { useFraudThresholds } from '../hooks/useFraudThresholds';

// Sub-components
import { RiskZoneSlider } from './Settings/RiskZoneSlider';

const FraudThresholdsPanel: React.FC = () => {
  const {
    thresholds,
    loading,
    saving,
    handleSave,
    resetToDefault,
    updateThreshold,
  } = useFraudThresholds();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 bg-slate-800 rounded-2xl border border-slate-700 animate-pulse">
        <svg className="animate-spin h-8 w-8 mb-4 text-rose-500" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        Načítám parametry rizik...
      </div>
    );
  }

  const onSaveClick = async () => {
    const success = await handleSave();
    if (success) {
      alert('🔒 Prahové hodnoty rizik byly úspešně uloženy!');
    } else {
      alert('❌ Chyba při ukládání prahových hodnot. Zkontrolujte validitu rozsahů.');
    }
  };

  return (
    <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-slate-700 shadow-2xl space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      
      {/* Header section */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700/50 pb-6">
        <div className="flex items-center gap-4">
          <div className="text-3xl p-3 bg-rose-900/40 text-rose-400 border border-rose-800 rounded-2xl shadow-inner">🛡️</div>
          <div>
            <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-orange-400 tracking-tight">
              Fraud Detection Prahy
            </h3>
            <p className="text-slate-400 text-sm mt-0.5 max-w-xs font-medium leading-relaxed opacity-80 italic">
              Definujte citlivost detekčního systému na podezřelé inzeráty a podvody.
            </p>
          </div>
        </div>
        
        <button
          onClick={resetToDefault}
          className="px-4 py-2 bg-slate-750 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95 flex items-center gap-2 shadow-lg"
        >
          🔄 Výchozí prahy
        </button>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between p-5 bg-slate-900/50 rounded-2xl border border-slate-700/50 group transition-all hover:bg-slate-900/80">
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-xl transition-colors ${thresholds.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
            {thresholds.enabled ? '🟢' : '⚪'}
          </div>
          <div>
            <div className="font-bold text-slate-100 group-hover:text-white">Povolit vlastní prahy rizik</div>
            <div className="text-xs text-slate-500 font-medium">Při vypnutí se použijí systémové výchozí hodnoty (vhodné pro začátečníky)</div>
          </div>
        </div>
        <button
          onClick={() => updateThreshold('enabled', !thresholds.enabled)}
          className={`relative w-14 h-7 rounded-full transition-all shadow-inner ${
            thresholds.enabled ? 'bg-emerald-600 shadow-emerald-900/50' : 'bg-slate-700'
          }`}
        >
          <div
            className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-md ${
              thresholds.enabled ? 'translate-x-8' : 'translate-x-1'
            }`}
          ></div>
        </button>
      </div>

      {/* Risk Zone Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RiskZoneSlider 
          label="Nízké riziko" 
          rangeText={`Skóre 0 - ${thresholds.low_risk_max}`} 
          icon="🟢" 
          value={thresholds.low_risk_max} 
          min={0} max={40} 
          colorClass="accent-emerald-500" 
          disabled={!thresholds.enabled} 
          onChange={(v) => updateThreshold('low_risk_max', v)} 
        />
        <RiskZoneSlider 
          label="Střední riziko" 
          rangeText={`Skóre ${thresholds.low_risk_max + 1} - ${thresholds.medium_risk_max}`} 
          icon="🟡" 
          value={thresholds.medium_risk_max} 
          min={25} max={60} 
          colorClass="accent-yellow-500" 
          disabled={!thresholds.enabled} 
          onChange={(v) => updateThreshold('medium_risk_max', v)} 
        />
        <RiskZoneSlider 
          label="Vysoké riziko" 
          rangeText={`Skóre ${thresholds.medium_risk_max + 1} - ${thresholds.high_risk_max}`} 
          icon="🟠" 
          value={thresholds.high_risk_max} 
          min={50} max={85} 
          colorClass="accent-orange-500" 
          disabled={!thresholds.enabled} 
          onChange={(v) => updateThreshold('high_risk_max', v)} 
        />
        <RiskZoneSlider 
          label="Kritické riziko" 
          rangeText={`Skóre ${thresholds.critical_risk_min} - 100`} 
          icon="🔴" 
          value={thresholds.critical_risk_min} 
          min={70} max={100} 
          colorClass="accent-red-500" 
          disabled={!thresholds.enabled} 
          onChange={(v) => updateThreshold('critical_risk_min', v)} 
        />
        <RiskZoneSlider 
          label="Auto Watchlist" 
          rangeText={`Automaticky přidat při skóre ≥ ${thresholds.auto_watchlist_threshold}`} 
          icon="📋" 
          value={thresholds.auto_watchlist_threshold} 
          min={50} max={100} 
          colorClass="accent-purple-500" 
          disabled={!thresholds.enabled} 
          onChange={(v) => updateThreshold('auto_watchlist_threshold', v)} 
        />
        
        {/* Risk Breakdown Summary */}
        <div className="bg-slate-900/40 rounded-2xl p-5 border border-slate-700/50 flex flex-col justify-center">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Aktuální riziková mapa</h4>
          <div className="w-full h-10 rounded-xl overflow-hidden flex border border-slate-950 shadow-inner">
            <div className="bg-emerald-500/80 transition-all flex items-center justify-center text-[10px] font-black text-white" style={{ width: `${thresholds.low_risk_max}%` }}>LOW</div>
            <div className="bg-yellow-500/80 transition-all flex items-center justify-center text-[10px] font-black text-white" style={{ width: `${thresholds.medium_risk_max - thresholds.low_risk_max}%` }}>MED</div>
            <div className="bg-orange-500/80 transition-all flex items-center justify-center text-[10px] font-black text-white" style={{ width: `${thresholds.high_risk_max - thresholds.medium_risk_max}%` }}>HIGH</div>
            <div className="bg-red-500/80 transition-all flex items-center justify-center text-[10px] font-black text-white" style={{ width: `${100 - thresholds.high_risk_max}%` }}>CRIT</div>
          </div>
        </div>
      </div>

      {/* Info & Footer */}
      <div className="flex flex-wrap lg:flex-nowrap gap-6 items-center pt-6 border-t border-slate-700/50">
        <div className="flex-1 bg-sky-950/20 border border-sky-900/50 rounded-2xl p-4 flex gap-4">
           <div className="text-2xl mt-0.5">💡</div>
           <p className="text-xs text-sky-200/70 font-medium leading-relaxed italic">
             Čím <strong>nižší</strong> prahy nastavíte, tím <strong>přísnější</strong> bude systém. Pro bazarové inzeráty doporučujeme ponechat Low Risk hranici pod 30 body.
           </p>
        </div>
        
        <button
          onClick={onSaveClick}
          disabled={saving || !thresholds.enabled}
          className={`whitespace-nowrap px-8 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-xl active:scale-95 disabled:grayscale disabled:opacity-50 ${
            saving 
            ? 'bg-slate-700 cursor-wait' 
            : 'bg-emerald-600 hover:bg-emerald-500 text-white hover:shadow-emerald-500/20'
          }`}
        >
          {saving ? '📥 Synchronizuji...' : '💾 Uložit prahy'}
        </button>
      </div>
    </div>
  );
};

export default FraudThresholdsPanel;
