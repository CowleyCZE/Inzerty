import React from 'react';
import { PrioritizedMatch } from '../../hooks/usePriorityDashboard';

interface PriorityMatchTableProps {
  matches: PrioritizedMatch[];
  getRecommendationColor: (rec: string) => string;
  getScoreColor: (score: number) => string;
}

export const PriorityMatchTable: React.FC<PriorityMatchTableProps> = ({
  matches, getRecommendationColor, getScoreColor,
}) => {
  return (
    <div className="bg-slate-800/60 backdrop-blur-md rounded-3xl border border-slate-700/50 overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-500">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900/80 border-b border-slate-700/50">
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Stav AI</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Inzeráty (Nabídka / Poptávka)</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Brutto Zisk</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">AI Skóre</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Datum zájmu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {matches.map((match) => (
              <tr
                key={match.matchKey}
                className={`group transition-all hover:bg-slate-700/40 cursor-default ${
                  match.recommendation === 'prioritize' ? 'bg-emerald-900/5' :
                  match.recommendation === 'skip' ? 'bg-rose-900/5' : ''
                }`}
              >
                <td className="px-6 py-5 whitespace-nowrap">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${getRecommendationColor(match.recommendation)} text-white shadow-lg shadow-black/20`}>
                    <span>{match.recommendation === 'prioritize' ? '🔥' : match.recommendation === 'skip' ? '⚠️' : '📋'}</span>
                    {match.recommendation === 'prioritize' ? 'Prioritizovat' : match.recommendation === 'skip' ? 'Ignorovat' : 'Normální'}
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="flex flex-col gap-1">
                    <div className="text-sm text-slate-100 font-bold group-hover:text-sky-300 transition-colors">{match.offer.title}</div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                      <span className="bg-slate-900 px-1.5 rounded border border-slate-800 text-sky-400">{match.offer.price}</span>
                      <span>↔️</span>
                      <span className="text-slate-400 italic">{match.demand.title}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5 whitespace-nowrap">
                  <div className="text-md font-black text-emerald-400 tabular-nums">
                    +{match.arbitrageScore.toLocaleString()} <span className="text-[10px] font-bold opacity-60">Kč</span>
                  </div>
                </td>
                <td className="px-6 py-5 whitespace-nowrap text-center">
                  <div className={`text-2xl font-black tabular-nums transition-transform group-hover:scale-125 ${getScoreColor(match.overallScore)}`}>
                    {match.overallScore}
                  </div>
                </td>
                <td className="px-6 py-5 whitespace-nowrap">
                  <div className="text-[11px] font-bold text-slate-500 font-mono">
                    {new Date(match.calculatedAt).toLocaleString('cs-CZ', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {matches.length === 0 && (
        <div className="text-center py-20 bg-slate-800/20 backdrop-blur-sm">
          <div className="text-4xl mb-4 grayscale opacity-40">🌙</div>
          <div className="text-slate-500 text-sm font-bold uppercase tracking-widest">Žádná relevantní data k zobrazení</div>
          <div className="text-slate-600 text-xs mt-2 italic">Zkuste přepočítat priority nebo upravit váhy v nastavení.</div>
        </div>
      )}
    </div>
  );
};
