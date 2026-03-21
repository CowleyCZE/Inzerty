import React from 'react';

interface AlertsPanelProps {
  alertsConfig: any;
  setAlertsConfig: React.Dispatch<React.SetStateAction<any>>;
  showAlertsConfig: boolean;
  setShowAlertsConfig: (v: boolean) => void;
  alertsStatus: string;
  testAlerts: () => void;
  saveAlertsConfig: () => void;
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({
  alertsConfig,
  setAlertsConfig,
  showAlertsConfig,
  setShowAlertsConfig,
  alertsStatus,
  testAlerts,
  saveAlertsConfig,
}) => {
  return (
    <>
      <div className="grid md:grid-cols-4 gap-2 mb-5 text-sm">
        <input 
          value={alertsConfig.telegramBotToken} 
          onChange={(e) => setAlertsConfig((p: any) => ({ ...p, telegramBotToken: e.target.value }))} 
          className="bg-slate-900 border border-slate-700 rounded p-2" 
          placeholder="Telegram bot token" 
        />
        <input 
          value={alertsConfig.telegramChatId} 
          onChange={(e) => setAlertsConfig((p: any) => ({ ...p, telegramChatId: e.target.value }))} 
          className="bg-slate-900 border border-slate-700 rounded p-2" 
          placeholder="Telegram chat ID" 
        />
        <input 
          value={alertsConfig.emailWebhookUrl} 
          onChange={(e) => setAlertsConfig((p: any) => ({ ...p, emailWebhookUrl: e.target.value }))} 
          className="bg-slate-900 border border-slate-700 rounded p-2" 
          placeholder="Email webhook" 
        />
        <input 
          value={alertsConfig.discordWebhookUrl} 
          onChange={(e) => setAlertsConfig((p: any) => ({ ...p, discordWebhookUrl: e.target.value }))} 
          className="bg-slate-900 border border-slate-700 rounded p-2" 
          placeholder="Discord webhook" 
        />
      </div>

      <div className="bg-slate-900 rounded-xl p-5 border border-slate-700 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-emerald-400">🔔 Konfigurace alertů</h3>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowAlertsConfig(!showAlertsConfig)} className="px-3 py-1 bg-slate-700 rounded hover:bg-slate-600">
              {showAlertsConfig ? 'Skrýt' : 'Zobrazit'} konfiguraci
            </button>
            <button onClick={testAlerts} className="px-3 py-1 bg-amber-700 rounded hover:bg-amber-600">🧪 Test</button>
            <button onClick={saveAlertsConfig} className="px-3 py-1 bg-emerald-700 rounded hover:bg-emerald-600">💾 Uložit</button>
          </div>
        </div>
        
        {alertsStatus && (
          <div className="mb-4 p-3 bg-slate-800 rounded border border-slate-600 text-sm">
            {alertsStatus}
          </div>
        )}
        
        {showAlertsConfig && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-sky-400">Telegram</h4>
              <input 
                value={alertsConfig.telegramBotToken} 
                onChange={(e) => setAlertsConfig((p: any) => ({ ...p, telegramBotToken: e.target.value }))} 
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm" 
                placeholder="Bot token (např. 123456:ABC-DEF1234...)" 
              />
              <input 
                value={alertsConfig.telegramChatId} 
                onChange={(e) => setAlertsConfig((p: any) => ({ ...p, telegramChatId: e.target.value }))} 
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm" 
                placeholder="Chat ID (např. -1001234567890)" 
              />
            </div>
            
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-purple-400">Email & Discord</h4>
              <input 
                value={alertsConfig.emailWebhookUrl} 
                onChange={(e) => setAlertsConfig((p: any) => ({ ...p, emailWebhookUrl: e.target.value }))} 
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm" 
                placeholder="Email webhook URL" 
              />
              <input 
                value={alertsConfig.discordWebhookUrl} 
                onChange={(e) => setAlertsConfig((p: any) => ({ ...p, discordWebhookUrl: e.target.value }))} 
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm" 
                placeholder="Discord webhook URL" 
              />
            </div>
            
            <div className="space-y-3 md:col-span-2">
              <h4 className="text-sm font-medium text-amber-400">Filtry</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Minimální zisk (Kč)</label>
                  <input 
                    type="number"
                    value={alertsConfig.minProfit} 
                    onChange={(e) => setAlertsConfig((p: any) => ({ ...p, minProfit: Number(e.target.value) }))} 
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm" 
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Minimální score</label>
                  <input 
                    type="number"
                    value={alertsConfig.minScore} 
                    onChange={(e) => setAlertsConfig((p: any) => ({ ...p, minScore: Number(e.target.value) }))} 
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm" 
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input 
                  type="checkbox" 
                  checked={alertsConfig.enabled} 
                  onChange={(e) => setAlertsConfig((p: any) => ({ ...p, enabled: e.target.checked }))} 
                />
                <span>Povolit automatické alerty</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input 
                  type="checkbox" 
                  checked={alertsConfig.autoSendAfterCompare} 
                  onChange={(e) => setAlertsConfig((p: any) => ({ ...p, autoSendAfterCompare: e.target.checked }))} 
                />
                <span>Poslat automaticky po porovnání</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
