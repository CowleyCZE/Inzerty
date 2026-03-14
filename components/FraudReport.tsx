import React, { useEffect, useState } from 'react';

interface FraudReport {
  totalAnalyzed: number;
  lowRisk: number;
  mediumRisk: number;
  highRisk: number;
  criticalRisk: number;
  watchlistCount: number;
  topFraudTypes: { type: string; count: number }[];
}

interface FraudReportProps {
  onRefresh?: () => void;
}

const FraudReport: React.FC<FraudReportProps> = ({ onRefresh }) => {
  const [report, setReport] = useState<FraudReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/fraud/report');
      if (response.ok) {
        const data = await response.json();
        setReport(data.report);
      }
    } catch (error) {
      console.error('Error loading fraud report:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-slate-400">Načítám fraud report...</div>;
  }

  if (!report) {
    return (
      <div className="text-center py-12 text-slate-400">
        <div className="text-4xl mb-3">📊</div>
        <div>Žádná data k zobrazení</div>
        <button
          onClick={loadReport}
          className="mt-4 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg"
        >
          🔄 Načíst report
        </button>
      </div>
    );
  }

  const totalHighRisk = report.highRisk + report.criticalRisk;
  const riskPercentage = report.totalAnalyzed > 0 
    ? ((totalHighRisk / report.totalAnalyzed) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-red-400 flex items-center gap-2">
          <span>🛡️</span>
          Fraud Detection Report
        </h2>
        <button
          onClick={() => { loadReport(); onRefresh?.(); }}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-medium transition-colors"
        >
          🔄 Obnovit
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-xs text-slate-400 mb-1">Celkem analyzováno</div>
          <div className="text-2xl font-bold text-white">{report.totalAnalyzed}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-xs text-slate-400 mb-1">✅ Nízké riziko</div>
          <div className="text-2xl font-bold text-emerald-400">{report.lowRisk}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-xs text-slate-400 mb-1">⚠️ Střední riziko</div>
          <div className="text-2xl font-bold text-yellow-400">{report.mediumRisk}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-xs text-slate-400 mb-1">🔴 Vysoké riziko</div>
          <div className="text-2xl font-bold text-orange-400">{report.highRisk}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-xs text-slate-400 mb-1">🚨 Kritické</div>
          <div className="text-2xl font-bold text-red-400">{report.criticalRisk}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-xs text-slate-400 mb-1">📋 Watchlist</div>
          <div className="text-2xl font-bold text-purple-400">{report.watchlistCount}</div>
        </div>
      </div>

      {/* Risk Summary */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-slate-200 mb-4">Přehled rizikovosti</h3>
        
        <div className="flex items-center gap-4 mb-4">
          <div className="text-sm text-slate-400">Vysokorizikové obchody:</div>
          <div className={`text-xl font-bold ${
            Number(riskPercentage) >= 20 ? 'text-red-400' :
            Number(riskPercentage) >= 10 ? 'text-yellow-400' : 'text-emerald-400'
          }`}>
            {riskPercentage}%
          </div>
          <div className="text-sm text-slate-500">({totalHighRisk} z {report.totalAnalyzed})</div>
        </div>

        <div className="w-full bg-slate-700 rounded-full h-4">
          <div
            className="h-4 rounded-full bg-gradient-to-r from-emerald-500 via-yellow-500 to-red-500"
            style={{ 
              width: `${report.totalAnalyzed > 0 ? ((report.lowRisk / report.totalAnalyzed) * 100) : 0}%` 
            }}
          ></div>
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-400">
          <span>Nízké ({report.lowRisk})</span>
          <span>Střední ({report.mediumRisk})</span>
          <span>Vysoké ({totalHighRisk})</span>
        </div>
      </div>

      {/* Top Fraud Types */}
      {report.topFraudTypes.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-slate-200 mb-4">Nejčastější typy podvodů</h3>
          <div className="space-y-3">
            {report.topFraudTypes.map((fraud, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-300">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-200">{fraud.type}</div>
                  <div className="w-full bg-slate-700 rounded-full h-2 mt-1">
                    <div
                      className="h-2 rounded-full bg-red-500"
                      style={{ 
                        width: `${report.totalAnalyzed > 0 ? ((fraud.count / report.totalAnalyzed) * 100) : 0}%` 
                      }}
                    ></div>
                  </div>
                </div>
                <div className="text-sm font-bold text-red-400 w-12 text-right">
                  {fraud.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Safety Tips */}
      <div className="bg-emerald-900 bg-opacity-20 border border-emerald-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-emerald-400 mb-3 flex items-center gap-2">
          <span>💡</span>
          Bezpečnostní tipy
        </h3>
        <ul className="space-y-2 text-sm text-emerald-200">
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>Vždy se scházejte na veřejných místech s kamerovým systémem</span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>Nikdy neposílejte peníze předem neznámým prodejcem</span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>Zkontrolujte IMEI číslo před koupí</span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>Při podezřele nízké ceně buďte obzvláště opatrní</span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>Trvejte na osobním předání a vyzkoušení zařízení</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default FraudReport;
