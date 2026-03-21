import React from 'react';

interface ExportPanelProps {
  showSheetsConfig: boolean;
  setShowSheetsConfig: (v: boolean) => void;
  sheetsConfig: any;
  setSheetsConfig: React.Dispatch<React.SetStateAction<any>>;
  exportToGoogleSheets: (useWebhook?: boolean) => void;
  exportStatus: string;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  showSheetsConfig,
  setShowSheetsConfig,
  sheetsConfig,
  setSheetsConfig,
  exportToGoogleSheets,
  exportStatus,
}) => {
  if (!showSheetsConfig) return null;

  return (
    <div className="mb-4 p-4 bg-slate-900 border border-slate-700 rounded-xl">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-emerald-400">📈 Export do Google Sheets</h3>
        <button onClick={() => setShowSheetsConfig(false)} className="text-sm text-slate-400 hover:text-white">Skrýt</button>
      </div>
      
      {exportStatus && (
        <div className="mb-4 p-3 bg-slate-800 rounded border border-slate-600 text-sm">
          {exportStatus}
        </div>
      )}
      
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-sky-400">Možnost 1: Google Sheets API (oficiální)</h4>
          <input 
            value={sheetsConfig.spreadsheetId} 
            onChange={(e) => setSheetsConfig((p: any) => ({ ...p, spreadsheetId: e.target.value }))} 
            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm" 
            placeholder="Spreadsheet ID (z URL Google Sheets)" 
          />
          <input 
            value={sheetsConfig.apiKey} 
            onChange={(e) => setSheetsConfig((p: any) => ({ ...p, apiKey: e.target.value }))} 
            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm" 
            placeholder="OAuth Token / API Key" 
          />
          <input 
            value={sheetsConfig.sheetName} 
            onChange={(e) => setSheetsConfig((p: any) => ({ ...p, sheetName: e.target.value }))} 
            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm" 
            placeholder="Název listu (např. Arbitráže)" 
          />
          <button 
            onClick={() => exportToGoogleSheets(false)}
            className="w-full px-3 py-2 bg-emerald-700 hover:bg-emerald-600 rounded font-medium"
          >
            📈 Exportovat přes Google API
          </button>
        </div>
        
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-purple-400">Možnost 2: Google Apps Script (jednodušší)</h4>
          <textarea 
            value={sheetsConfig.webhookUrl} 
            onChange={(e) => setSheetsConfig((p: any) => ({ ...p, webhookUrl: e.target.value }))} 
            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm" 
            placeholder="Google Apps Script Web App URL" 
            rows={3}
          />
          <div className="text-xs text-slate-400">
            <p>Vytvořte Google Apps Script s funkcí <code className="bg-slate-700 px-1 rounded">doPost(e)</code> která přijme JSON a uloží do Sheets.</p>
          </div>
          <button 
            onClick={() => exportToGoogleSheets(true)}
            className="w-full px-3 py-2 bg-purple-700 hover:bg-purple-600 rounded font-medium"
          >
            📊 Exportovat přes Webhook
          </button>
        </div>
      </div>
      
      <div className="p-3 bg-slate-800 border border-slate-600 rounded text-xs text-slate-300">
        <p className="font-semibold mb-2">📝 Jak nastavit Google Sheets export:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li><strong>Google API:</strong> Získejte OAuth token z Google Cloud Console, povolte Sheets API</li>
          <li><strong>Apps Script:</strong> Vytvořte script v Google Sheets → Extensions → Apps Script → Deploy as Web App</li>
          <li>Export zahrnuje: datum, nabídku, poptávku, zisk, score, lokality, URL, stav, prioritu, poznámky</li>
        </ol>
      </div>
    </div>
  );
};
