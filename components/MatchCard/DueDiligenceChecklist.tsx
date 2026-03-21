import React from 'react';
import { DueDiligenceChecklist as DueDiligenceType } from '../../types';

interface DueDiligenceChecklistProps {
  checklist: DueDiligenceType;
  updateChecklist: (patch: Partial<DueDiligenceType>) => void;
}

export const DueDiligenceChecklist: React.FC<DueDiligenceChecklistProps> = ({
  checklist,
  updateChecklist,
}) => {
  const completedCount = Object.values(checklist).filter(Boolean).length;
  const totalCount = Object.keys(checklist).length;
  const progressPercent = (completedCount / totalCount) * 100;

  return (
    <div className="mt-4 bg-slate-800/50 border border-slate-700 rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-semibold text-emerald-400">✅ Due Diligence Checklist</h4>
        <span className="text-xs text-slate-400">
          {completedCount} / {totalCount} splněno
        </span>
      </div>
      
      {/* Progress bar */}
      <div className="w-full bg-slate-700 rounded-full h-2 mb-3">
        <div 
          className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <label className={`flex flex-col items-center justify-center p-3 rounded-lg border cursor-pointer transition-all ${checklist.imeiVerified ? 'bg-emerald-900/30 border-emerald-600' : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'}`}>
          <input 
            type="checkbox" 
            checked={checklist.imeiVerified} 
            onChange={(e) => updateChecklist({ imeiVerified: e.target.checked })} 
            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
          />
          <span className="text-xs mt-2 text-center">🆔 IMEI</span>
          <span className="text-xs text-slate-400 text-center">Ověřeno</span>
        </label>
        
        <label className={`flex flex-col items-center justify-center p-3 rounded-lg border cursor-pointer transition-all ${checklist.batteryHealthChecked ? 'bg-emerald-900/30 border-emerald-600' : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'}`}>
          <input 
            type="checkbox" 
            checked={checklist.batteryHealthChecked} 
            onChange={(e) => updateChecklist({ batteryHealthChecked: e.target.checked })} 
            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
          />
          <span className="text-xs mt-2 text-center">🔋 Baterie</span>
          <span className="text-xs text-slate-400 text-center">Zkontrolována</span>
        </label>
        
        <label className={`flex flex-col items-center justify-center p-3 rounded-lg border cursor-pointer transition-all ${checklist.displayChecked ? 'bg-emerald-900/30 border-emerald-600' : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'}`}>
          <input 
            type="checkbox" 
            checked={checklist.displayChecked} 
            onChange={(e) => updateChecklist({ displayChecked: e.target.checked })} 
            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
          />
          <span className="text-xs mt-2 text-center">📱 Displej</span>
          <span className="text-xs text-slate-400 text-center">Bez vad</span>
        </label>
        
        <label className={`flex flex-col items-center justify-center p-3 rounded-lg border cursor-pointer transition-all ${checklist.accessoriesChecked ? 'bg-emerald-900/30 border-emerald-600' : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'}`}>
          <input 
            type="checkbox" 
            checked={checklist.accessoriesChecked} 
            onChange={(e) => updateChecklist({ accessoriesChecked: e.target.checked })} 
            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
          />
          <span className="text-xs mt-2 text-center">🔌 Příslušenství</span>
          <span className="text-xs text-slate-400 text-center">Kompletní</span>
        </label>
        
        <label className={`flex flex-col items-center justify-center p-3 rounded-lg border cursor-pointer transition-all ${checklist.warrantyProofChecked ? 'bg-emerald-900/30 border-emerald-600' : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'}`}>
          <input 
            type="checkbox" 
            checked={checklist.warrantyProofChecked} 
            onChange={(e) => updateChecklist({ warrantyProofChecked: e.target.checked })} 
            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
          />
          <span className="text-xs mt-2 text-center">📄 Záruka</span>
          <span className="text-xs text-slate-400 text-center">Doklad</span>
        </label>
      </div>
    </div>
  );
};
