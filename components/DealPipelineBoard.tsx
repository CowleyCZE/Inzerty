import React, { useEffect, useState } from 'react';

interface DealPipeline {
  state: string;
  count: number;
  contacted_count: number;
  avg_hours_since_contact?: number;
}

interface PipelineDeal {
  matchKey: string;
  state: string;
  stateChangedAt: string;
  lastContactAt?: string;
  followupCount: number;
  offer?: { title: string; price: string };
  demand?: { title: string; price: string };
  arbitrageScore?: number;
}

interface DealPipelineBoardProps {
  onDealClick?: (matchKey: string) => void;
}

const DealPipelineBoard: React.FC<DealPipelineBoardProps> = ({ onDealClick }) => {
  const [pipeline, setPipeline] = useState<DealPipeline[]>([]);
  const [deals, setDeals] = useState<PipelineDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedDeal, setDraggedDeal] = useState<string | null>(null);

  useEffect(() => {
    loadPipeline();
    const interval = setInterval(loadPipeline, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const loadPipeline = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/deals/pipeline-board');
      if (response.ok) {
        const data = await response.json();
        setPipeline(data.pipeline || []);
        setDeals(data.deals || []);
      }
    } catch (error) {
      console.error('Error loading pipeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, matchKey: string) => {
    setDraggedDeal(matchKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, newState: string) => {
    e.preventDefault();
    if (!draggedDeal) return;

    try {
      const response = await fetch(`http://localhost:3001/deals/${draggedDeal}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: newState }),
      });

      if (response.ok) {
        loadPipeline();
      }
    } catch (error) {
      console.error('Error updating state:', error);
    } finally {
      setDraggedDeal(null);
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'new': return 'border-blue-500 bg-blue-900 bg-opacity-20';
      case 'contacted': return 'border-yellow-500 bg-yellow-900 bg-opacity-20';
      case 'negotiating': return 'border-purple-500 bg-purple-900 bg-opacity-20';
      case 'agreed': return 'border-indigo-500 bg-indigo-900 bg-opacity-20';
      case 'meeting_scheduled': return 'border-pink-500 bg-pink-900 bg-opacity-20';
      case 'completed': return 'border-emerald-500 bg-emerald-900 bg-opacity-20';
      case 'cancelled': return 'border-slate-500 bg-slate-900 bg-opacity-20';
      case 'stalled': return 'border-red-500 bg-red-900 bg-opacity-20';
      default: return 'border-slate-500 bg-slate-900 bg-opacity-20';
    }
  };

  const getStateLabel = (state: string) => {
    switch (state) {
      case 'new': return '🆕 Nové';
      case 'contacted': return '📞 Kontaktované';
      case 'negotiating': return '💬 Vyjednávání';
      case 'agreed': return '✅ Dohodnuté';
      case 'meeting_scheduled': return '📅 Naplánované';
      case 'completed': return '✔️ Dokončené';
      case 'cancelled': return '❌ Zrušené';
      case 'stalled': return '⚠️ Uvízlé';
      default: return state;
    }
  };

  const getTimeSinceContact = (lastContactAt?: string) => {
    if (!lastContactAt) return 'Žádný kontakt';
    const hours = Math.floor((Date.now() - new Date(lastContactAt).getTime()) / (1000 * 60 * 60));
    if (hours < 1) return 'Právě teď';
    if (hours < 24) return `Před ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Před ${days}d`;
  };

  if (loading) {
    return <div className="text-slate-400">Načítám pipeline...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-sky-400 flex items-center gap-2">
          <span>📊</span>
          Pipeline obchodů
        </h2>
        <button
          onClick={loadPipeline}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-medium transition-colors"
        >
          🔄 Obnovit
        </button>
      </div>

      {/* Pipeline Stats */}
      <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
        {pipeline.map((stat) => (
          <div
            key={stat.state}
            className={`p-3 rounded-lg border-l-4 ${getStateColor(stat.state)}`}
          >
            <div className="text-xs text-slate-400">{getStateLabel(stat.state)}</div>
            <div className="text-xl font-bold text-white">{stat.count}</div>
            {stat.avg_hours_since_contact && (
              <div className="text-xs text-slate-500">
                Průměr: {Math.round(stat.avg_hours_since_contact)}h
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto">
        {['new', 'contacted', 'negotiating', 'agreed', 'meeting_scheduled', 'completed', 'cancelled', 'stalled'].map((state) => {
          const stateDeals = deals.filter(d => d.state === state);
          
          return (
            <div
              key={state}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, state)}
              className={`min-w-[280px] p-3 rounded-lg border-2 ${getStateColor(state)}`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-white">{getStateLabel(state)}</h3>
                <span className="text-xs bg-slate-700 px-2 py-1 rounded-full text-white">
                  {stateDeals.length}
                </span>
              </div>

              <div className="space-y-2">
                {stateDeals.map((deal) => (
                  <div
                    key={deal.matchKey}
                    draggable
                    onDragStart={(e) => handleDragStart(e, deal.matchKey)}
                    onClick={() => onDealClick?.(deal.matchKey)}
                    className="p-3 bg-slate-800 rounded-lg border border-slate-700 cursor-move hover:border-sky-500 transition-all"
                  >
                    <div className="text-sm font-medium text-slate-200 truncate">
                      {deal.offer?.title || 'Neznámý obchod'}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      💰 {deal.arbitrageScore?.toLocaleString() || 0} Kč
                    </div>
                    <div className="text-xs text-slate-500 mt-2 flex items-center justify-between">
                      <span>📞 {getTimeSinceContact(deal.lastContactAt)}</span>
                      <span>🔁 {deal.followupCount}</span>
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      {new Date(deal.stateChangedAt).toLocaleDateString('cs-CZ')}
                    </div>
                  </div>
                ))}

                {stateDeals.length === 0 && (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    Žádné obchody
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DealPipelineBoard;
