import React from 'react';
import { AnalyticsData } from '../../hooks/useAnalytics';

interface AnalyticsChartsSectionProps {
  analytics: AnalyticsData;
  deals: any[];
  successRate: string;
}

export const AnalyticsChartsSection: React.FC<AnalyticsChartsSectionProps> = ({ analytics, deals, successRate }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Revenue Snapshot (Mini-Chart) */}
      <div className="bg-slate-800/60 backdrop-blur-md rounded-3xl p-6 border border-slate-700/50 shadow-2xl group transition-all hover:bg-slate-800/80">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-sm font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
            <span>💰</span> Revenue Stream
          </h3>
          <span className="text-[10px] bg-emerald-950/50 text-emerald-500 px-2 py-0.5 rounded-full border border-emerald-900/50 font-black">LAST 12 DEALS</span>
        </div>
        <div className="h-44 flex items-end justify-between gap-1.5 px-1 py-1 bg-slate-900/30 rounded-2xl border border-slate-950 shadow-inner">
          {deals.slice(0, 12).map((deal, idx) => {
            const height = analytics.total_revenue > 0
              ? Math.max(8, (deal.final_profit / analytics.total_revenue) * 200) // Scaled for mini chart
              : 8;
            return (
              <div key={idx} className="flex-1 group/bar relative">
                <div
                  className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-lg transition-all duration-300 hover:from-emerald-400 hover:to-emerald-200 hover:scale-x-110 shadow-lg"
                  style={{ height: `${height}%` }}
                ></div>
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover/bar:opacity-100 transition-opacity bg-slate-950 text-[9px] font-black text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-900/50 whitespace-nowrap z-10 shadow-2xl">
                  {Math.round(deal.final_profit || 0)} <span className="opacity-60 uppercase">Kč</span>
                </div>
              </div>
            );
          })}
          {deals.length === 0 && (
            <div className="w-full h-full flex items-center justify-center text-slate-600 text-[11px] font-black uppercase tracking-widest italic opacity-50">NO TRANSACTION DATA</div>
          )}
        </div>
      </div>

      {/* Success Pulse (Circle Chart) */}
      <div className="bg-slate-800/60 backdrop-blur-md rounded-3xl p-6 border border-slate-700/50 shadow-2xl group transition-all hover:bg-slate-800/80">
        <h3 className="text-sm font-black text-yellow-500 uppercase tracking-widest flex items-center gap-2 mb-2">
          <span>🎯</span> Efficiency Index
        </h3>
        <div className="flex items-center justify-center py-6">
          <div className="relative w-44 h-44 drop-shadow-2xl">
            <svg className="w-full h-full transform -rotate-90 group-hover:scale-105 transition-transform duration-500" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#0f172a" strokeWidth="10" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke={Number(successRate) >= 70 ? '#10b981' : Number(successRate) >= 40 ? '#f59e0b' : '#ef4444'}
                strokeWidth="10"
                strokeDasharray={`${Number(successRate) * 2.64} 264`}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out shadow-lg"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-4xl font-black text-white tracking-tighter tabular-nums drop-shadow-md">{successRate}<span className="text-lg opacity-40">%</span></div>
              <div className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1 italic">Win Rate</div>
            </div>
          </div>
        </div>
        <div className="flex justify-center gap-6 mt-2">
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-900/10 rounded-full border border-emerald-800/20">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Done <span className="text-emerald-400">({analytics.closed_deals})</span></span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-900/40 rounded-full border border-slate-800/50">
            <div className="w-2 h-2 rounded-full bg-slate-600"></div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active <span className="text-slate-200">({analytics.total_deals - analytics.closed_deals})</span></span>
          </div>
        </div>
      </div>

      {/* Velocity Timeline (Mini-Bars) */}
      <div className="bg-slate-800/60 backdrop-blur-md rounded-3xl p-6 border border-slate-700/50 shadow-2xl group transition-all hover:bg-slate-800/80">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-sm font-black text-purple-400 uppercase tracking-widest flex items-center gap-2">
            <span>⏱️</span> Velocity Monitor
          </h3>
          <span className="text-[9px] bg-purple-900/30 text-purple-400 px-2.5 py-1 rounded-lg border border-purple-800/30 font-bold uppercase">HOURS TO CLOSE</span>
        </div>
        <div className="h-44 flex items-end gap-3 px-2 py-1 bg-slate-950/20 rounded-2xl shadow-inner border border-slate-900/50">
          {deals.filter(d => d.time_to_close_hours).slice(0, 8).map((deal, idx) => {
            const hours = Math.round(deal.time_to_close_hours);
            const maxVal = Math.max(...deals.map(d => d.time_to_close_hours || 0), 1);
            const height = (hours / maxVal) * 100;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center group/vel relative">
                <div className="text-[9px] font-black text-slate-600 mb-1.5 font-mono tabular-nums opacity-0 group-hover/vel:opacity-100 transition-opacity">{hours}h</div>
                <div
                  className="w-full bg-gradient-to-t from-purple-700 to-indigo-400 rounded-t-lg transition-all duration-500 hover:from-purple-400 hover:to-white hover:brightness-125 shadow-lg group-hover/vel:scale-x-105"
                  style={{ height: `${height}%` }}
                ></div>
                <div className="text-[8px] text-slate-700 font-black mt-2">#{idx + 1}</div>
              </div>
            );
          })}
          {deals.filter(d => d.time_to_close_hours).length === 0 && (
            <div className="w-full h-full flex items-center justify-center text-slate-600 text-[11px] font-black uppercase tracking-widest italic opacity-50">NO VELOCITY DATA</div>
          )}
        </div>
      </div>

      {/* Profit Distribution (Horizontal Bars) */}
      <div className="bg-slate-800/60 backdrop-blur-md rounded-3xl p-6 border border-slate-700/50 shadow-2xl group transition-all hover:bg-slate-800/80">
        <h3 className="text-sm font-black text-sky-300 uppercase tracking-widest flex items-center gap-2 mb-6">
          <span>📈</span> Net Profit Segment
        </h3>
        <div className="space-y-5 px-1">
          {(() => {
            const ranges = [
              { label: 'High Tier (> 5k)', min: 5000, count: 0, color: 'from-emerald-600 to-emerald-400' },
              { label: 'Mid Tier (2k - 5k)', min: 2000, max: 5000, count: 0, color: 'from-sky-600 to-sky-400' },
              { label: 'Entry (1k - 2k)', min: 1000, max: 2000, count: 0, color: 'from-yellow-600 to-yellow-400' },
              { label: 'Micro (< 1k)', min: 0, max: 1000, count: 0, color: 'from-rose-600 to-rose-400' },
            ];
            deals.forEach(deal => {
              const profit = deal.final_profit || 0;
              ranges.forEach(range => {
                if (range.max === undefined) { if (profit >= range.min) range.count++; } 
                else if (profit >= range.min && profit < range.max) { range.count++; }
              });
            });
            const maxCount = Math.max(...ranges.map(r => r.count), 1);
            return ranges.map((range, idx) => (
              <div key={idx} className="space-y-1.5 group/range">
                <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-500 group-hover/range:text-slate-300 transition-colors">
                  <span>{range.label}</span>
                  <span className="tabular-nums text-slate-300">{range.count} DEALS</span>
                </div>
                <div className="relative h-2 bg-slate-950/40 rounded-full border border-slate-800/50 overflow-hidden shadow-inner">
                  <div
                    className={`bg-gradient-to-r ${range.color} h-full rounded-full transition-all duration-1000 ease-out shadow-lg`}
                    style={{ width: `${(range.count / maxCount) * 100}%` }}
                  ></div>
                </div>
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
};
