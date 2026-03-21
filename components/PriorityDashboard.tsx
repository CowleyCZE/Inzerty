import React from 'react';
import { usePriorityDashboard } from '../hooks/usePriorityDashboard';

// Sub-components
import { PriorityStatsGrid } from './PriorityDashboard/PriorityStatsGrid';
import { PriorityMatchTable } from './PriorityDashboard/PriorityMatchTable';

// Lazy-loaded or separate panels
import UserCapacityPanel from './UserCapacityPanel';
import HistoricalAccuracyPanel from './HistoricalAccuracyPanel';
import AutoPrioritizationPanel from './AutoPrioritizationPanel';
import RealMarketTrendsPanel from './RealMarketTrendsPanel';

const PriorityDashboard: React.FC = () => {
  const {
    stats,
    filter,
    setFilter,
    loading,
    recalculating,
    activeTab,
    setActiveTab,
    filteredMatches,
    recalculateAll,
  } = usePriorityDashboard();

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'prioritize': return 'bg-emerald-600 shadow-emerald-900/40';
      case 'normal': return 'bg-blue-600 shadow-blue-900/40';
      case 'skip': return 'bg-rose-600 shadow-rose-900/40';
      default: return 'bg-slate-600';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]';
    if (score >= 60) return 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.3)]';
    if (score >= 40) return 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.3)]';
    return 'text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,113,0.3)]';
  };

  if (loading && !recalculating) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-400 animate-pulse bg-slate-900/20 rounded-3xl border border-slate-800 shadow-2xl">
        <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-6 shadow-lg shadow-sky-500/20"></div>
        <div className="text-sm font-black uppercase tracking-widest text-sky-400">Analýza priorit v reálném čase...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      
      {/* Header with Glassmorphism Navigation */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 bg-slate-800/40 backdrop-blur-xl p-3 pl-6 pr-3 rounded-2xl border border-slate-700/50 shadow-2xl sticky top-4 z-40">
        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400 flex items-center gap-3 tracking-tighter uppercase italic">
          <span className="text-3xl not-italic">🎯</span>
          AI Dashboard
        </h2>
        
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/40 rounded-xl border border-slate-800/50 shadow-inner overflow-x-auto w-full lg:w-auto no-scrollbar">
          {[
            { id: 'overview', label: '📊 Přehled', color: 'sky' },
            { id: 'capacity', label: '👤 Kapacita', color: 'indigo' },
            { id: 'accuracy', label: '📈 Přesnost', color: 'emerald' },
            { id: 'auto', label: '🤖 Autopilot', color: 'amber' },
            { id: 'trends', label: '🌊 Trendy', color: 'purple' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`whitespace-nowrap px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                activeTab === tab.id 
                  ? `bg-${tab.color}-600/20 text-${tab.color}-400 ring-2 ring-${tab.color}-600/40 shadow-xl shadow-${tab.color}-900/10` 
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content Orchestrator */}
      {activeTab === 'overview' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="px-2">
              <h3 className="text-xl font-black text-slate-100 uppercase tracking-tighter italic">Analytický Report</h3>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-0.5 ml-0.5">Stav k: {new Date().toLocaleDateString('cs-CZ')}</p>
            </div>
            
            <button
              onClick={recalculateAll}
              disabled={recalculating}
              className={`group flex items-center gap-2 px-6 py-2.5 rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-xl active:scale-95 disabled:grayscale ${
                recalculating 
                ? 'bg-slate-700 animate-pulse cursor-wait' 
                : 'bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white hover:shadow-sky-500/20'
              }`}
            >
              <span className={`text-sm transition-transform duration-700 ${recalculating ? 'animate-spin' : 'group-hover:rotate-180'}`}>🔄</span>
              {recalculating ? 'Probíhá výpočet...' : 'Přepočítat AI modely'}
            </button>
          </div>

          <PriorityStatsGrid stats={stats} getScoreColor={getScoreColor} />

          {/* Table Controls (Glow Filter Bar) */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-900/50 p-2 rounded-2xl border border-slate-800 shadow-inner">
             <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-4 mr-2">Filtr Segmentu:</span>
             {[
               { id: 'all', label: 'VŠECHNO', count: stats?.totalMatches || 0, color: 'sky' },
               { id: 'prioritize', label: '🔥 PRIORITNÍ', count: stats?.prioritizeCount || 0, color: 'emerald' },
               { id: 'normal', label: '📋 NORMÁLNÍ', count: stats?.normalCount || 0, color: 'blue' },
               { id: 'skip', label: '⚠️ IGNOROVAT', count: stats?.skipCount || 0, color: 'rose' },
             ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setFilter(btn.id as any)}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${
                    filter === btn.id 
                    ? `bg-${btn.color}-600/30 text-${btn.color}-400 ring-1 ring-${btn.color}-600/50 shadow-lg` 
                    : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {btn.label} <span className="opacity-40 tabular-nums">({btn.count})</span>
                </button>
             ))}
          </div>

          <PriorityMatchTable 
            matches={filteredMatches} 
            getRecommendationColor={getRecommendationColor} 
            getScoreColor={getScoreColor} 
          />
        </div>
      )}

      {/* Panels for other tabs (placeholder support) */}
      <div className="animate-in fade-in duration-500">
        {activeTab === 'capacity' && <UserCapacityPanel />}
        {activeTab === 'accuracy' && <HistoricalAccuracyPanel />}
        {activeTab === 'auto' && <AutoPrioritizationPanel />}
        {activeTab === 'trends' && <RealMarketTrendsPanel />}
      </div>

    </div>
  );
};

export default PriorityDashboard;
