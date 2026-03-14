import React, { useEffect, useState } from 'react';

interface AnalyticsData {
  total_deals: number;
  closed_deals: number;
  avg_profit: number;
  avg_time_to_close: number;
  total_revenue: number;
  avg_success_rate: number;
}

interface AnalyticsChartsProps {
  period?: number; // days, default 30
}

const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ period = 30 }) => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [analyticsRes, dealsRes] = await Promise.all([
        fetch('http://localhost:3001/analytics'),
        fetch(`http://localhost:3001/analytics/period/${period}`),
      ]);

      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data.analytics);
      }

      if (dealsRes.ok) {
        const data = await dealsRes.json();
        setDeals(data.deals || []);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-slate-400">Načítám analytics...</div>;
  }

  if (!analytics) {
    return <div className="text-slate-400">Žádná analytics data k dispozici</div>;
  }

  const successRate = analytics.total_deals > 0
    ? ((analytics.closed_deals / analytics.total_deals) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-xs text-slate-400 mb-1">Celkem obchodů</div>
          <div className="text-2xl font-bold text-white">{analytics.total_deals}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-xs text-slate-400 mb-1">Dokončeno</div>
          <div className="text-2xl font-bold text-green-400">{analytics.closed_deals}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-xs text-slate-400 mb-1">Průměrný zisk</div>
          <div className="text-xl font-bold text-emerald-400">
            {analytics.avg_profit ? Math.round(analytics.avg_profit).toLocaleString() : '0'} Kč
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-xs text-slate-400 mb-1">Celkový revenue</div>
          <div className="text-xl font-bold text-sky-400">
            {analytics.total_revenue ? Math.round(analytics.total_revenue).toLocaleString() : '0'} Kč
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-xs text-slate-400 mb-1">Čas k uzavření</div>
          <div className="text-xl font-bold text-purple-400">
            {analytics.avg_time_to_close ? Math.round(analytics.avg_time_to_close) : '0'}h
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-xs text-slate-400 mb-1">Úspěšnost</div>
          <div className="text-2xl font-bold text-yellow-400">{successRate}%</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-sky-400 mb-4">💰 Revenue Overview</h3>
          <div className="h-48 flex items-end justify-between gap-2">
            {deals.slice(0, 12).map((deal, idx) => {
              const height = analytics.total_revenue > 0
                ? Math.max(10, (deal.final_profit / analytics.total_revenue) * 100)
                : 10;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t transition-all hover:from-emerald-500 hover:to-emerald-300"
                    style={{ height: `${height}%` }}
                    title={`${deal.final_profit ? Math.round(deal.final_profit) : 0} Kč`}
                  ></div>
                  <div className="text-xs text-slate-500 rotate-45 origin-top-left">
                    {deal.closed_at ? new Date(deal.closed_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' }) : 'N/A'}
                  </div>
                </div>
              );
            })}
            {deals.length === 0 && (
              <div className="w-full h-full flex items-center justify-center text-slate-500">
                Žádná data
              </div>
            )}
          </div>
        </div>

        {/* Success Rate Chart */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-yellow-400 mb-4">📊 Success Rate</h3>
          <div className="flex items-center justify-center h-48">
            <div className="relative w-40 h-40">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#334155"
                  strokeWidth="12"
                />
                {/* Progress circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={Number(successRate) >= 70 ? '#10b981' : Number(successRate) >= 40 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="12"
                  strokeDasharray={`${Number(successRate) * 2.51} 251`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">{successRate}%</div>
                  <div className="text-xs text-slate-400">úspěšnost</div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm text-slate-400">Dokončeno ({analytics.closed_deals})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-slate-600"></div>
              <span className="text-sm text-slate-400">Otevřeno ({analytics.total_deals - analytics.closed_deals})</span>
            </div>
          </div>
        </div>

        {/* Time to Close Chart */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-purple-400 mb-4">⏱️ Čas k uzavření (hodiny)</h3>
          <div className="h-48 flex items-end gap-2">
            {deals.filter(d => d.time_to_close_hours).slice(0, 7).map((deal, idx) => {
              const hours = Math.round(deal.time_to_close_hours);
              const maxHours = Math.max(...deals.map(d => Math.round(d.time_to_close_hours) || 0));
              const height = maxHours > 0 ? (hours / maxHours) * 100 : 10;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-xs text-slate-400">{hours}h</div>
                  <div
                    className="w-full bg-gradient-to-t from-purple-600 to-purple-400 rounded-t transition-all hover:from-purple-500 hover:to-purple-300"
                    style={{ height: `${height}%` }}
                  ></div>
                  <div className="text-xs text-slate-500">#{idx + 1}</div>
                </div>
              );
            })}
            {deals.filter(d => d.time_to_close_hours).length === 0 && (
              <div className="w-full h-full flex items-center justify-center text-slate-500">
                Žádná data
              </div>
            )}
          </div>
        </div>

        {/* Profit Distribution */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-emerald-400 mb-4">📈 Distribuce zisků</h3>
          <div className="space-y-3">
            {(() => {
              const ranges = [
                { label: '> 5000 Kč', min: 5000, count: 0, color: 'bg-green-500' },
                { label: '2000 - 5000 Kč', min: 2000, max: 5000, count: 0, color: 'bg-emerald-500' },
                { label: '1000 - 2000 Kč', min: 1000, max: 2000, count: 0, color: 'bg-yellow-500' },
                { label: '< 1000 Kč', min: 0, max: 1000, count: 0, color: 'bg-orange-500' },
              ];

              deals.forEach(deal => {
                const profit = deal.final_profit || 0;
                ranges.forEach(range => {
                  if (range.max === undefined) {
                    if (profit >= range.min) range.count++;
                  } else if (profit >= range.min && profit < range.max) {
                    range.count++;
                  }
                });
              });

              const maxCount = Math.max(...ranges.map(r => r.count));

              return ranges.map((range, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-28 text-xs text-slate-400">{range.label}</div>
                  <div className="flex-1 bg-slate-700 rounded-full h-4">
                    <div
                      className={`${range.color} h-4 rounded-full transition-all`}
                      style={{ width: `${maxCount > 0 ? (range.count / maxCount) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <div className="w-12 text-xs text-slate-300 text-right">{range.count}</div>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsCharts;
