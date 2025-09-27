import React from 'react';

interface ScrapeSummaryProps {
  summary: {
    nabidka: number;
    poptavka: number;
  } | null;
}

const ScrapeSummary: React.FC<ScrapeSummaryProps> = ({ summary }) => {
  if (!summary) return null;

  return (
    <div className="my-4 p-4 bg-slate-800 rounded-lg shadow-inner">
      <h2 className="text-xl font-semibold text-sky-400 mb-2">Scraping Results</h2>
      <p className="text-slate-300">Found {summary.nabidka} offers.</p>
      <p className="text-slate-300">Found {summary.poptavka} demands.</p>
    </div>
  );
};

export default ScrapeSummary;