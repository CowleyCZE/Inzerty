import React, { useEffect, useState } from 'react';
import UserCapacityPanel from './UserCapacityPanel';
import HistoricalAccuracyPanel from './HistoricalAccuracyPanel';
import AutoPrioritizationPanel from './AutoPrioritizationPanel';
import RealMarketTrendsPanel from './RealMarketTrendsPanel';

interface PrioritizedMatch {
  matchKey: string;
  overallScore: number;
  recommendation: 'prioritize' | 'normal' | 'skip';
  offer: { title: string; price: string };
  demand: { title: string; price: string };
  arbitrageScore: number;
  calculatedAt: string;
}

interface PriorityStats {
  totalMatches: number;
  prioritizeCount: number;
  normalCount: number;
  skipCount: number;
  avgScore: number;
}

const PriorityDashboard: React.FC = () => {
  const [matches, setMatches] = useState<PrioritizedMatch[]>([]);
  const [stats, setStats] = useState<PriorityStats | null>(null);
  const [filter, setFilter] = useState<'all' | 'prioritize' | 'normal' | 'skip'>('all');
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'capacity' | 'accuracy' | 'auto' | 'trends'>('overview');

  useEffect(() => {
    loadPriorities();
  }, []);

  const loadPriorities = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/priority/dashboard');
      if (response.ok) {
        const data = await response.json();
        setMatches(data.matches || []);
        setStats(data.stats || null);
      }
    } catch (error) {
      console.error('Chyba při načítání priorit:', error);
    } finally {
      setLoading(false);
    }
  };

  const recalculateAll = async () => {
    setRecalculating(true);
    try {
      const response = await fetch('http://localhost:3001/priority/recalculate-all', {
        method: 'POST',
      });

      if (response.ok) {
        loadPriorities();
      }
    } catch (error) {
      console.error('Chyba při přepočítávání:', error);
    } finally {
      setRecalculating(false);
    }
  };

  const filteredMatches = filter === 'all'
    ? matches
    : matches.filter(m => m.recommendation === filter);

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'prioritize': return 'bg-emerald-600';
      case 'normal': return 'bg-blue-600';
      case 'skip': return 'bg-red-600';
      default: return 'bg-slate-600';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-blue-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (loading) {
    return <div className="text-slate-400">Načítám priority...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-semibold text-sky-400 flex items-center gap-2">
          <span>🎯</span>
          AI Priority Dashboard
        </h2>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'overview' ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            📊 Přehled
          </button>
          <button
            onClick={() => setActiveTab('capacity')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'capacity' ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            👤 Kapacita
          </button>
          <button
            onClick={() => setActiveTab('accuracy')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'accuracy' ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            🎯 Přesnost
          </button>
          <button
            onClick={() => setActiveTab('auto')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'auto' ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            🤖 Automatizace
          </button>
          <button
            onClick={() => setActiveTab('trends')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'trends' ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            📈 Tržní trendy
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-300">Přehled priorit</h3>
            <button
              onClick={recalculateAll}
              disabled={recalculating}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors"
            >
              {recalculating ? '🔄 Přepočítávám...' : '🔄 Přepočítat všechny'}
            </button>
          </div>

          {/* Stats Overview */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="text-xs text-slate-400">Celkem obchodů</div>
                <div className="text-2xl font-bold text-white">{stats.totalMatches}</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="text-xs text-slate-400">🔥 Prioritizovat</div>
                <div className="text-2xl font-bold text-emerald-400">{stats.prioritizeCount}</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="text-xs text-slate-400">📋 Normální</div>
                <div className="text-2xl font-bold text-blue-400">{stats.normalCount}</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="text-xs text-slate-400">⚠️ Přeskočit</div>
                <div className="text-2xl font-bold text-red-400">{stats.skipCount}</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="text-xs text-slate-400">Průměrné skóre</div>
                <div className={`text-2xl font-bold ${getScoreColor(stats.avgScore)}`}>
                  {Math.round(stats.avgScore)}
                </div>
              </div>
            </div>
          )}

          {/* Filter Controls */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">Filtr:</span>
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm ${filter === 'all' ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300'}`}
            >
              Všechny ({matches.length})
            </button>
            <button
              onClick={() => setFilter('prioritize')}
              className={`px-3 py-1.5 rounded-lg text-sm ${filter === 'prioritize' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}
            >
              🔥 Prioritizovat ({matches.filter(m => m.recommendation === 'prioritize').length})
            </button>
            <button
              onClick={() => setFilter('normal')}
              className={`px-3 py-1.5 rounded-lg text-sm ${filter === 'normal' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
            >
              📋 Normální ({matches.filter(m => m.recommendation === 'normal').length})
            </button>
            <button
              onClick={() => setFilter('skip')}
              className={`px-3 py-1.5 rounded-lg text-sm ${filter === 'skip' ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300'}`}
            >
              ⚠️ Přeskočit ({matches.filter(m => m.recommendation === 'skip').length})
            </button>
          </div>

          {/* Matches Table */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900 border-b border-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Priorita
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Nabídka
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Poptávka
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Zisk
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Skóre
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Vypočítáno
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredMatches.map((match) => (
                    <tr
                      key={match.matchKey}
                      className={`hover:bg-slate-700 hover:bg-opacity-30 transition-colors cursor-pointer ${
                        match.recommendation === 'prioritize' ? 'bg-emerald-900 bg-opacity-10' :
                        match.recommendation === 'skip' ? 'bg-red-900 bg-opacity-10' : ''
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRecommendationColor(match.recommendation)} text-white`}>
                          {match.recommendation === 'prioritize' ? '🔥' : match.recommendation === 'skip' ? '⚠️' : '📋'}
                          {match.recommendation === 'prioritize' ? 'Prioritizovat' : match.recommendation === 'skip' ? 'Přeskočit' : 'Normální'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-slate-200 font-medium">{match.offer.title}</div>
                        <div className="text-xs text-slate-400">{match.offer.price}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-slate-200">{match.demand.title}</div>
                        <div className="text-xs text-slate-400">{match.demand.price}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-bold text-emerald-400">
                          {match.arbitrageScore.toLocaleString()} Kč
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className={`text-lg font-bold ${getScoreColor(match.overallScore)}`}>
                          {match.overallScore}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-xs text-slate-400">
                          {new Date(match.calculatedAt).toLocaleString('cs-CZ', {
                            day: 'numeric',
                            month: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredMatches.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                {filter === 'all' ? 'Žádné obchody k zobrazení' : `Žádné obchody s filtrem "${filter}"`}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'capacity' && <UserCapacityPanel />}
      {activeTab === 'accuracy' && <HistoricalAccuracyPanel />}
      {activeTab === 'auto' && <AutoPrioritizationPanel />}
      {activeTab === 'trends' && <RealMarketTrendsPanel />}
    </div>
  );
};

export default PriorityDashboard;
