import React, { useEffect, useState } from 'react';

interface MarketTrend {
  brand: string;
  trend: 'rostoucí' | 'klesající' | 'stabilní';
  demand_change_percentage: number;
  avg_price_change_percentage: number;
  popular_models: string[];
  last_updated: string;
}

interface RealMarketTrendsPanelProps {
  onTrendsChange?: (trends: MarketTrend[]) => void;
}

const RealMarketTrendsPanel: React.FC<RealMarketTrendsPanelProps> = ({ onTrendsChange }) => {
  const [trends, setTrends] = useState<MarketTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTrends();
  }, []);

  const loadTrends = async () => {
    try {
      const response = await fetch('http://localhost:3001/priority/market-trends');
      if (response.ok) {
        const data = await response.json();
        if (data.trends) {
          setTrends(data.trends);
          onTrendsChange?.(data.trends);
        }
      }
    } catch (error) {
      console.error('Chyba při načítání trendů:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshTrends = async () => {
    setRefreshing(true);
    await loadTrends();
    setRefreshing(false);
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'rostoucí': return '📈';
      case 'klesající': return '📉';
      case 'stabilní': return '➡️';
      default: return '❓';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'rostoucí': return 'text-emerald-400';
      case 'klesající': return 'text-red-400';
      case 'stabilní': return 'text-blue-400';
      default: return 'text-slate-400';
    }
  };

  const getChangeColor = (change: number) => {
    if (change > 10) return 'text-emerald-400';
    if (change > 0) return 'text-emerald-300';
    if (change < -10) return 'text-red-400';
    if (change < 0) return 'text-red-300';
    return 'text-slate-400';
  };

  if (loading) {
    return <div className="text-slate-400">Načítám tržní trendy...</div>;
  }

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-sky-400 flex items-center gap-2">
          <span>📊</span>
          Tržní trendy
        </h3>
        <button
          onClick={refreshTrends}
          disabled={refreshing}
          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {refreshing ? '🔄 Obnovuji...' : '🔄 Obnovit'}
        </button>
      </div>

      {/* Trends Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {trends.map((trend) => (
          <div
            key={trend.brand}
            className="bg-slate-900 rounded-lg p-4 border border-slate-700"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{getTrendIcon(trend.trend)}</span>
                <div>
                  <div className="font-bold text-white">{trend.brand}</div>
                  <div className={`text-xs font-medium ${getTrendColor(trend.trend)}`}>
                    {trend.trend}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Změna poptávky</span>
                <span className={`font-bold ${getChangeColor(trend.demand_change_percentage)}`}>
                  {trend.demand_change_percentage > 0 ? '+' : ''}{trend.demand_change_percentage}%
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Změna průměrné ceny</span>
                <span className={`font-bold ${getChangeColor(trend.avg_price_change_percentage)}`}>
                  {trend.avg_price_change_percentage > 0 ? '+' : ''}{trend.avg_price_change_percentage}%
                </span>
              </div>
            </div>

            {trend.popular_models.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-700">
                <div className="text-xs text-slate-400 mb-2">Populární modely:</div>
                <div className="flex flex-wrap gap-1">
                  {trend.popular_models.slice(0, 3).map((model, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300"
                    >
                      {model}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 text-xs text-slate-500">
              Aktualizováno: {new Date(trend.last_updated).toLocaleString('cs-CZ')}
            </div>
          </div>
        ))}
      </div>

      {trends.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          <div className="text-4xl mb-3">📊</div>
          <div>Žádná data o tržních trendech</div>
          <div className="text-sm mt-2">Klikněte na "Obnovit" pro načtení aktuálních trendů</div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-sky-900 bg-opacity-20 border border-sky-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div className="text-sm text-sky-200">
            <div className="font-medium mb-1">Jak fungují tržní trendy:</div>
            <ul className="list-disc list-inside space-y-1 text-sky-300">
              <li>Sleduje se poptávka po jednotlivých značkách a modelech</li>
              <li>Rostoucí trend = vyšší priorita pro obchody s danou značkou</li>
              <li>Klesající trend = nižší priorita, opatrnost při nákupu</li>
              <li>Data se aktualizují každých 24 hodin</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealMarketTrendsPanel;
