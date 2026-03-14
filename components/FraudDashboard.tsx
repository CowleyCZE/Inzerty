import React, { useEffect, useState } from 'react';
import FraudReport from './FraudReport';
import FraudAnalyzer from './FraudAnalyzer';

interface FraudFlag {
  id: number;
  ad_url: string;
  ad_title: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_score: number;
  flags: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    evidence: string;
  }>;
  detected_at: string;
  is_resolved: boolean;
}

interface FraudDashboardProps {
  onResolve?: (fraudId: number) => void;
}

const FraudDashboard: React.FC<FraudDashboardProps> = ({ onResolve }) => {
  const [fraudFlags, setFraudFlags] = useState<FraudFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'critical'>('unresolved');

  useEffect(() => {
    fetchFraudFlags();
    const interval = setInterval(fetchFraudFlags, 60000); // Refresh každou minutu
    return () => clearInterval(interval);
  }, []);

  const fetchFraudFlags = async () => {
    try {
      const response = await fetch('http://localhost:3001/fraud/flags');
      if (response.ok) {
        const data = await response.json();
        setFraudFlags(data.flags || []);
      }
    } catch (error) {
      console.error('Error fetching fraud flags:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (fraudId: number) => {
    try {
      const response = await fetch(`http://localhost:3001/fraud/resolve/${fraudId}`, {
        method: 'POST',
      });
      if (response.ok) {
        onResolve?.(fraudId);
        fetchFraudFlags(); // Refresh list
      }
    } catch (error) {
      console.error('Error resolving fraud flag:', error);
    }
  };

  const getRiskColor = (riskLevel: string): string => {
    const colors: Record<string, string> = {
      low: 'bg-green-600',
      medium: 'bg-yellow-600',
      high: 'bg-orange-600',
      critical: 'bg-red-600',
    };
    return colors[riskLevel] || 'bg-slate-600';
  };

  const getRiskBadge = (riskLevel: string, riskScore: number) => {
    const colors: Record<string, string> = {
      low: 'bg-green-900 bg-opacity-30 text-green-400',
      medium: 'bg-yellow-900 bg-opacity-30 text-yellow-400',
      high: 'bg-orange-900 bg-opacity-30 text-orange-400',
      critical: 'bg-red-900 bg-opacity-30 text-red-400 animate-pulse',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[riskLevel] || 'bg-slate-700 text-slate-400'}`}>
        {riskLevel.toUpperCase()} ({riskScore})
      </span>
    );
  };

  const filteredFlags = fraudFlags.filter(flag => {
    if (filter === 'unresolved') return !flag.is_resolved;
    if (filter === 'critical') return flag.risk_level === 'critical' && !flag.is_resolved;
    return true;
  });

  const stats = {
    total: fraudFlags.length,
    unresolved: fraudFlags.filter(f => !f.is_resolved).length,
    critical: fraudFlags.filter(f => f.risk_level === 'critical' && !f.is_resolved).length,
    high: fraudFlags.filter(f => f.risk_level === 'high' && !f.is_resolved).length,
  };

  if (loading) {
    return <div className="text-slate-400">Načítám fraud dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Fraud Report */}
      <FraudReport />

      {/* Divider */}
      <div className="border-t border-slate-700 pt-6">
        <h3 className="text-lg font-semibold text-slate-300 mb-4">Historie fraud flagů</h3>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-sm text-slate-400">Celkem flagů</div>
          <div className="text-2xl font-bold text-white">{stats.total}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-sm text-slate-400">Nevyřešené</div>
          <div className="text-2xl font-bold text-yellow-400">{stats.unresolved}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-sm text-slate-400">Critical</div>
          <div className="text-2xl font-bold text-red-400">{stats.critical}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-sm text-slate-400">High Risk</div>
          <div className="text-2xl font-bold text-orange-400">{stats.high}</div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex items-center gap-2">
        <span className="text-slate-400 text-sm">Filtr:</span>
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-sm ${filter === 'all' ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300'}`}
        >
          Všechny
        </button>
        <button
          onClick={() => setFilter('unresolved')}
          className={`px-3 py-1.5 rounded-lg text-sm ${filter === 'unresolved' ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300'}`}
        >
          Nevyřešené
        </button>
        <button
          onClick={() => setFilter('critical')}
          className={`px-3 py-1.5 rounded-lg text-sm ${filter === 'critical' ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300'}`}
        >
          Critical
        </button>
      </div>

      {/* Fraud Flags List */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900 border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Risk
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Inzerát
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Risk Flags
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Detekováno
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Stav
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Akce
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredFlags.map((flag) => (
                <tr
                  key={flag.id}
                  className={`hover:bg-slate-700 hover:bg-opacity-30 transition-colors ${flag.risk_level === 'critical' ? 'bg-red-900 bg-opacity-10' : ''}`}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    {getRiskBadge(flag.risk_level, flag.risk_score)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-slate-200 font-medium">{flag.ad_title}</div>
                    <a
                      href={flag.ad_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-sky-400 hover:underline"
                    >
                      Otevřít inzerát
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {flag.flags.slice(0, 3).map((f, idx) => (
                        <div key={idx} className="text-xs text-slate-300">
                          <span className={`inline-block w-2 h-2 rounded-full mr-1 ${
                            f.severity === 'high' ? 'bg-red-500' :
                            f.severity === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                          }`}></span>
                          {f.description}
                        </div>
                      ))}
                      {flag.flags.length > 3 && (
                        <div className="text-xs text-slate-500">+{flag.flags.length - 3} dalších</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-slate-400">
                      {new Date(flag.detected_at).toLocaleString('cs-CZ')}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {flag.is_resolved ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-900 bg-opacity-30 text-green-400">
                        ✅ Vyřešeno
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-900 bg-opacity-30 text-yellow-400">
                        ⏳ Čeká na vyřešení
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {!flag.is_resolved && (
                      <button
                        onClick={() => handleResolve(flag.id)}
                        className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-xs font-medium transition-colors"
                      >
                        Označit jako vyřešené
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredFlags.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            {filter === 'unresolved' 
              ? '🎉 Žádné nevyřešené fraud flagy!'
              : 'Žádné fraud flagy k zobrazení'}
          </div>
        )}
      </div>
    </div>
  );
};

export default FraudDashboard;
