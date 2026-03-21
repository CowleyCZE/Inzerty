import React from 'react';

interface WeightSliderProps {
  label: string;
  description: string;
  icon: string;
  value: number;
  colorClass: string;
  onChange: (val: number) => void;
}

export const WeightSlider: React.FC<WeightSliderProps> = ({
  label, description, icon, value, colorClass, onChange,
}) => {
  return (
    <div className="bg-slate-900 rounded-xl p-4 transition-all hover:bg-slate-850 border border-transparent hover:border-slate-700 shadow-sm group">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`text-2xl w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 border border-slate-700 group-hover:scale-110 transition-transform shadow-md ${colorClass.replace('accent-', 'text-')}`}>
            {icon}
          </div>
          <div>
            <div className={`font-semibold text-sm ${colorClass.replace('accent-', 'text-')}`}>{label}</div>
            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{description}</div>
          </div>
        </div>
        <div className={`text-2xl font-black w-16 text-right font-mono ${colorClass.replace('accent-', 'text-')}`}>
          {value}%
        </div>
      </div>
      <div className="relative h-2 rounded-full overflow-hidden bg-slate-800 border border-slate-700">
        <input
          type="range"
          min="0"
          max="100"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 appearance-none`}
        />
        <div 
          className={`h-full ${colorClass.replace('accent-', 'bg-')} transition-all duration-300 shadow-lg`}
          style={{ width: `${value}%` }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-slate-600 mt-1.5 font-bold uppercase px-0.5">
        <span>0</span>
        <span>25</span>
        <span className="opacity-40">50</span>
        <span>75</span>
        <span>100</span>
      </div>
    </div>
  );
};
