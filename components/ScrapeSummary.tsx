import React from 'react';
import { ScrapeSummaryData } from '../types';

interface ScrapeSummaryProps {
  summary: ScrapeSummaryData | null;
}

const ScrapeSummary: React.FC<ScrapeSummaryProps> = ({ summary }) => {
  if (!summary) return null;

  return (
    <div className="my-4 p-4 bg-slate-800 rounded-lg shadow-inner">
      <h2 className="text-xl font-semibold text-sky-400 mb-2">Výsledky scrapování</h2>
      <p className="text-slate-300">Načtené nabídky: {summary.nabidka}.</p>
      <p className="text-slate-300">Načtené poptávky: {summary.poptavka}.</p>
      <p className="text-emerald-300 mt-2">Uložené nabídky do DB: {summary.savedNabidka ?? 0}.</p>
      <p className="text-emerald-300">Uložené poptávky do DB: {summary.savedPoptavka ?? 0}.</p>
      {summary.healthWarning ? (
        <div className="mt-3 rounded-md border border-amber-500/50 bg-amber-900/30 p-3 text-amber-200 text-sm">
          ⚠️ {summary.healthWarning}
        </div>
      ) : null}
    </div>
  );
};

export default ScrapeSummary;
