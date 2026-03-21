import { useState, useEffect } from 'react';

export interface FraudThresholds {
  low_risk_max: number;
  medium_risk_max: number;
  high_risk_max: number;
  critical_risk_min: number;
  auto_watchlist_threshold: number;
  enabled: boolean;
}

export const useFraudThresholds = () => {
  const [thresholds, setThresholds] = useState<FraudThresholds>({
    low_risk_max: 24,
    medium_risk_max: 49,
    high_risk_max: 79,
    critical_risk_min: 80,
    auto_watchlist_threshold: 80,
    enabled: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadThresholds = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/fraud/thresholds');
      if (response.ok) {
        const data = await response.json();
        if (data.thresholds) setThresholds(data.thresholds);
      }
    } catch (error) {
      console.error('Chyba při načítání prahů:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThresholds();
  }, []);

  const handleSave = async () => {
    // Validate thresholds
    if (thresholds.low_risk_max >= thresholds.medium_risk_max) {
      alert('⚠️ Low risk maximum musí být menší než Medium risk maximum');
      return false;
    }
    if (thresholds.medium_risk_max >= thresholds.high_risk_max) {
      alert('⚠️ Medium risk maximum musí být menší než High risk maximum');
      return false;
    }
    if (thresholds.high_risk_max >= thresholds.critical_risk_min) {
      alert('⚠️ High risk maximum musí být menší než Critical risk minimum');
      return false;
    }

    setSaving(true);
    try {
      const response = await fetch('http://localhost:3001/fraud/thresholds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(thresholds),
      });

      return response.ok;
    } catch (error) {
      return false;
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    setThresholds({
      low_risk_max: 24,
      medium_risk_max: 49,
      high_risk_max: 79,
      critical_risk_min: 80,
      auto_watchlist_threshold: 80,
      enabled: true,
    });
  };

  const updateThreshold = (field: keyof FraudThresholds, value: any) => {
    setThresholds(prev => ({ ...prev, [field]: value }));
  };

  return {
    thresholds,
    loading,
    saving,
    handleSave,
    resetToDefault,
    updateThreshold,
  };
};
