import React, { useEffect, useState } from 'react';

interface HistoricalAccuracy {
  total_predictions: number;
  accurate_predictions: number;
  accuracy_percentage: number;
  avg_profit_predicted: number;
  avg_profit_actual: number;
  last_30_days_accuracy: number;
  prediction_trend: 'zlepšující' | 'stabilní' | 'zhoršující';
}

interface HistoricalAccuracyPanelProps {
  matchKey?: string;
}

const HistoricalAccuracyPanel: React.FC<HistoricalAccuracyPanelProps> = ({ matchKey }) => {
  const [accuracy, setAccuracy] = useState<HistoricalAccuracy | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccuracy();
  }, []);

  const loadAccuracy = async () => {
    try {
      const response = await fetch('http://localhost:3001/priority/historical-accuracy');
      if (response.ok) {
        const data = await response.json();
        if (data.accuracy) {
          setAccuracy(data.accuracy);
        }
      }
    } catch (error) {
      console.error('Chyba při načítání přesnosti:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'zlepšující': return '📈';
      case 'stabilní': return '📊';
      case 'zhoršující': return '📉';
      default: return '❓';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'zlepšující': return 'text-emerald-400';
      case 'stabilní': return 'text-blue-400';
      case 'zhoršující': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  const getAccuracyColor = (percentage: number) => {
    if (percentage >= 80) return 'text-emerald-400';
    if (percentage >= 60) return 'text-blue-400';
    if (percentage >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (loading) {
    return <div className="text-slate-400">Načítám historickou přesnost...</div>;
  }

  if (!accuracy) {
    return (
      <div className="text-center py-8 text-slate-400">
        <div className="text-4xl mb-3">📊</div>
        <div>Žádná data o přesnosti</div>
        <div className="text-sm mt-2">Pro výpočet přesnosti potřebujete alespoň 5 dokončených obchodů</div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-4">
      <h3 className="text-lg font-semibold text-sky-400 flex items-center gap-2">
        <span>🎯</span>
        Historická přesnost predikcí
      </h3>

      {/* Main Accuracy */}
      <div className={`p-4 rounded-lg border-2 ${
        accuracy.accuracy_percentage >= 80 ? 'bg-emerald-900 bg-opacity-20 border-emerald-600' :
        accuracy.accuracy_percentage >= 60 ? 'bg-blue-900 bg-opacity-20 border-blue-600' :
        accuracy.accuracy_percentage >= 40 ? 'bg-yellow-900 bg-opacity-20 border-yellow-600' :
        'bg-red-900 bg-opacity-20 border-red-600'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-400">Celková přesnost</div>
            <div className={`text-3xl font-bold ${getAccuracyColor(accuracy.accuracy_percentage)}`}>
              {Math.round(accuracy.accuracy_percentage)}%
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-400">Trend</div>
            <div className={`text-xl font-bold ${getTrendColor(accuracy.prediction_trend)}`}>
              {getTrendIcon(accuracy.prediction_trend)} {accuracy.prediction_trend}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900 rounded-lg p-3">
          <div className="text-xs text-slate-400">Celkem predikcí</div>
          <div className="text-xl font-bold text-white">{accuracy.total_predictions}</div>
        </div>
        <div className="bg-slate-900 rounded-lg p-3">
          <div className="text-xs text-slate-400">Přesných predikcí</div>
          <div className="text-xl font-bold text-emerald-400">{accuracy.accurate_predictions}</div>
        </div>
        <div className="bg-slate-900 rounded-lg p-3">
          <div className="text-xs text-slate-400">Predikovaný zisk (průměr)</div>
          <div className="text-lg font-bold text-blue-400">{Math.round(accuracy.avg_profit_predicted)} Kč</div>
        </div>
        <div className="bg-slate-900 rounded-lg p-3">
          <div className="text-xs text-slate-400">Skutečný zisk (průměr)</div>
          <div className="text-lg font-bold text-purple-400">{Math.round(accuracy.avg_profit_actual)} Kč</div>
        </div>
      </div>

      {/* Last 30 Days */}
      <div className="bg-slate-900 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-300">Přesnost za posledních 30 dní</span>
          <span className={`text-2xl font-bold ${getAccuracyColor(accuracy.last_30_days_accuracy)}`}>
            {Math.round(accuracy.last_30_days_accuracy)}%
          </span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-4">
          <div
            className={`h-4 rounded-full transition-all ${
              accuracy.last_30_days_accuracy >= 80 ? 'bg-emerald-500' :
              accuracy.last_30_days_accuracy >= 60 ? 'bg-blue-500' :
              accuracy.last_30_days_accuracy >= 40 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(100, accuracy.last_30_days_accuracy)}%` }}
          ></div>
        </div>
      </div>

      {/* Profit Comparison */}
      <div className="bg-slate-900 rounded-lg p-4">
        <h4 className="text-sm font-medium text-slate-300 mb-3">Porovnání predikovaného a skutečného zisku</h4>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-blue-400">Predikovaný zisk</span>
              <span className="text-blue-400 font-medium">{Math.round(accuracy.avg_profit_predicted)} Kč</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3">
              <div
                className="h-3 rounded-full bg-blue-500"
                style={{ width: '100%' }}
              ></div>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-purple-400">Skutečný zisk</span>
              <span className="text-purple-400 font-medium">{Math.round(accuracy.avg_profit_actual)} Kč</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3">
              <div
                className="h-3 rounded-full bg-purple-500"
                style={{ 
                  width: `${accuracy.avg_profit_predicted > 0 ? (accuracy.avg_profit_actual / accuracy.avg_profit_predicted) * 100 : 0}%` 
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-sky-900 bg-opacity-20 border border-sky-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div className="text-sm text-sky-200">
            <div className="font-medium mb-1">Jak se počítá přesnost:</div>
            <ul className="list-disc list-inside space-y-1 text-sky-300">
              <li>Predikce se považuje za přesnou pokud je skutečný zisk v rozmezí ±20% predikovaného</li>
              <li>Sleduje se přesnost za posledních 30 dní pro aktuální trend</li>
              <li>Vyšší přesnost = vyšší důvěra v AI priority scoring</li>
              <li>Minimálně 5 dokončených obchodů pro relevantní statistiku</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoricalAccuracyPanel;
