import React, { useEffect, useState } from 'react';

interface PriorityScore {
  matchKey: string;
  overallScore: number;
  components: {
    profitScore: number;
    trustScore: number;
    urgencyScore: number;
    marketScore: number;
    capacityScore: number;
  };
  recommendation: 'prioritize' | 'normal' | 'skip';
  reasoning: string;
  calculatedAt: string;
}

interface MatchPriorityProps {
  matchKey?: string;
  match?: {
    offer: { title: string; price: string; location: string };
    demand: { title: string; price: string; location: string };
    arbitrageScore: number;
    similarityScore: number;
  };
}

const MatchPriority: React.FC<MatchPriorityProps> = ({ matchKey, match }) => {
  const [score, setScore] = useState<PriorityScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => {
    if (matchKey) {
      loadPriority();
    }
  }, [matchKey]);

  const loadPriority = async () => {
    if (!matchKey) return;
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:3001/priority/${matchKey}`);
      if (response.ok) {
        const data = await response.json();
        setScore(data.score);
      }
    } catch (error) {
      console.error('Error loading priority:', error);
    } finally {
      setLoading(false);
    }
  };

  const recalculatePriority = async () => {
    if (!match || !matchKey) return;
    setRecalculating(true);
    try {
      const response = await fetch('http://localhost:3001/priority/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchKey,
          match,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setScore(data.score);
      }
    } catch (error) {
      console.error('Error recalculating priority:', error);
    } finally {
      setRecalculating(false);
    }
  };

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'prioritize': return 'bg-emerald-600';
      case 'normal': return 'bg-blue-600';
      case 'skip': return 'bg-red-600';
      default: return 'bg-slate-600';
    }
  };

  const getRecommendationLabel = (rec: string) => {
    switch (rec) {
      case 'prioritize': return '🔥 Prioritizovat';
      case 'normal': return '📋 Normální';
      case 'skip': return '⚠️ Přeskočit';
      default: return rec;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-blue-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getComponentColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <div className="text-slate-400 text-center">Načítám prioritu...</div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-sky-400 flex items-center gap-2">
          <span>🎯</span>
          AI Priorita obchodu
        </h3>
        <button
          onClick={recalculatePriority}
          disabled={recalculating || !match}
          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {recalculating ? 'Přepočítávám...' : '🔄 Přepočítat'}
        </button>
      </div>

      {score ? (
        <>
          {/* Overall Score & Recommendation */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="text-xs text-slate-400 mb-1">Celkové skóre</div>
              <div className={`text-3xl font-bold ${getScoreColor(score.overallScore)}`}>
                {score.overallScore}
                <span className="text-sm text-slate-500">/100</span>
              </div>
            </div>
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="text-xs text-slate-400 mb-1">Doporučení</div>
              <div className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium ${getRecommendationColor(score.recommendation)} text-white`}>
                {getRecommendationLabel(score.recommendation)}
              </div>
            </div>
          </div>

          {/* Score Components */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-300">Rozklad skóre</h4>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">💰 Profitabilita (30%)</span>
                <span className={`font-medium ${getScoreColor(score.components.profitScore)}`}>
                  {score.components.profitScore}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getComponentColor(score.components.profitScore)}`}
                  style={{ width: `${score.components.profitScore}%` }}
                ></div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">🛡️ Důvěryhodnost (25%)</span>
                <span className={`font-medium ${getScoreColor(score.components.trustScore)}`}>
                  {score.components.trustScore}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getComponentColor(score.components.trustScore)}`}
                  style={{ width: `${score.components.trustScore}%` }}
                ></div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">⚡ Urgence (20%)</span>
                <span className={`font-medium ${getScoreColor(score.components.urgencyScore)}`}>
                  {score.components.urgencyScore}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getComponentColor(score.components.urgencyScore)}`}
                  style={{ width: `${score.components.urgencyScore}%` }}
                ></div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">📈 Tržní trend (15%)</span>
                <span className={`font-medium ${getScoreColor(score.components.marketScore)}`}>
                  {score.components.marketScore}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getComponentColor(score.components.marketScore)}`}
                  style={{ width: `${score.components.marketScore}%` }}
                ></div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">👤 Kapacita (10%)</span>
                <span className={`font-medium ${getScoreColor(score.components.capacityScore)}`}>
                  {score.components.capacityScore}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getComponentColor(score.components.capacityScore)}`}
                  style={{ width: `${score.components.capacityScore}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* AI Reasoning */}
          {score.reasoning && (
            <div className="bg-purple-900 bg-opacity-20 border border-purple-700 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <span className="text-lg">🤖</span>
                <div>
                  <div className="text-sm font-medium text-purple-300 mb-1">AI Reasoning</div>
                  <div className="text-sm text-purple-200">{score.reasoning}</div>
                </div>
              </div>
            </div>
          )}

          {/* Calculated At */}
          <div className="text-xs text-slate-500 text-center">
            Vypočítáno: {new Date(score.calculatedAt).toLocaleString('cs-CZ')}
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <div className="text-slate-400 mb-4">Žádné skóre priority</div>
          <button
            onClick={recalculatePriority}
            disabled={!match}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors"
          >
            Vypočítat prioritu
          </button>
        </div>
      )}
    </div>
  );
};

export default MatchPriority;
