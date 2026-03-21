import React from 'react';
import { useAnalytics } from '../hooks/useAnalytics';

// Sub-components
import { AnalyticsMetricsGrid } from './Settings/AnalyticsMetricsGrid';
import { AnalyticsChartsSection } from './Settings/AnalyticsChartsSection';

interface AnalyticsChartsProps {
  period?: number; // days, default 30
}

const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ period = 30 }) => {
  const { analytics, deals, loading } = useAnalytics(period);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-slate-900/20 rounded-3xl border border-slate-800 animate-pulse shadow-2xl">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-6 shadow-lg shadow-emerald-500/20"></div>
        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">Archivace & Výpočty metrik...</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-slate-800/20 rounded-3xl border border-slate-700 shadow-xl">
        <div className="text-4xl mb-4 grayscale opacity-40">📊</div>
        <div className="text-xs font-black uppercase tracking-widest text-slate-500">Žádná analytická data k dispozici</div>
      </div>
    );
  }

  const successRate = analytics.total_deals > 0
    ? ((analytics.closed_deals / analytics.total_deals) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-700/50 pb-6 px-2">
        <div>
          <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-sky-400 uppercase tracking-tighter italic">Obchodní Analytika</h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-0.5 ml-0.5 opacity-80 leading-none">Historický přehled transakcí a výkonnosti</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 border border-slate-800 rounded-full shadow-inner">
           <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sledované období:</span>
           <span className="text-[10px] bg-sky-950/40 text-sky-400 px-2.5 py-0.5 rounded-full border border-sky-900/50 font-black tabular-nums">{period} DNÍ</span>
        </div>
      </div>

      <AnalyticsMetricsGrid analytics={analytics} successRate={successRate} />
      
      <div className="mt-8">
        <AnalyticsChartsSection analytics={analytics} deals={deals} successRate={successRate} />
      </div>

      <div className="bg-slate-950/30 border border-slate-900 rounded-2xl p-4 flex gap-4 items-center group transition-colors hover:bg-slate-950/50">
        <div className="text-xl pl-2 group-hover:scale-110 transition-transform">📊</div>
        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest italic leading-relaxed">
          Tato data jsou generována z historických logů a stavu "DOKONČENO" v databázi. 
          Případné anomálie v datech mohou být způsobeny ručními úpravami v souboru <code className="text-slate-500 font-mono">matches.json</code>.
        </p>
      </div>
    </div>
  );
};

export default AnalyticsCharts;
