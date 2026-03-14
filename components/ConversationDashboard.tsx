import React, { useEffect, useState } from 'react';

interface DealState {
  match_key: string;
  state: string;
  previous_state?: string;
  state_changed_at: string;
  last_contact_at?: string;
  last_followup_at?: string;
  followup_count: number;
  auto_followup_enabled: boolean;
}

interface PipelineStat {
  state: string;
  count: number;
  contacted_count: number;
  avg_hours_since_contact?: number;
}

interface ConversationDashboardProps {
  onDealClick?: (matchKey: string) => void;
}

const ConversationDashboard: React.FC<ConversationDashboardProps> = ({ onDealClick }) => {
  const [pipeline, setPipeline] = useState<PipelineStat[]>([]);
  const [allDeals, setAllDeals] = useState<DealState[]>([]);
  const [filterState, setFilterState] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPipeline();
    const interval = setInterval(fetchPipeline, 30000); // Refresh každých 30 sekund
    return () => clearInterval(interval);
  }, []);

  const fetchPipeline = async () => {
    try {
      const [pipelineRes, dealsRes] = await Promise.all([
        fetch('http://localhost:3001/deals/pipeline'),
        fetch('http://localhost:3001/deals/pipeline'), // V reálu bychom měli samostatný endpoint
      ]);

      if (pipelineRes.ok) {
        const data = await pipelineRes.json();
        setPipeline(data.pipeline || []);
        setAllDeals(data.allStates || []);
      }
    } catch (error) {
      console.error('Error fetching pipeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStateColor = (state: string): string => {
    const colors: Record<string, string> = {
      new: 'bg-blue-600',
      contacted: 'bg-yellow-600',
      negotiating: 'bg-purple-600',
      agreed: 'bg-indigo-600',
      meeting_scheduled: 'bg-pink-600',
      completed: 'bg-green-600',
      cancelled: 'bg-gray-600',
      stalled: 'bg-red-600',
    };
    return colors[state] || 'bg-slate-600';
  };

  const getStateLabel = (state: string): string => {
    const labels: Record<string, string> = {
      new: '🆕 Nové',
      contacted: '📞 Kontaktované',
      negotiating: '💬 Vyjednávání',
      agreed: '✅ Dohodnuté',
      meeting_scheduled: '📅 Naplánované',
      completed: '✔️ Dokončené',
      cancelled: '❌ Zrušené',
      stalled: '⚠️ Uvízlé',
    };
    return labels[state] || state;
  };

  const filteredDeals = filterState === 'all' 
    ? allDeals 
    : allDeals.filter(d => d.state === filterState);

  const formatTimeAgo = (dateString?: string): string => {
    if (!dateString) return 'Nikdy';
    const date = new Date(dateString);
    const hours = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60));
    
    if (hours < 1) return 'Právě teď';
    if (hours < 24) return `Před ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Před ${days}d`;
  };

  if (loading) {
    return <div className="text-slate-400">Načítám dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Pipeline Overview */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-xl font-semibold text-sky-400 mb-4 flex items-center gap-2">
          <span>📊</span>
          Pipeline obchodů
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {pipeline.map((stat) => (
            <button
              key={stat.state}
              onClick={() => setFilterState(stat.state)}
              className={`${getStateColor(stat.state)} bg-opacity-20 hover:bg-opacity-30 border border-opacity-30 rounded-lg p-3 text-left transition-all`}
            >
              <div className="text-sm font-medium text-slate-200">
                {getStateLabel(stat.state)}
              </div>
              <div className="text-2xl font-bold text-white mt-1">
                {stat.count}
              </div>
              {stat.count > 0 && (
                <div className="text-xs text-slate-400 mt-1">
                  {stat.avg_hours_since_contact 
                    ? `Průměr: ${Math.round(stat.avg_hours_since_contact)}h`
                    : 'Žádný kontakt'}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex items-center gap-2">
        <span className="text-slate-400 text-sm">Filtr:</span>
        <select
          value={filterState}
          onChange={(e) => setFilterState(e.target.value)}
          className="bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="all">Všechny ({allDeals.length})</option>
          <option value="new">Nové</option>
          <option value="contacted">Kontaktované</option>
          <option value="negotiating">Vyjednávání</option>
          <option value="agreed">Dohodnuté</option>
          <option value="meeting_scheduled">Naplánované</option>
          <option value="completed">Dokončené</option>
          <option value="cancelled">Zrušené</option>
          <option value="stalled">Uvízlé</option>
        </select>
      </div>

      {/* Deals List */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900 border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Stav
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Match Key
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Poslední kontakt
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Follow-upy
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Auto
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredDeals.map((deal) => (
                <tr
                  key={deal.match_key}
                  className="hover:bg-slate-700 hover:bg-opacity-30 transition-colors cursor-pointer"
                  onClick={() => onDealClick?.(deal.match_key)}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStateColor(deal.state)} bg-opacity-20 text-slate-200`}>
                      {getStateLabel(deal.state)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-slate-300 font-mono truncate max-w-xs">
                      {deal.match_key.substring(0, 50)}...
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-slate-400">
                      {formatTimeAgo(deal.last_contact_at)}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-slate-300">
                      {deal.followup_count}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${deal.auto_followup_enabled ? 'bg-green-900 bg-opacity-30 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                      {deal.auto_followup_enabled ? '✅ Zapnuto' : '❌ Vypnuto'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredDeals.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            Žádné obchody k zobrazení
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationDashboard;
