import React from 'react';

interface MatchFiltersProps {
  minProfit: number;
  setMinProfit: (v: number) => void;
  sortBy: 'profit' | 'opportunity';
  setSortBy: (v: 'profit' | 'opportunity') => void;
  hideResolved: boolean;
  setHideResolved: (v: boolean) => void;
  hidePreviouslySeen: boolean;
  setHidePreviouslySeen: (v: boolean) => void;
  previouslySeenCount: number;
  signature: string;
  setSignature: (v: string) => void;
}

export const MatchFilters: React.FC<MatchFiltersProps> = ({
  minProfit,
  setMinProfit,
  sortBy,
  setSortBy,
  hideResolved,
  setHideResolved,
  hidePreviouslySeen,
  setHidePreviouslySeen,
  previouslySeenCount,
  signature,
  setSignature,
}) => {
  return (
    <div className="grid md:grid-cols-4 gap-2 mb-4">
      <input 
        type="number" 
        value={minProfit} 
        onChange={(e) => setMinProfit(Number(e.target.value))} 
        className="bg-slate-900 border border-slate-700 rounded p-2" 
        placeholder="Min zisk" 
      />
      <select 
        value={sortBy} 
        onChange={(e) => setSortBy(e.target.value as 'profit' | 'opportunity')} 
        className="bg-slate-900 border border-slate-700 rounded p-2"
      >
        <option value="opportunity">Řadit dle opportunity score</option>
        <option value="profit">Řadit dle zisku</option>
      </select>
      <label className="flex items-center gap-2 text-sm">
        <input 
          type="checkbox" 
          checked={hideResolved} 
          onChange={(e) => setHideResolved(e.target.checked)} 
        /> 
        Skrýt vyřešené
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input 
          type="checkbox" 
          checked={hidePreviouslySeen} 
          onChange={(e) => setHidePreviouslySeen(e.target.checked)} 
        /> 
        Skrýt dříve zobrazené ({previouslySeenCount})
      </label>
      <input 
        value={signature} 
        onChange={(e) => setSignature(e.target.value)} 
        className="bg-slate-900 border border-slate-700 rounded p-2" 
        placeholder="Podpis do šablon" 
      />
    </div>
  );
};
