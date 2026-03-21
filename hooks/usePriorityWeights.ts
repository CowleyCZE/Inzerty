import { useState, useEffect, useCallback } from 'react';

export interface PriorityWeights {
  profit_weight: number;
  trust_weight: number;
  urgency_weight: number;
  market_weight: number;
  capacity_weight: number;
}

export const usePriorityWeights = (onWeightsChange?: (weights: PriorityWeights) => void) => {
  const [weights, setWeights] = useState<PriorityWeights>({
    profit_weight: 30,
    trust_weight: 25,
    urgency_weight: 20,
    market_weight: 15,
    capacity_weight: 10,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [totalWeight, setTotalWeight] = useState(100);

  const calculateTotal = useCallback((w: PriorityWeights) => {
    return w.profit_weight + w.trust_weight + w.urgency_weight + w.market_weight + w.capacity_weight;
  }, []);

  useEffect(() => {
    setTotalWeight(calculateTotal(weights));
  }, [weights, calculateTotal]);

  const loadWeights = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/priority/weights');
      if (response.ok) {
        const data = await response.json();
        if (data.weights) setWeights(data.weights);
      }
    } catch (error) {
      console.error('Chyba při načítání vah:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWeights();
  }, []);

  const handleSave = async () => {
    if (totalWeight !== 100) return false;

    setSaving(true);
    try {
      const response = await fetch('http://localhost:3001/priority/weights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(weights),
      });

      if (response.ok) {
        onWeightsChange?.(weights);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleWeightChange = (field: keyof PriorityWeights, value: number) => {
    if (value < 0 || value > 100) return;
    setWeights(prev => ({ ...prev, [field]: value }));
  };

  const resetToDefault = () => {
    setWeights({
      profit_weight: 30,
      trust_weight: 25,
      urgency_weight: 20,
      market_weight: 15,
      capacity_weight: 10,
    });
  };

  return {
    weights,
    loading,
    saving,
    totalWeight,
    handleWeightChange,
    handleSave,
    resetToDefault,
  };
};
