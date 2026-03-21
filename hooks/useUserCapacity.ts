import { useState, useEffect, useCallback } from 'react';

export interface UserCapacity {
  max_active_deals: number;
  current_active_deals: number;
  available_capacity: number;
  capacity_percentage: number;
  preferred_brands: string[];
  workload_status: 'volný' | 'vytížený' | 'plný';
}

export const useUserCapacity = (onCapacityChange?: (capacity: UserCapacity) => void) => {
  const [capacity, setCapacity] = useState<UserCapacity>({
    max_active_deals: 10,
    current_active_deals: 0,
    available_capacity: 10,
    capacity_percentage: 0,
    preferred_brands: [],
    workload_status: 'volný',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const getWorkloadStatus = (percentage: number) => {
    if (percentage >= 50) return 'volný';
    if (percentage >= 20) return 'vytížený';
    return 'plný';
  };

  const loadCapacity = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/priority/user-capacity');
      if (response.ok) {
        const data = await response.json();
        if (data.capacity) setCapacity(data.capacity);
      }
    } catch (error) {
      console.error('Chyba při načítání kapacity:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCapacity();
  }, [loadCapacity]);

  const handleMaxDealsChange = (value: number) => {
    const newMax = Math.max(1, Math.min(50, value));
    const available = newMax - capacity.current_active_deals;
    const percentage = (available / newMax) * 100;
    
    setCapacity(prev => ({
      ...prev,
      max_active_deals: newMax,
      available_capacity: available,
      capacity_percentage: percentage,
      workload_status: getWorkloadStatus(percentage),
    }));
  };

  const toggleBrand = (brand: string) => {
    setCapacity(prev => ({
      ...prev,
      preferred_brands: prev.preferred_brands.includes(brand)
        ? prev.preferred_brands.filter(b => b !== brand)
        : [...prev.preferred_brands, brand],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('http://localhost:3001/priority/user-capacity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(capacity),
      });

      if (response.ok) {
        onCapacityChange?.(capacity);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    capacity,
    loading,
    saving,
    handleMaxDealsChange,
    toggleBrand,
    handleSave,
  };
};
