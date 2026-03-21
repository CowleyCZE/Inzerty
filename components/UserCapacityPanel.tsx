import React from 'react';
import { useUserCapacity } from '../hooks/useUserCapacity';

interface UserCapacityPanelProps {
  onCapacityChange?: (capacity: any) => void;
}

const UserCapacityPanel: React.FC<UserCapacityPanelProps> = ({ onCapacityChange }) => {
  const {
    capacity,
    loading,
    saving,
    handleMaxDealsChange,
    toggleBrand,
    handleSave,
  } = useUserCapacity(onCapacityChange);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'volný': return 'text-emerald-400';
      case 'vytížený': return 'text-yellow-400';
      case 'plný': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  const brands = ['Apple', 'Samsung', 'Huawei', 'Xiaomi', 'Motorola', 'Nokia', 'Sony', 'Oppo', 'Realme', 'OnePlus'];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 bg-slate-800 rounded-2xl border border-slate-700 animate-pulse shadow-xl">
        <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-4 shadow-lg shadow-sky-500/20"></div>
        Načítám parametry kapacity...
      </div>
    );
  }

  const onSaveClick = async () => {
    const success = await handleSave();
    if (success) {
      alert('👤 Parametry kapacity byly uloženy!');
    } else {
      alert('❌ Chyba při ukládání kapacity.');
    }
  };

  return (
    <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-slate-700 shadow-2xl space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      
      {/* Header section */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700/50 pb-6">
        <div className="flex items-center gap-4">
          <div className="text-3xl p-3 bg-sky-900/40 text-sky-400 border border-sky-800 rounded-2xl shadow-inner">👤</div>
          <div>
            <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400 tracking-tight">
              Kapacita & Preference
            </h3>
            <p className="text-slate-400 text-sm mt-0.5 max-w-xs font-medium leading-relaxed opacity-80 italic">
              Nastavte si limity pro aktivní obchody a preferované značky.
            </p>
          </div>
        </div>
      </div>

      {/* Capacity Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Maximální limit', val: capacity.max_active_deals, color: 'text-white' },
          { label: 'V řešení', val: capacity.current_active_deals, color: 'text-blue-400' },
          { label: 'Volná místa', val: capacity.available_capacity, color: getStatusColor(capacity.workload_status) },
        ].map((item, idx) => (
          <div key={idx} className="bg-slate-900/50 rounded-2xl p-5 border border-slate-700/50 shadow-inner group hover:bg-slate-900/80 transition-all">
            <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">{item.label}</div>
            <div className={`text-3xl font-black ${item.color} tabular-nums group-hover:scale-110 transition-transform origin-left`}>{item.val}</div>
          </div>
        ))}
      </div>

      {/* Workload Status Banner */}
      <div className={`p-6 rounded-2xl border-2 transition-all shadow-lg ${
        capacity.workload_status === 'volný' ? 'bg-emerald-900/10 border-emerald-600/40 shadow-emerald-500/5' :
        capacity.workload_status === 'vytížený' ? 'bg-yellow-900/10 border-yellow-600/40 shadow-yellow-500/5' :
        'bg-rose-900/10 border-rose-600/40 shadow-rose-500/5 animate-pulse'
      }`}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className={`text-4xl p-2 rounded-2xl bg-slate-950/50 border border-white/5`}>
              {capacity.workload_status === 'volný' ? '🟢' : capacity.workload_status === 'vytížený' ? '🟡' : '🔴'}
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Aktuální vytížení</div>
              <div className={`text-xl font-black ${getStatusColor(capacity.workload_status)}`}>
                {capacity.workload_status === 'volný' && 'Můžete přijímat nové obchody'}
                {capacity.workload_status === 'vytížený' && 'Šetřete síly, jste vytížen(a)'}
                {capacity.workload_status === 'plný' && 'STOP! Kapacita zcela vyčerpána'}
              </div>
            </div>
          </div>
          <div className="text-center sm:text-right bg-slate-950/30 px-6 py-3 rounded-2xl border border-white/5 shadow-inner">
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none mb-1">Využití</div>
            <div className={`text-3xl font-black tabular-nums ${getStatusColor(capacity.workload_status)}`}>
              {Math.round(capacity.capacity_percentage)}%
            </div>
          </div>
        </div>
      </div>

      {/* Adjust Capacity Slider */}
      <div className="bg-slate-900/40 rounded-2xl p-6 border border-slate-700/50 shadow-inner group">
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm font-black text-slate-300 uppercase tracking-wider">
            Změnit maximální limit obchodů
          </label>
          <div className="bg-sky-500/10 text-sky-400 px-4 py-1 rounded-full border border-sky-600 text-xl font-black tabular-nums">
            {capacity.max_active_deals}
          </div>
        </div>
        <div className="relative h-2 rounded-full overflow-hidden bg-slate-800 border border-slate-700">
           <input
            type="range"
            min="1"
            max="50"
            value={capacity.max_active_deals}
            onChange={(e) => handleMaxDealsChange(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 appearance-none"
          />
          <div 
             className="h-full bg-sky-500 transition-all duration-300 shadow-lg shadow-sky-500/30"
             style={{ width: `${(capacity.max_active_deals / 50) * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-600 font-bold uppercase mt-2 px-1">
          <span>1</span>
          <span>25</span>
          <span>50</span>
        </div>
      </div>

      {/* Preferred Brands Selector */}
      <div className="bg-slate-900/40 rounded-2xl p-6 border border-slate-700/50 shadow-inner">
        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Prioritní značky k nákupu</h4>
        <div className="flex flex-wrap gap-2">
          {brands.map((brand) => (
            <button
              key={brand}
              onClick={() => toggleBrand(brand)}
              className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-200 border transform active:scale-90 ${
                capacity.preferred_brands.includes(brand)
                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500'
              }`}
            >
              {brand}
            </button>
          ))}
        </div>
      </div>

      {/* Footer Info & Action */}
      <div className="flex flex-wrap lg:flex-nowrap gap-6 items-center pt-6 border-t border-slate-700/50">
        <div className="flex-1 bg-sky-950/20 border border-sky-900/50 rounded-2xl p-4 flex gap-4 transition-all hover:bg-sky-900/30">
           <div className="text-2xl mt-0.5">💡</div>
           <p className="text-xs text-sky-200/70 font-medium leading-relaxed italic">
             Preference značek ovlivňují AI Prioritizaci. Značky, které označíte jako oblíbené, budou mít ve výchozím nastavení skóre priority o <strong>+15 bodů</strong> vyšší.
           </p>
        </div>
        
        <button
          onClick={onSaveClick}
          disabled={saving}
          className={`whitespace-nowrap px-8 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-xl active:scale-95 disabled:grayscale disabled:opacity-50 ${
            saving 
            ? 'bg-slate-700 cursor-wait' 
            : 'bg-emerald-600 hover:bg-emerald-500 text-white hover:shadow-emerald-500/20'
          }`}
        >
          {saving ? '📥 Synchronizuji...' : '💾 Uložit nastavení'}
        </button>
      </div>
    </div>
  );
};

export default UserCapacityPanel;
