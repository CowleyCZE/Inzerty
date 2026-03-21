import React from 'react';
import { usePriorityWeights, PriorityWeights } from '../hooks/usePriorityWeights';

// Sub-components
import { WeightSlider } from './Settings/WeightSlider';
import { WeightVisualization } from './Settings/WeightVisualization';

interface PriorityWeightsPanelProps {
  onWeightsChange?: (weights: PriorityWeights) => void;
}

const PriorityWeightsPanel: React.FC<PriorityWeightsPanelProps> = ({ onWeightsChange }) => {
  const {
    weights,
    loading,
    saving,
    totalWeight,
    handleWeightChange,
    handleSave,
    resetToDefault,
  } = usePriorityWeights(onWeightsChange);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 bg-slate-800 rounded-2xl border border-slate-700 animate-pulse">
        <svg className="animate-spin h-8 w-8 mb-4 text-sky-500" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        Načítám parametry priority...
      </div>
    );
  }

  const onSaveClick = async () => {
    const success = await handleSave();
    if (success) {
      alert('🎯 Váhy priority byly úspěšně uloženy!');
    } else {
      alert('❌ Chyba při ukládání vah. Prověřte připojení k backendu.');
    }
  };

  return (
    <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-slate-700 shadow-2xl space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
      
      {/* Header section */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700/50 pb-6">
        <div className="flex items-center gap-4">
          <div className="text-3xl p-3 bg-sky-900/40 text-sky-400 border border-sky-800 rounded-2xl shadow-inner">⚖️</div>
          <div>
            <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400 tracking-tight">
              Algoritmus Priority
            </h3>
            <p className="text-slate-400 text-sm mt-0.5 max-w-xs font-medium leading-relaxed opacity-80 italic">
              Vylaďte váhy, které určují pořadí vašich příležitostí k zisku.
            </p>
          </div>
        </div>
        
        <button
          onClick={resetToDefault}
          className="px-4 py-2 bg-slate-750 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95 flex items-center gap-2 shadow-lg"
        >
          🔄 Výchozí nastavení
        </button>
      </div>

      {/* Total percentage indicator */}
      <div className={`p-5 rounded-2xl border-2 transition-all relative overflow-hidden group shadow-inner ${
        totalWeight === 100 
          ? 'bg-emerald-900/10 border-emerald-600/40' 
          : 'bg-rose-900/10 border-rose-600/40 animate-pulse'
      }`}>
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className={`p-2.5 rounded-xl ${totalWeight === 100 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400 border border-rose-800'}`}>
              <div className="text-2xl font-black font-mono leading-none">{totalWeight}%</div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Stav konfigurace</div>
              <div className={`text-sm font-bold ${totalWeight === 100 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {totalWeight === 100 ? '✅ Součet je perfektní (100%)' : `⚠️ Zbývá doladit ${100 - totalWeight > 0 ? 100 - totalWeight : Math.abs(100 - totalWeight)}%`}
              </div>
            </div>
          </div>
          <div className="hidden sm:block">
            {totalWeight === 100 ? (
               <div className="text-[10px] bg-emerald-900/30 text-emerald-400 py-1 px-3 rounded-full border border-emerald-700 font-bold uppercase tracking-widest shadow-lg">Validní stav</div>
            ) : (
               <div className="text-[10px] bg-rose-900/30 text-rose-400 py-1 px-3 rounded-full border border-rose-700 font-bold uppercase tracking-widest shadow-lg">Neplatné</div>
            )}
          </div>
        </div>
        {/* Background glow decoration */}
        <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl opacity-10 transition-colors ${totalWeight === 100 ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
      </div>

      {/* Grid of sliders (2 columns on Desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WeightSlider 
          label="Profitabilita" 
          description="💰 Potenciální čistý zisk v Kč" 
          icon="💰" 
          value={weights.profit_weight} 
          colorClass="accent-emerald-500" 
          onChange={(v) => handleWeightChange('profit_weight', v)} 
        />
        <WeightSlider 
          label="Důvěryhodnost" 
          description="🛡️ Podobnost a historie inzerátů" 
          icon="🛡️" 
          value={weights.trust_weight} 
          colorClass="accent-blue-500" 
          onChange={(v) => handleWeightChange('trust_weight', v)} 
        />
        <WeightSlider 
          label="Urgence" 
          description="⚡ Stáří inzerátu a rychlost trhu" 
          icon="⚡" 
          value={weights.urgency_weight} 
          colorClass="accent-yellow-500" 
          onChange={(v) => handleWeightChange('urgency_weight', v)} 
        />
        <WeightSlider 
          label="Tržní Trend" 
          description="📈 Aktuální poptávka po modelu" 
          icon="📈" 
          value={weights.market_weight} 
          colorClass="accent-purple-500" 
          onChange={(v) => handleWeightChange('market_weight', v)} 
        />
        <WeightSlider 
          label="Vaše Kapacita" 
          description="👤 Aktuální čas na vyřízení" 
          icon="👤" 
          value={weights.capacity_weight} 
          colorClass="accent-pink-500" 
          onChange={(v) => handleWeightChange('capacity_weight', v)} 
        />
        
        {/* Tips & Education card instead of empty slot */}
        <div className="bg-sky-900/10 border border-sky-800/50 rounded-2xl p-5 flex gap-4 transition-all hover:bg-sky-900/15">
          <div className="text-2xl pt-0.5">💡</div>
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-sky-400 uppercase tracking-widest">Profesionální tip</h4>
            <p className="text-xs text-sky-200/70 leading-relaxed font-medium">
              Pokud začínáte, zvyšte váhu <strong className="text-sky-300">Důvěryhodnosti</strong> na úkor Profitu. Vyhnete se tak rizikovým obchodům s rozbitými inzeráty, které AI může špatně vyhodnotit jako ziskové.
            </p>
          </div>
        </div>
      </div>

      {/* Visual Analytics */}
      <WeightVisualization weights={weights} totalWeight={totalWeight} />

      {/* Control Footer */}
      <div className="flex justify-end items-center gap-6 pt-6 border-t border-slate-700/50">
        <button
          onClick={onSaveClick}
          disabled={saving || totalWeight !== 100}
          className={`px-8 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-xl active:scale-95 disabled:grayscale disabled:opacity-50 ${
            saving 
            ? 'bg-slate-700 cursor-wait' 
            : 'bg-emerald-600 hover:bg-emerald-500 text-white hover:shadow-emerald-500/20'
          }`}
        >
          {saving ? '📥 Synchronizuji...' : '💾 Uložit parametry'}
        </button>
      </div>
    </div>
  );
};

export default PriorityWeightsPanel;
