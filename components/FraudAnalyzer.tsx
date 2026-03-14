import React, { useEffect, useState } from 'react';

interface FraudAnalysis {
  matchKey: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  flags: {
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    evidence: string;
  }[];
  recommendation: string;
  analyzedAt: string;
}

interface FraudAnalyzerProps {
  matchKey: string;
  match?: {
    offer: { title: string; price: string; description?: string; location: string; url: string };
    demand: { title: string; price: string; location: string };
    arbitrageScore: number;
  };
  onFraudDetected?: (analysis: FraudAnalysis) => void;
}

const FraudAnalyzer: React.FC<FraudAnalyzerProps> = ({ matchKey, match, onFraudDetected }) => {
  const [analysis, setAnalysis] = useState<FraudAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (matchKey && match) {
      analyzeFraud();
    }
  }, [matchKey]);

  const analyzeFraud = async () => {
    if (!match) return;
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/fraud/analyze-full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchKey,
          match,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAnalysis(data.analysis);
        if (data.analysis.riskScore >= 50) {
          onFraudDetected?.(data.analysis);
        }
      }
    } catch (error) {
      console.error('Error analyzing fraud:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-emerald-400';
      case 'medium': return 'text-yellow-400';
      case 'high': return 'text-orange-400';
      case 'critical': return 'text-red-400 animate-pulse';
      default: return 'text-slate-400';
    }
  };

  const getRiskBadge = (level: string, score: number) => {
    const colors: Record<string, string> = {
      low: 'bg-emerald-900 bg-opacity-30 text-emerald-400 border-emerald-700',
      medium: 'bg-yellow-900 bg-opacity-30 text-yellow-400 border-yellow-700',
      high: 'bg-orange-900 bg-opacity-30 text-orange-400 border-orange-700',
      critical: 'bg-red-900 bg-opacity-30 text-red-400 border-red-700 animate-pulse',
    };
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${colors[level] || 'bg-slate-700'}`}>
        <span className="text-lg">
          {level === 'low' ? '✅' : level === 'medium' ? '⚠️' : level === 'high' ? '🔴' : '🚨'}
        </span>
        <div>
          <div className="font-bold">{level.toUpperCase()}</div>
          <div className="text-xs opacity-75">Riziko: {score}/100</div>
        </div>
      </div>
    );
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-emerald-500';
      default: return 'bg-slate-500';
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-sky-500"></div>
          <div>AI analyzuje obchod na podvody...</div>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <button
          onClick={analyzeFraud}
          className="w-full flex items-center justify-center gap-2 text-sky-400 hover:text-sky-300"
        >
          <span className="text-xl">🛡️</span>
          <span className="font-medium">Spustit detekci podvodů</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${
      analysis.riskLevel === 'critical' ? 'bg-red-900 bg-opacity-20 border-red-700' :
      analysis.riskLevel === 'high' ? 'bg-orange-900 bg-opacity-20 border-orange-700' :
      analysis.riskLevel === 'medium' ? 'bg-yellow-900 bg-opacity-20 border-yellow-700' :
      'bg-slate-800 border-slate-700'
    }`}>
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-sky-400 flex items-center gap-2">
            <span>🛡️</span>
            Detekce podvodů a rizik
          </h3>
          {getRiskBadge(analysis.riskLevel, analysis.riskScore)}
        </div>

        {/* Recommendation */}
        <div className={`p-4 rounded-lg ${
          analysis.riskLevel === 'critical' || analysis.riskLevel === 'high'
            ? 'bg-red-900 bg-opacity-30 border border-red-700'
            : 'bg-slate-900 border border-slate-700'
        }`}>
          <div className="flex items-start gap-3">
            <span className="text-2xl">
              {analysis.riskLevel === 'critical' || analysis.riskLevel === 'high' ? '🚨' : '💡'}
            </span>
            <div>
              <div className="font-medium text-slate-200 mb-1">Doporučení AI</div>
              <div className="text-sm text-slate-300">{analysis.recommendation}</div>
            </div>
          </div>
        </div>

        {/* Risk Flags */}
        {analysis.flags.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-slate-300">Detekované rizikové faktory ({analysis.flags.length})</h4>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-sky-400 hover:text-sky-300"
              >
                {expanded ? '🔼 Skrýt' : '🔽 Rozbalit'}
              </button>
            </div>

            {expanded && (
              <div className="space-y-2">
                {analysis.flags.map((flag, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-900 rounded-lg border border-slate-700"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-1.5 ${getSeverityColor(flag.severity)}`}></div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-slate-400 uppercase">{flag.type}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            flag.severity === 'high' ? 'bg-red-900 bg-opacity-30 text-red-400' :
                            flag.severity === 'medium' ? 'bg-yellow-900 bg-opacity-30 text-yellow-400' :
                            'bg-emerald-900 bg-opacity-30 text-emerald-400'
                          }`}>
                            {flag.severity === 'high' ? '🔴 Vysoká' :
                             flag.severity === 'medium' ? '🟡 Střední' : '🟢 Nízká'}
                          </span>
                        </div>
                        <div className="text-sm text-slate-300 mb-1">{flag.description}</div>
                        {flag.evidence && (
                          <div className="text-xs text-slate-500 italic">
                            Důkaz: "{flag.evidence}"
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Analyzed At */}
        <div className="text-xs text-slate-500 text-center pt-2 border-t border-slate-700">
          Analyzováno: {new Date(analysis.analyzedAt).toLocaleString('cs-CZ')}
        </div>
      </div>
    </div>
  );
};

export default FraudAnalyzer;
