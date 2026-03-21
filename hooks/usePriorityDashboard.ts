import { useState, useEffect, useCallback } from 'react';

export interface PrioritizedMatch {
  matchKey: string;
  overallScore: number;
  recommendation: 'prioritize' | 'normal' | 'skip';
  offer: { title: string; price: string };
  demand: { title: string; price: string };
  arbitrageScore: number;
  calculatedAt: string;
}

export interface PriorityStats {
  totalMatches: number;
  prioritizeCount: number;
  normalCount: number;
  skipCount: number;
  avgScore: number;
}

export const usePriorityDashboard = () => {
  const [matches, setMatches] = useState<PrioritizedMatch[]>([]);
  const [stats, setStats] = useState<PriorityStats | null>(null);
  const [filter, setFilter] = useState<'all' | 'prioritize' | 'normal' | 'skip'>('all');
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'capacity' | 'accuracy' | 'auto' | 'trends'>('overview');

  const loadPriorities = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadPriorities();
  }, [loadPriorities]);

  const recalculateAll = async () => {
    setRecalculating(true);
    try {
      const response = await fetch('http://localhost:3001/priority/recalculate-all', {
        method: 'POST',
      });
      if (response.ok) {
        await loadPriorities();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Chyba při přepočítávání:', error);
      return false;
    } finally {
      setRecalculating(false);
    }
  };

  const filteredMatches = matches.filter(m => filter === 'all' || m.recommendation === filter);

  return {
    matches,
    stats,
    filter,
    setFilter,
    loading,
    recalculating,
    activeTab,
    setActiveTab,
    filteredMatches,
    recalculateAll,
    loadPriorities,
  };
};
