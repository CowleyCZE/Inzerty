import React from 'react';
import { MatchMeta, MatchStatus, MatchPriority } from '../../types';

interface StatusControlsProps {
  meta: MatchMeta;
  updateMatchMeta: (patch: Partial<MatchMeta>) => void;
}

export const StatusControls: React.FC<StatusControlsProps> = ({ meta, updateMatchMeta }) => {
  return (
    <div className="grid md:grid-cols-4 gap-2 mt-3">
      <div className="flex flex-col">
        <label className="text-[10px] text-slate-500 uppercase font-bold px-1 mb-0.5">Stav</label>
        <select 
          value={meta.status} 
          onChange={(e) => updateMatchMeta({ status: e.target.value as MatchStatus })} 
          className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:border-emerald-500 transition-colors"
        >
          <option value="new">Nové</option>
          <option value="review">Prověřit</option>
          <option value="contacted">Kontaktováno</option>
          <option value="negotiation">Vyjednávání</option>
          <option value="closed">Uzavřeno</option>
        </select>
      </div>

      <div className="flex flex-col">
        <label className="text-[10px] text-slate-500 uppercase font-bold px-1 mb-0.5">Priorita</label>
        <select 
          value={meta.priority} 
          onChange={(e) => updateMatchMeta({ priority: e.target.value as MatchPriority })} 
          className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:border-emerald-500 transition-colors"
        >
          <option value="low">Nízká</option>
          <option value="medium">Střední</option>
          <option value="high">Vysoká</option>
          <option value="critical">Kritická</option>
        </select>
      </div>

      <div className="flex flex-col">
        <label className="text-[10px] text-slate-500 uppercase font-bold px-1 mb-0.5">Follow-up datum</label>
        <input 
          type="datetime-local" 
          value={meta.followUpAt ? meta.followUpAt.slice(0, 16) : ''} 
          onChange={(e) => updateMatchMeta({ followUpAt: e.target.value, followUpState: 'waiting' })} 
          className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:border-emerald-500 transition-colors" 
        />
      </div>

      <div className="flex flex-col">
        <label className="text-[10px] text-slate-500 uppercase font-bold px-1 mb-0.5">Follow-up stav</label>
        <select 
          value={meta.followUpState} 
          onChange={(e) => updateMatchMeta({ followUpState: e.target.value as any })} 
          className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:border-emerald-500 transition-colors"
        >
          <option value="none">Bez reminderu</option>
          <option value="waiting">Čeká se</option>
          <option value="no_response">Neodpověděl</option>
          <option value="done">Hotovo</option>
        </select>
      </div>
    </div>
  );
};
