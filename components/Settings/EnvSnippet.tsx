import React from 'react';

interface EnvSnippetProps {
  envSnippet: string;
}

export const EnvSnippet: React.FC<EnvSnippetProps> = ({ envSnippet }) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(envSnippet);
    alert('📋 Zkopírováno do schránky!');
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-5 shadow-inner group">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-emerald-400 flex items-center gap-2">
          <span>📄 Vygenerované .env nastavení</span>
          <span className="text-[10px] bg-emerald-900/40 text-emerald-400 px-1.5 py-0.5 rounded font-bold border border-emerald-800 uppercase tracking-widest">Server Side</span>
        </h3>
        <button 
          onClick={handleCopy}
          className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded border border-slate-700 transition-colors opacity-0 group-hover:opacity-100"
        >
          Kopírovat 📋
        </button>
      </div>
      <div className="relative">
        <pre className="text-xs text-emerald-300 bg-slate-950 border border-slate-800 rounded-lg p-4 overflow-auto font-mono leading-relaxed shadow-lg max-h-[400px]">
          {envSnippet}
        </pre>
        <div className="absolute top-2 right-2 flex gap-1">
          <div className="w-2 h-2 rounded-full bg-slate-800"></div>
          <div className="w-2 h-2 rounded-full bg-slate-800"></div>
          <div className="w-2 h-2 rounded-full bg-slate-800"></div>
        </div>
      </div>
      <p className="mt-4 text-[11px] text-slate-500 leading-normal italic px-1">
        Zkopírujte tyto řádky do svého <code className="text-slate-400">.env</code> souboru v backendovém adresáři, pokud používáte jinou než výchozí konfiguraci. Některé změny vyžadují restart serveru.
      </p>
    </div>
  );
};
