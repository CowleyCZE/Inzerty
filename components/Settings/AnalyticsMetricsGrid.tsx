import React from 'react';
import { AnalyticsData } from '../../hooks/useAnalytics';

interface AnalyticsMetricsGridProps {
  analytics: AnalyticsData;
  successRate: string;
}

export const AnalyticsMetricsGrid: React.FC<AnalyticsMetricsGridProps> = ({ analytics, successRate }) => {
  const cardStyle = "bg-slate-800/60 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50 shadow-lg flex flex-col justify-between group hover:border-slate-600 transition-all";
  const labelStyle = "text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1";
  const valueStyle = "text-xl font-black tabular-nums transition-transform group-hover:scale-105 origin-left";

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className={cardStyle}>
        <div>
          <div className={labelStyle}>Celkem obchodů</div>
          <div className={`${valueStyle} text-white`}>{analytics.total_deals}</div>
        </div>
        <div className="mt-4 text-[9px] text-slate-600 font-bold uppercase italic shadow-sm shadow-black/20">Pipeline 📦</div>
      </div>
      
      <div className={cardStyle}>
        <div>
          <div className={labelStyle}>Dokončeno</div>
          <div className={`${valueStyle} text-emerald-400 font-black`}>{analytics.closed_deals}</div>
        </div>
        <div className="mt-4 text-[9px] text-emerald-900 font-black uppercase">Success ✅</div>
      </div>

      <div className={cardStyle}>
        <div>
          <div className={labelStyle}>Průměrný zisk</div>
          <div className={`${valueStyle} text-emerald-300`}>
            {analytics.avg_profit ? Math.round(analytics.avg_profit).toLocaleString() : '0'} <span className="text-xs opacity-60">Kč</span>
          </div>
        </div>
        <div className="mt-4 text-[9px] text-emerald-800 font-bold uppercase">Net Avg 💰</div>
      </div>

      <div className={cardStyle}>
        <div>
          <div className={labelStyle}>Celkový revenue</div>
          <div className={`${valueStyle} text-sky-400`}>
            {analytics.total_revenue ? Math.round(analytics.total_revenue).toLocaleString() : '0'} <span className="text-xs opacity-60">Kč</span>
          </div>
        </div>
        <div className="mt-4 text-[9px] text-sky-900 font-black uppercase italic">Gross Revenue 🌊</div>
      </div>

      <div className={cardStyle}>
        <div>
          <div className={labelStyle}>Čas k uzavření</div>
          <div className={`${valueStyle} text-purple-400`}>
            {analytics.avg_time_to_close ? Math.round(analytics.avg_time_to_close) : '0'} <span className="text-xs opacity-60">h</span>
          </div>
        </div>
        <div className="mt-4 text-[9px] text-purple-900 font-black uppercase">Efficiency ⏱️</div>
      </div>

      <div className={`${cardStyle} border-yellow-900/40`}>
        <div>
          <div className={labelStyle}>Úspěšnost</div>
          <div className={`${valueStyle} text-yellow-400`}>{successRate}%</div>
        </div>
        <div className="mt-4 text-[9px] text-yellow-900 font-black uppercase">Win Rate 🎯</div>
      </div>
    </div>
  );
};
