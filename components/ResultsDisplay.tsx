import React, { useState } from 'react';
import { Ad } from '../types';

interface ResultsDisplayProps {
  matchedAds: { offer: Ad; demand: Ad; arbitrageScore?: number }[];
  isLoading?: boolean;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ matchedAds, isLoading }) => {
  const [minProfit, setMinProfit] = useState<number>(0);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  if (!matchedAds || matchedAds.length === 0) {
    return (
      <div className="bg-slate-800 p-8 rounded-xl shadow-2xl mt-8 text-center border border-slate-700">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mx-auto text-slate-500 mb-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-xl text-slate-300">Zatím nebyly nalezeny žádné shody.</p>
        <p className="text-slate-500 mt-2">Spusťte porovnávání pro analýzu inzerátů.</p>
      </div>
    );
  }

  const filteredMatches = matchedAds.filter(match => (match.arbitrageScore || 0) >= minProfit);

  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-2xl mt-8 border border-slate-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-700 pb-4">
        <h2 className="text-2xl font-semibold text-emerald-400 flex items-center mb-4 md:mb-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 mr-2">
            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
          </svg>
          Nalezené Arbitrážní Příležitosti ({filteredMatches.length})
        </h2>
        
        <div className="flex items-center space-x-3 bg-slate-900 p-2 rounded-lg border border-slate-700">
          <label htmlFor="minProfit" className="text-sm font-medium text-slate-300">Minimální zisk:</label>
          <input
            type="number"
            id="minProfit"
            value={minProfit}
            onChange={(e) => setMinProfit(Number(e.target.value))}
            className="w-24 bg-slate-700 border border-slate-600 text-emerald-400 font-bold rounded p-1 text-sm focus:ring-emerald-500 focus:border-emerald-500"
            step="500"
            min="0"
          />
          <span className="text-slate-400 text-sm">Kč</span>
        </div>
      </div>

      <div className="space-y-6">
        {filteredMatches.map((match, index) => (
          <div key={index} className="bg-slate-700/50 rounded-xl p-5 border border-slate-600 hover:border-emerald-500/50 transition-colors">
            
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-600">
              <span className="px-3 py-1 bg-slate-900 rounded-full text-xs font-medium text-slate-300 flex items-center">
                <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                Podobnost: {match.offer.similarity || 'N/A'}%
                {(match.offer as any).ai && <span className="ml-2 text-fuchsia-400 border border-fuchsia-400/30 px-1.5 rounded text-[10px]">AI</span>}
              </span>
              
              <div className="text-right">
                <span className="text-xs text-slate-400 block uppercase tracking-wider font-semibold">Potenciální Zisk</span>
                <span className="text-xl font-bold text-emerald-400">
                  +{match.arbitrageScore?.toLocaleString('cs-CZ')} Kč
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Nabídka (Koupit) */}
              <div className="bg-slate-800 rounded-lg p-4 border-l-4 border-sky-500">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-sky-400 bg-sky-900/30 px-2 py-1 rounded">Nabídka (Koupit)</span>
                  <span className="font-bold text-lg text-slate-100">{match.offer.price}</span>
                </div>
                <h4 className="font-medium text-slate-200 mb-2">{match.offer.title}</h4>
                <p className="text-sm text-slate-400 line-clamp-2 mb-3">{match.offer.description}</p>
                <a 
                  href={match.offer.link || match.offer.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-sky-400 hover:text-sky-300"
                >
                  Otevřít inzerát
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 ml-1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              </div>

              {/* Poptávka (Prodat) */}
              <div className="bg-slate-800 rounded-lg p-4 border-l-4 border-purple-500">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-400 bg-purple-900/30 px-2 py-1 rounded">Poptávka (Prodat)</span>
                  <span className="font-bold text-lg text-slate-100">{match.demand.price}</span>
                </div>
                <h4 className="font-medium text-slate-200 mb-2">{match.demand.title}</h4>
                <p className="text-sm text-slate-400 line-clamp-2 mb-3">{match.demand.description}</p>
                <a 
                  href={match.demand.link || match.demand.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-purple-400 hover:text-purple-300"
                >
                  Otevřít inzerát
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 ml-1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResultsDisplay;
