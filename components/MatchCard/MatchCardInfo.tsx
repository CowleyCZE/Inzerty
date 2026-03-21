import React from 'react';
import { MatchItem } from '../../types';

interface MatchCardInfoProps {
  match: MatchItem;
}

export const MatchCardInfo: React.FC<MatchCardInfoProps> = ({ match }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
      <div className="bg-slate-800 rounded-lg p-3 group hover:bg-slate-750 transition-colors border border-transparent hover:border-slate-600">
        <div className="flex justify-between items-start mb-1">
          <b className="text-sky-400">Nabídka</b>
          <span className="text-xs text-slate-500">{match.offer.source}</span>
        </div>
        <div className="text-slate-200 font-medium mb-1 line-clamp-1" title={match.offer.title}>{match.offer.title}</div>
        <div className="flex justify-between text-sm">
          <span className="text-emerald-400 font-bold">{match.offer.price}</span>
          <span className="text-slate-400">{match.offer.location}</span>
        </div>
        <a 
          className="text-sky-400 text-xs mt-2 inline-block hover:underline" 
          target="_blank" 
          rel="noopener noreferrer"
          href={match.offer.link || match.offer.url}
        >
          Otevřít inzerát ↗
        </a>
      </div>

      <div className="bg-slate-800 rounded-lg p-3 group hover:bg-slate-750 transition-colors border border-transparent hover:border-slate-600">
        <div className="flex justify-between items-start mb-1">
          <b className="text-purple-400">Poptávka</b>
          <span className="text-xs text-slate-500">{match.demand.source}</span>
        </div>
        <div className="text-slate-200 font-medium mb-1 line-clamp-1" title={match.demand.title}>{match.demand.title}</div>
        <div className="flex justify-between text-sm">
          <span className="text-emerald-400 font-bold">{match.demand.price}</span>
          <span className="text-slate-400">{match.demand.location}</span>
        </div>
        <a 
          className="text-purple-400 text-xs mt-2 inline-block hover:underline" 
          target="_blank" 
          rel="noopener noreferrer"
          href={match.demand.link || match.demand.url}
        >
          Otevřít inzerát ↗
        </a>
      </div>
    </div>
  );
};
