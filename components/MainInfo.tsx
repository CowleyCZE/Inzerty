import React from 'react';

const tips = [
  'Spouštějte scraping častěji, ale inkrementálně – stáhnete jen nové inzeráty.',
  'Pro přesnější párování zapněte Ollama a porovnávání přes AI režim.',
  'Použijte filtr minimálního zisku a řazení podle arbitráže.',
  'Při větším objemu dat přepněte na PostgreSQL + pgvector.',
];

const MainInfo: React.FC = () => {
  return (
    <section className="mt-6 bg-gradient-to-r from-slate-800 to-slate-700 border border-slate-600 rounded-xl p-6 shadow-xl">
      <h2 className="text-2xl font-bold text-sky-300 mb-2">Co je nového a proč to pomůže</h2>
      <p className="text-slate-300 mb-4">
        Aplikace teď umí inkrementální scraping, robustnější retry/backoff, lepší anti-bot chování a pokročilé porovnávání včetně arbitrážního skóre.
      </p>
      <div className="grid md:grid-cols-2 gap-3">
        {tips.map((tip) => (
          <div key={tip} className="bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-sm text-slate-200">
            • {tip}
          </div>
        ))}
      </div>
    </section>
  );
};

export default MainInfo;
