import React, { useMemo, useState, useEffect } from 'react';
import { Ad } from '../types';

type MatchStatus = 'new' | 'review' | 'contacted' | 'negotiation' | 'closed';

interface MatchMeta {
  status: MatchStatus;
  note: string;
}

interface ResultsDisplayProps {
  matchedAds: { offer: Ad; demand: Ad; arbitrageScore?: number }[];
  isLoading?: boolean;
}

const STORAGE_KEY = 'inzerty_match_meta_v1';

const statusLabel: Record<MatchStatus, string> = {
  new: 'Nové',
  review: 'Prověřit',
  contacted: 'Kontaktováno',
  negotiation: 'Vyjednávání',
  closed: 'Uzavřeno',
};

const statusColorClass: Record<MatchStatus, string> = {
  new: 'bg-blue-900/40 text-blue-300 border-blue-500/30',
  review: 'bg-amber-900/40 text-amber-300 border-amber-500/30',
  contacted: 'bg-purple-900/40 text-purple-300 border-purple-500/30',
  negotiation: 'bg-cyan-900/40 text-cyan-300 border-cyan-500/30',
  closed: 'bg-emerald-900/40 text-emerald-300 border-emerald-500/30',
};

const getMatchKey = (offer: Ad, demand: Ad) => `${offer.url || offer.id}__${demand.url || demand.id}`;

const loadInitialMeta = (): Record<string, MatchMeta> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, MatchMeta>;
  } catch {
    return {};
  }
};

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ matchedAds, isLoading }) => {
  const [minProfit, setMinProfit] = useState<number>(0);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [hideResolved, setHideResolved] = useState<boolean>(false);
  const [metaByMatch, setMetaByMatch] = useState<Record<string, MatchMeta>>(() => loadInitialMeta());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(metaByMatch));
  }, [metaByMatch]);

  const updateMatchMeta = (key: string, partial: Partial<MatchMeta>) => {
    setMetaByMatch((prev) => {
      const current = prev[key] || { status: 'new', note: '' };
      return {
        ...prev,
        [key]: {
          ...current,
          ...partial,
        },
      };
    });
  };

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

  const filteredMatches = useMemo(() => {
    return matchedAds
      .filter((match) => (match.arbitrageScore || 0) >= minProfit)
      .filter((match) => {
        if (!hideResolved) return true;
        const key = getMatchKey(match.offer, match.demand);
        return (metaByMatch[key]?.status || 'new') !== 'closed';
      })
      .sort((a, b) => sortOrder === 'desc'
        ? (b.arbitrageScore || 0) - (a.arbitrageScore || 0)
        : (a.arbitrageScore || 0) - (b.arbitrageScore || 0));
  }, [matchedAds, minProfit, sortOrder, hideResolved, metaByMatch]);

  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-2xl mt-8 border border-slate-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-700 pb-4 gap-3">
        <h2 className="text-2xl font-semibold text-emerald-400 flex items-center mb-2 md:mb-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 mr-2">
            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
          </svg>
          Akční fronta arbitrážních příležitostí ({filteredMatches.length})
        </h2>

        <div className="flex flex-wrap items-center gap-3 bg-slate-900 p-2 rounded-lg border border-slate-700">
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

          <label htmlFor="sortOrder" className="text-sm font-medium text-slate-300 ml-2">Řazení:</label>
          <select
            id="sortOrder"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
            className="bg-slate-700 border border-slate-600 text-slate-100 rounded p-1 text-sm focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="desc">Nejvyšší zisk</option>
            <option value="asc">Nejnižší zisk</option>
          </select>

          <label className="inline-flex items-center gap-2 text-sm text-slate-300 ml-1">
            <input
              type="checkbox"
              checked={hideResolved}
              onChange={(e) => setHideResolved(e.target.checked)}
            />
            Skrýt vyřešené
          </label>
        </div>
      </div>

      <div className="space-y-6">
        {filteredMatches.map((match, index) => {
          const matchKey = getMatchKey(match.offer, match.demand);
          const meta = metaByMatch[matchKey] || { status: 'new' as MatchStatus, note: '' };

          return (
            <div key={matchKey || index} className="bg-slate-700/50 rounded-xl p-5 border border-slate-600 hover:border-emerald-500/50 transition-colors">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4 pb-3 border-b border-slate-600">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 bg-slate-900 rounded-full text-xs font-medium text-slate-300 flex items-center">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                    Podobnost: {match.offer.similarity || 'N/A'}%
                    {(match.offer as any).ai && <span className="ml-2 text-fuchsia-400 border border-fuchsia-400/30 px-1.5 rounded text-[10px]">AI</span>}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs border ${statusColorClass[meta.status]}`}>
                    Stav: {statusLabel[meta.status]}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-400 block uppercase tracking-wider font-semibold">Potenciální Zisk</span>
                  <span className="text-xl font-bold text-emerald-400">+{match.arbitrageScore?.toLocaleString('cs-CZ')} Kč</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
                <div className="bg-slate-800 rounded-lg p-4 border-l-4 border-sky-500">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-400 bg-sky-900/30 px-2 py-1 rounded">Nabídka (Koupit)</span>
                    <span className="font-bold text-lg text-slate-100">{match.offer.price}</span>
                  </div>
                  <h4 className="font-medium text-slate-200 mb-2">{match.offer.title}</h4>
                  <p className="text-sm text-slate-400 line-clamp-2 mb-3">{match.offer.description}</p>
                  <a href={match.offer.link || match.offer.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-sm text-sky-400 hover:text-sky-300">
                    Otevřít inzerát
                  </a>
                </div>

                <div className="bg-slate-800 rounded-lg p-4 border-l-4 border-purple-500">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-400 bg-purple-900/30 px-2 py-1 rounded">Poptávka (Prodat)</span>
                    <span className="font-bold text-lg text-slate-100">{match.demand.price}</span>
                  </div>
                  <h4 className="font-medium text-slate-200 mb-2">{match.demand.title}</h4>
                  <p className="text-sm text-slate-400 line-clamp-2 mb-3">{match.demand.description}</p>
                  <a href={match.demand.link || match.demand.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-sm text-purple-400 hover:text-purple-300">
                    Otevřít inzerát
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Stav příležitosti</label>
                  <select
                    value={meta.status}
                    onChange={(e) => updateMatchMeta(matchKey, { status: e.target.value as MatchStatus })}
                    className="w-full bg-slate-900 border border-slate-600 text-slate-100 rounded p-2 text-sm"
                  >
                    <option value="new">Nové</option>
                    <option value="review">Prověřit</option>
                    <option value="contacted">Kontaktováno</option>
                    <option value="negotiation">Vyjednávání</option>
                    <option value="closed">Uzavřeno</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Poznámka</label>
                  <input
                    value={meta.note}
                    onChange={(e) => updateMatchMeta(matchKey, { note: e.target.value })}
                    placeholder="např. volat večer / čeká na odpověď"
                    className="w-full bg-slate-900 border border-slate-600 text-slate-100 rounded p-2 text-sm"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ResultsDisplay;
