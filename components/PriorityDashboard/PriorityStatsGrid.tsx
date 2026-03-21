import React from 'react';
import { PriorityStats } from '../../hooks/usePriorityDashboard';

interface PriorityStatsGridProps {
  stats: PriorityStats | null;
  getScoreColor: (score: number) => string;
}

export const PriorityStatsGrid: React.FC<PriorityStatsGridProps> = ({ stats, getScoreColor }) => {
  if (!stats) return null;

  const cardStyle = "bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50 shadow-lg flex flex-col justify-between hover:border-slate-600 transition-all group";
  const labelStyle = "text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1";
  const valueStyle = "text-2xl font-black";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className={cardStyle}>
        <div>
          <div className={labelStyle}>Total</div>
          <div className={`${valueStyle} text-white`}>{stats.totalMatches}</div>
        </div>
        <div className="mt-4 text-[10px] text-slate-600 font-bold uppercase italic">Všechny shody</div>
      </div>
      
      <div className={`${cardStyle} border-emerald-900/40 hover:border-emerald-700/60`}>
        <div>
          <div className={labelStyle}>Prioritizovat</div>
          <div className={`${valueStyle} text-emerald-400`}>{stats.prioritizeCount}</div>
        </div>
        <div className="mt-4 text-[10px] text-emerald-900 font-black uppercase">Vysoký potenciál 🔥</div>
      </div>

      <div className={`${cardStyle} border-blue-900/40 hover:border-blue-700/60`}>
        <div>
          <div className={labelStyle}>Normální</div>
          <div className={`${valueStyle} text-blue-400`}>{stats.normalCount}</div>
        </div>
        <div className="mt-4 text-[10px] text-blue-900 font-black uppercase">Standardní 📋</div>
      </div>

      <div className={`${cardStyle} border-rose-900/40 hover:border-rose-700/60`}>
        <div>
          <div className={labelStyle}>Přeskočit</div>
          <div className={`${valueStyle} text-rose-400`}>{stats.skipCount}</div>
        </div>
        <div className="mt-4 text-[10px] text-rose-900 font-black uppercase">Nízký profit ⚠️</div>
      </div>

      <div className={cardStyle}>
        <div>
          <div className={labelStyle}>Avg Score</div>
          <div className={`${valueStyle} ${getScoreColor(stats.avgScore)}`}>
            {Math.round(stats.avgScore)}
          </div>
        </div>
        <div className="mt-4 text-[10px] text-slate-600 font-bold uppercase italic">Celková kvalita</div>
      </div>
    </div>
  );
};
