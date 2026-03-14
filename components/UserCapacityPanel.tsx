import React, { useEffect, useState } from 'react';

interface UserCapacity {
  max_active_deals: number;
  current_active_deals: number;
  available_capacity: number;
  capacity_percentage: number;
  preferred_brands: string[];
  workload_status: 'volný' | 'vytížený' | 'plný';
}

interface UserCapacityPanelProps {
  onCapacityChange?: (capacity: UserCapacity) => void;
}

const UserCapacityPanel: React.FC<UserCapacityPanelProps> = ({ onCapacityChange }) => {
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

  useEffect(() => {
    loadCapacity();
  }, []);

  const loadCapacity = async () => {
    try {
      const response = await fetch('http://localhost:3001/priority/user-capacity');
      if (response.ok) {
        const data = await response.json();
        if (data.capacity) {
          setCapacity(data.capacity);
        }
      }
    } catch (error) {
      console.error('Chyba při načítání kapacity:', error);
    } finally {
      setLoading(false);
    }
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
        alert('✅ Kapacita uložena!');
        onCapacityChange?.(capacity);
      }
    } catch (error) {
      alert('❌ Chyba při ukládání kapacity');
    } finally {
      setSaving(false);
    }
  };

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

  const getWorkloadStatus = (percentage: number) => {
    if (percentage >= 50) return 'volný';
    if (percentage >= 20) return 'vytížený';
    return 'plný';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'volný': return 'text-emerald-400';
      case 'vytížený': return 'text-yellow-400';
      case 'plný': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  const toggleBrand = (brand: string) => {
    setCapacity(prev => ({
      ...prev,
      preferred_brands: prev.preferred_brands.includes(brand)
        ? prev.preferred_brands.filter(b => b !== brand)
        : [...prev.preferred_brands, brand],
    }));
  };

  const brands = ['Apple', 'Samsung', 'Huawei', 'Xiaomi', 'Motorola', 'Nokia', 'Sony', 'Oppo', 'Realme', 'OnePlus'];

  if (loading) {
    return <div className="text-slate-400">Načítám kapacitu uživatele...</div>;
  }

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-sky-400 flex items-center gap-2">
          <span>👤</span>
          Sledování kapacity uživatele
        </h3>
      </div>

      {/* Capacity Overview */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="text-xs text-slate-400 mb-1">Maximální počet obchodů</div>
          <div className="text-2xl font-bold text-white">{capacity.max_active_deals}</div>
        </div>
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="text-xs text-slate-400 mb-1">Aktivní obchody</div>
          <div className="text-2xl font-bold text-blue-400">{capacity.current_active_deals}</div>
        </div>
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="text-xs text-slate-400 mb-1">Dostupná kapacita</div>
          <div className={`text-2xl font-bold ${getStatusColor(capacity.workload_status)}`}>
            {capacity.available_capacity}
          </div>
        </div>
      </div>

      {/* Workload Status */}
      <div className={`p-4 rounded-lg border-2 ${
        capacity.workload_status === 'volný' ? 'bg-emerald-900 bg-opacity-20 border-emerald-600' :
        capacity.workload_status === 'vytížený' ? 'bg-yellow-900 bg-opacity-20 border-yellow-600' :
        'bg-red-900 bg-opacity-20 border-red-600'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-300">Stav vytížení</div>
            <div className={`text-xl font-bold ${getStatusColor(capacity.workload_status)}`}>
              {capacity.workload_status === 'volný' && '🟢 Volný - Může přijímat nové obchody'}
              {capacity.workload_status === 'vytížený' && '🟡 Vytížený - Omezená kapacita'}
              {capacity.workload_status === 'plný' && '🔴 Plný - Nedoporučuje se přijímat nové obchody'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-400">Využití kapacity</div>
            <div className={`text-3xl font-bold ${getStatusColor(capacity.workload_status)}`}>
              {Math.round(capacity.capacity_percentage)}%
            </div>
          </div>
        </div>
      </div>

      {/* Capacity Slider */}
      <div className="bg-slate-900 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-300">
            Maximální počet aktivních obchodů
          </label>
          <span className="text-2xl font-bold text-sky-400">{capacity.max_active_deals}</span>
        </div>
        <input
          type="range"
          min="1"
          max="50"
          value={capacity.max_active_deals}
          onChange={(e) => handleMaxDealsChange(Number(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
        />
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>1</span>
          <span>25</span>
          <span>50</span>
        </div>
      </div>

      {/* Preferred Brands */}
      <div className="bg-slate-900 rounded-lg p-4">
        <h4 className="text-sm font-medium text-slate-300 mb-3">Preferované značky</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {brands.map((brand) => (
            <button
              key={brand}
              onClick={() => toggleBrand(brand)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                capacity.preferred_brands.includes(brand)
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {capacity.preferred_brands.includes(brand) ? '✅' : '⚪'} {brand}
            </button>
          ))}
        </div>
      </div>

      {/* Capacity Impact Info */}
      <div className="bg-sky-900 bg-opacity-20 border border-sky-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div className="text-sm text-sky-200">
            <div className="font-medium mb-1">Jak funguje sledování kapacity:</div>
            <ul className="list-disc list-inside space-y-1 text-sky-300">
              <li>Vyšší dostupná kapacita = vyšší priorita pro nové obchody</li>
              <li>Při plné kapacitě se priorita automaticky snižuje</li>
              <li>Preferované značky mají vyšší prioritu</li>
              <li>Kapacita se aktualizuje při změně stavu obchodu</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-slate-700">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors"
        >
          {saving ? '💾 Ukládám...' : '💾 Uložit kapacitu'}
        </button>
      </div>
    </div>
  );
};

export default UserCapacityPanel;
