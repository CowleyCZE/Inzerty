import React from 'react';
import { MatchItem } from '../../types';

interface MatchActionsProps {
  match: MatchItem;
  runAutonomousProcess: (match: MatchItem) => void;
  runningAutomation: Set<string>;
  automationResults: Record<string, any>;
  onScheduleFollowUp: () => void;
  onToggleResolved: () => void;
  isResolved: boolean;
}

export const MatchActions: React.FC<MatchActionsProps> = ({
  match,
  runAutonomousProcess,
  runningAutomation,
  automationResults,
  onScheduleFollowUp,
  onToggleResolved,
  isResolved,
}) => {
  const matchKey = `${match.offer.url || match.offer.id}__${match.demand.url || match.demand.id}`;
  const isRunning = runningAutomation.has(matchKey);
  const result = automationResults[matchKey];

  return (
    <div className="mt-4 flex flex-wrap gap-3 items-center">
      <button
        onClick={() => runAutonomousProcess(match)}
        disabled={isRunning}
        className={`px-5 py-3 rounded-lg font-medium flex items-center gap-2 transition-all ${
          isRunning
            ? 'bg-slate-600 cursor-not-allowed'
            : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg hover:shadow-xl'
        }`}
        title="Spustí všechny autonomní kroky: Fraud analýza, Priority scoring, Follow-up scheduling, Analytics, Meeting suggestions"
      >
        {isRunning ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Probíhá autonomní proces...
          </>
        ) : (
          <>
            <span>🚀</span>
            Spustit autonomní proces
          </>
        )}
      </button>

      {/* Automation Result Status */}
      {result && (
        <div className={`text-sm px-3 py-2 rounded-lg ${
          result.status === 'success'
            ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-700'
            : result.status === 'error'
            ? 'bg-rose-900/30 text-rose-400 border border-rose-700'
            : 'bg-slate-700 text-slate-300 border border-slate-600'
        }`}>
          {result.message}
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-2 ml-auto">
        <button
          className="px-3 py-1 bg-amber-700 hover:bg-amber-600 rounded text-sm transition-colors"
          onClick={onScheduleFollowUp}
          title="Naplánovat follow-up za 24 hodin"
        >
          ⏰ Follow-up 24h
        </button>
        <button
          className={`px-3 py-1 rounded text-sm transition-colors ${isResolved ? 'bg-emerald-700 hover:bg-emerald-600' : 'bg-rose-700 hover:bg-rose-600'}`}
          onClick={onToggleResolved}
          title={isResolved ? 'Označit jako aktivní' : 'Označit jako vyřešené'}
        >
          {isResolved ? '✅ Aktivní' : '❌ Vyřešeno'}
        </button>
      </div>
    </div>
  );
};
