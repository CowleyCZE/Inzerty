import { useState, useEffect, useCallback } from 'react';

export interface AnalyticsData {
  total_deals: number;
  closed_deals: number;
  avg_profit: number;
  avg_time_to_close: number;
  total_revenue: number;
  avg_success_rate: number;
}

export const useAnalytics = (period: number = 30) => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
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
  }, [period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    analytics,
    deals,
    loading,
    refresh: fetchAnalytics,
  };
};
