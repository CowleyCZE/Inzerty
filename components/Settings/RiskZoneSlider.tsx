import React from 'react';

interface RiskZoneSliderProps {
  label: string;
  rangeText: string;
  icon: string;
  value: number;
  min: number;
  max: number;
  colorClass: string;
  disabled?: boolean;
  onChange: (val: number) => void;
}

export const RiskZoneSlider: React.FC<RiskZoneSliderProps> = ({
  label, rangeText, icon, value, min, max, colorClass, disabled, onChange,
}) => {
  return (
    <div className={`bg-slate-900 rounded-xl p-4 transition-all border border-transparent hover:border-slate-700 shadow-sm group ${disabled ? 'opacity-50 grayscale select-none' : 'hover:bg-slate-850'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`text-2xl w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 border border-slate-700 group-hover:scale-110 transition-transform shadow-md ${colorClass.replace('accent-', 'text-')}`}>
            {icon}
          </div>
          <div>
            <div className={`font-semibold text-sm ${colorClass.replace('accent-', 'text-')}`}>{label}</div>
            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{rangeText}</div>
          </div>
        </div>
        <div className={`text-2xl font-black w-14 text-right font-mono ${colorClass.replace('accent-', 'text-')}`}>
          {value}
        </div>
      </div>
      <div className="relative h-2 rounded-full overflow-hidden bg-slate-800 border border-slate-700">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className={`absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 appearance-none disabled:cursor-not-allowed`}
        />
        <div 
          className={`h-full ${colorClass.replace('accent-', 'bg-')} transition-all duration-300 shadow-lg`}
          style={{ width: `${((value - min) / (max - min)) * 100}%` }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-slate-600 mt-1.5 font-bold uppercase px-0.5">
        <span>{min}</span>
        <span>{Math.round((max + min) / 2)}</span>
        <span>{max}</span>
      </div>
    </div>
  );
};
