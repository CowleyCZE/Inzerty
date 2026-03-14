import React, { useEffect, useState } from 'react';

interface DealState {
  matchKey: string;
  state: 'new' | 'contacted' | 'negotiating' | 'agreed' | 'meeting_scheduled' | 'completed' | 'cancelled' | 'stalled';
  previousState?: string;
  stateChangedAt: string;
  lastContactAt?: string;
  lastFollowupAt?: string;
  followupCount: number;
  autoFollowupEnabled: boolean;
}

interface StateTransition {
  from: string;
  to: string;
  trigger: string;
  timestamp: string;
}

interface DealStateTrackerProps {
  matchKey: string;
  onStateChange?: (newState: DealState) => void;
}

const DealStateTracker: React.FC<DealStateTrackerProps> = ({ matchKey, onStateChange }) => {
  const [dealState, setDealState] = useState<DealState | null>(null);
  const [transitions, setTransitions] = useState<StateTransition[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadDealState();
  }, [matchKey]);

  const loadDealState = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:3001/deals/${matchKey}/state`);
      if (response.ok) {
        const data = await response.json();
        setDealState(data.state);
      }
    } catch (error) {
      console.error('Error loading deal state:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateState = async (newState: DealState['state']) => {
    if (!dealState) return;
    setUpdating(true);
    try {
      const response = await fetch(`http://localhost:3001/deals/${matchKey}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: newState }),
      });

      if (response.ok) {
        const data = await response.json();
        setDealState(data.state);
        onStateChange?.(data.state);
        loadDealState();
      }
    } catch (error) {
      console.error('Error updating state:', error);
    } finally {
      setUpdating(false);
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'new': return 'bg-blue-600';
      case 'contacted': return 'bg-yellow-600';
      case 'negotiating': return 'bg-purple-600';
      case 'agreed': return 'bg-indigo-600';
      case 'meeting_scheduled': return 'bg-pink-600';
      case 'completed': return 'bg-emerald-600';
      case 'cancelled': return 'bg-slate-600';
      case 'stalled': return 'bg-red-600';
      default: return 'bg-slate-600';
    }
  };

  const getStateLabel = (state: string) => {
    switch (state) {
      case 'new': return '🆕 Nový';
      case 'contacted': return '📞 Kontaktovaný';
      case 'negotiating': return '💬 Vyjednávání';
      case 'agreed': return '✅ Dohodnutý';
      case 'meeting_scheduled': return '📅 Naplánovaný';
      case 'completed': return '✔️ Dokončený';
      case 'cancelled': return '❌ Zrušený';
      case 'stalled': return '⚠️ Uvízlý';
      default: return state;
    }
  };

  const getNextStates = (currentState: string): DealState['state'][] => {
    const transitions: Record<string, DealState['state'][]> = {
      new: ['contacted', 'cancelled'],
      contacted: ['negotiating', 'agreed', 'stalled', 'cancelled'],
      negotiating: ['agreed', 'stalled', 'cancelled'],
      agreed: ['meeting_scheduled', 'cancelled'],
      meeting_scheduled: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
      stalled: ['contacted', 'cancelled'],
    };
    return transitions[currentState] || [];
  };

  if (loading) {
    return <div className="text-slate-400">Načítám stav obchodu...</div>;
  }

  if (!dealState) {
    return (
      <div className="text-center py-8 text-slate-400">
        <div className="text-4xl mb-3">📊</div>
        <div>Stav obchodu není dostupný</div>
        <button
          onClick={loadDealState}
          className="mt-4 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg"
        >
          🔄 Načíst stav
        </button>
      </div>
    );
  }

  const nextStates = getNextStates(dealState.state);

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-4">
      {/* Current State */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-sky-400 flex items-center gap-2">
          <span>📊</span>
          Stav obchodu
        </h3>
        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium ${getStateColor(dealState.state)} text-white`}>
          {getStateLabel(dealState.state)}
        </span>
      </div>

      {/* State Progress */}
      <div className="relative">
        <div className="flex items-center justify-between">
          {['new', 'contacted', 'negotiating', 'agreed', 'meeting_scheduled', 'completed'].map((state, idx) => {
            const stateIndex = ['new', 'contacted', 'negotiating', 'agreed', 'meeting_scheduled', 'completed', 'cancelled', 'stalled'].indexOf(dealState.state);
            const currentIndex = ['new', 'contacted', 'negotiating', 'agreed', 'meeting_scheduled', 'completed'].indexOf(state);
            const isPast = currentIndex <= stateIndex;
            const isCurrent = currentIndex === stateIndex;

            return (
              <div key={state} className="flex flex-col items-center flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isCurrent
                      ? `${getStateColor(state)} text-white ring-2 ring-white ring-opacity-50`
                      : isPast
                      ? `${getStateColor(state)} text-white`
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {idx + 1}
                </div>
                <div className={`text-xs mt-1 text-center ${isCurrent ? 'text-white font-medium' : 'text-slate-400'}`}>
                  {state === 'meeting_scheduled' ? 'Schůzka' : state === 'new' ? 'Nový' : state}
                </div>
                {idx < 5 && (
                  <div className={`absolute top-4 left-0 w-full h-0.5 ${isPast ? getStateColor(state) : 'bg-slate-700'}`} style={{ zIndex: -1 }}></div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* State Actions */}
      {nextStates.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-300">Přepnout stav na:</h4>
          <div className="flex flex-wrap gap-2">
            {nextStates.map((state) => (
              <button
                key={state}
                onClick={() => updateState(state)}
                disabled={updating}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${getStateColor(state)} hover:opacity-80 disabled:opacity-50`}
              >
                {getStateLabel(state)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-700">
        <div>
          <div className="text-xs text-slate-400">Kontaktů</div>
          <div className="text-lg font-bold text-white">{dealState.followupCount}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Poslední kontakt</div>
          <div className="text-sm text-slate-300">
            {dealState.lastContactAt
              ? new Date(dealState.lastContactAt).toLocaleDateString('cs-CZ')
              : 'Žádný'}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Auto follow-up</div>
          <div className={`text-sm font-medium ${dealState.autoFollowupEnabled ? 'text-emerald-400' : 'text-slate-400'}`}>
            {dealState.autoFollowupEnabled ? '✅ Zapnuto' : '❌ Vypnuto'}
          </div>
        </div>
      </div>

      {/* Changed At */}
      <div className="text-xs text-slate-500 text-center pt-2 border-t border-slate-700">
        Poslední změna: {new Date(dealState.stateChangedAt).toLocaleString('cs-CZ')}
      </div>
    </div>
  );
};

export default DealStateTracker;
