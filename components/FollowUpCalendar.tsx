import React, { useEffect, useState } from 'react';

interface FollowUpItem {
  match_key: string;
  follow_up_at: string;
  follow_up_state: string;
  status: string;
  priority: string;
  note: string;
  offer_title?: string;
  demand_title?: string;
  profit?: number;
}

interface FollowUpSummary {
  overdue: { count: number; items: FollowUpItem[] };
  today: { count: number; items: FollowUpItem[] };
  tomorrow: { count: number; items: FollowUpItem[] };
  thisWeek: { count: number; items: FollowUpItem[] };
}

interface FollowUpCalendarProps {
  alertsConfig?: {
    telegramBotToken?: string;
    telegramChatId?: string;
    emailWebhookUrl?: string;
  };
}

const FollowUpCalendar: React.FC<FollowUpCalendarProps> = ({ alertsConfig }) => {
  const [summary, setSummary] = useState<FollowUpSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'overdue' | 'today' | 'tomorrow' | 'week'>('all');
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  useEffect(() => {
    loadFollowUps();
  }, []);

  const loadFollowUps = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:3001/followups/summary');
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Failed to load follow-ups:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendReminder = async (matchKey: string) => {
    setSendingReminder(matchKey);
    try {
      const res = await fetch(`http://localhost:3001/followups/${matchKey}/remind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertsConfig || {}),
      });
      
      if (res.ok) {
        alert('✅ Reminder byl odeslán');
      } else {
        alert('❌ Nepodařilo se odeslat reminder');
      }
    } catch (error) {
      alert(`❌ Chyba: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    } finally {
      setSendingReminder(null);
    }
  };

  const getItemsForPeriod = () => {
    if (!summary) return [];
    
    switch (selectedPeriod) {
      case 'overdue': return summary.overdue.items;
      case 'today': return summary.today.items;
      case 'tomorrow': return summary.tomorrow.items;
      case 'week': return summary.thisWeek.items;
      default: {
        // Deduplikace: each match_key se zobrazí jen jednou
        const seen = new Map<string, FollowUpItem>();
        [
          ...summary.overdue.items,
          ...summary.today.items,
          ...summary.tomorrow.items,
          ...summary.thisWeek.items,
        ].forEach((item) => {
          if (!seen.has(item.match_key)) seen.set(item.match_key, item);
        });
        return Array.from(seen.values());
      }
    }
  };

  const getStateLabel = (state: string) => {
    const labels: Record<string, { text: string; color: string }> = {
      none: { text: 'Bez reminderu', color: 'bg-slate-600' },
      waiting: { text: 'Čeká se', color: 'bg-sky-600' },
      no_response: { text: 'Neodpověděl', color: 'bg-amber-600' },
      done: { text: 'Hotovo', color: 'bg-emerald-600' },
    };
    return labels[state] || labels.none;
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'text-slate-400',
      medium: 'text-sky-400',
      high: 'text-amber-400',
      critical: 'text-rose-400',
    };
    return colors[priority] || colors.medium;
  };

  const items = getItemsForPeriod();

  if (loading) {
    return (
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
        <p className="text-slate-400">Načítám follow-upy...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-emerald-400">⏰ Kalendář Follow-upů</h2>
        <button onClick={loadFollowUps} className="px-3 py-1 bg-slate-700 rounded hover:bg-slate-600 text-sm">
          🔄 Obnovit
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-rose-900/30 border border-rose-700 rounded-lg p-3">
            <div className="text-2xl font-bold text-rose-400">{summary.overdue.count}</div>
            <div className="text-xs text-rose-300">Prošlé</div>
          </div>
          <div className="bg-emerald-900/30 border border-emerald-700 rounded-lg p-3">
            <div className="text-2xl font-bold text-emerald-400">{summary.today.count}</div>
            <div className="text-xs text-emerald-300">Dnes</div>
          </div>
          <div className="bg-sky-900/30 border border-sky-700 rounded-lg p-3">
            <div className="text-2xl font-bold text-sky-400">{summary.tomorrow.count}</div>
            <div className="text-xs text-sky-300">Zítra</div>
          </div>
          <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-3">
            <div className="text-2xl font-bold text-purple-400">{summary.thisWeek.count}</div>
            <div className="text-xs text-purple-300">Tento týden</div>
          </div>
        </div>
      )}

      {/* Period Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button 
          onClick={() => setSelectedPeriod('all')}
          className={`px-3 py-1 rounded text-sm ${selectedPeriod === 'all' ? 'bg-emerald-700 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
        >
          Všechny ({items.length})
        </button>
        <button 
          onClick={() => setSelectedPeriod('overdue')}
          className={`px-3 py-1 rounded text-sm ${selectedPeriod === 'overdue' ? 'bg-rose-700 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
        >
          🚨 Prošlé ({summary?.overdue.count || 0})
        </button>
        <button 
          onClick={() => setSelectedPeriod('today')}
          className={`px-3 py-1 rounded text-sm ${selectedPeriod === 'today' ? 'bg-emerald-700 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
        >
          📅 Dnes ({summary?.today.count || 0})
        </button>
        <button 
          onClick={() => setSelectedPeriod('tomorrow')}
          className={`px-3 py-1 rounded text-sm ${selectedPeriod === 'tomorrow' ? 'bg-sky-700 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
        >
          ⏰ Zítra ({summary?.tomorrow.count || 0})
        </button>
        <button 
          onClick={() => setSelectedPeriod('week')}
          className={`px-3 py-1 rounded text-sm ${selectedPeriod === 'week' ? 'bg-purple-700 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
        >
          📆 Tento týden ({summary?.thisWeek.count || 0})
        </button>
      </div>

      {/* Follow-up List */}
      {items.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          🎉 Žádné nadcházející follow-upy!
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isOverdue = new Date(item.follow_up_at) < new Date();
            const stateInfo = getStateLabel(item.follow_up_state);
            const followUpDate = new Date(item.follow_up_at);
            
            return (
              <div 
                key={item.match_key} 
                className={`p-4 rounded-lg border ${isOverdue ? 'bg-rose-900/20 border-rose-700' : 'bg-slate-900/50 border-slate-700'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded ${stateInfo.color} text-white`}>
                        {stateInfo.text}
                      </span>
                      <span className={`text-xs ${getPriorityColor(item.priority)}`}>
                        {item.priority === 'critical' ? '🔴' : item.priority === 'high' ? '🟠' : item.priority === 'medium' ? '🔵' : '⚪'} {item.priority}
                      </span>
                      {isOverdue && (
                        <span className="text-xs bg-rose-700 text-white px-2 py-0.5 rounded">
                          ⚠️ PROŠLÉ
                        </span>
                      )}
                    </div>
                    <div className="font-medium text-slate-200">
                      📦 {item.offer_title || 'N/A'} → 📤 {item.demand_title || 'N/A'}
                    </div>
                    {item.profit && (
                      <div className="text-emerald-400 text-sm">💰 {item.profit} Kč</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-semibold ${isOverdue ? 'text-rose-400' : 'text-sky-400'}`}>
                      {followUpDate.toLocaleDateString('cs-CZ')}
                    </div>
                    <div className="text-xs text-slate-400">
                      {followUpDate.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
                
                {item.note && (
                  <div className="text-sm text-slate-400 mb-2">
                    📝 {item.note}
                  </div>
                )}
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => sendReminder(item.match_key)}
                    disabled={sendingReminder === item.match_key}
                    className="px-3 py-1 bg-amber-700 hover:bg-amber-600 disabled:bg-amber-900 rounded text-sm"
                  >
                    {sendingReminder === item.match_key ? 'Odesílám...' : '🔔 Poslat reminder'}
                  </button>
                  <a 
                    href={`#/match/${item.match_key}`}
                    className="px-3 py-1 bg-sky-700 hover:bg-sky-600 rounded text-sm"
                  >
                    🔗 Otevřít detail
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FollowUpCalendar;
