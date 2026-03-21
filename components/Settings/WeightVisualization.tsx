import React from 'react';
import { PriorityWeights } from '../../hooks/usePriorityWeights';

interface WeightVisualizationProps {
  weights: PriorityWeights;
  totalWeight: number;
}

export const WeightVisualization: React.FC<WeightVisualizationProps> = ({
  weights, totalWeight,
}) => {
  const normalizedTotal = totalWeight || 1; // Prevent division by zero

  const items = [
    { label: 'Profit', weight: weights.profit_weight, color: 'bg-emerald-500' },
    { label: 'Trust', weight: weights.trust_weight, color: 'bg-blue-500' },
    { label: 'Urgency', weight: weights.urgency_weight, color: 'bg-yellow-500' },
    { label: 'Market', weight: weights.market_weight, color: 'bg-purple-500' },
    { label: 'Capacity', weight: weights.capacity_weight, color: 'bg-pink-500' },
  ];

  return (
    <div className="bg-slate-900 rounded-2xl p-6 shadow-lg border border-slate-800">
      <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-widest px-1">Rozložení vlivu priority</h4>
      
      <div className="w-full h-10 rounded-xl overflow-hidden flex shadow-inner border border-slate-950">
        {items.map((item, idx) => (
          <div 
            key={idx}
            className={`${item.color} transition-all duration-700 hover:brightness-110 active:scale-x-105 active:z-10`}
            style={{ width: `${(item.weight / normalizedTotal) * 100}%` }}
            title={`${item.label}: ${item.weight}%`}
          />
        ))}
      </div>
      
      <div className="flex flex-wrap gap-x-5 gap-y-3 mt-6 text-[11px] font-medium font-sans">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 group cursor-default">
            <div className={`w-3 h-3 rounded shadow-sm ${item.color} group-hover:scale-125 transition-transform`}></div>
            <span className="text-slate-400 group-hover:text-slate-200 transition-colors">{item.label}</span>
            <span className="text-slate-500 font-mono">({item.weight}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
};
