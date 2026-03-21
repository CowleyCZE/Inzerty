import React from 'react';
import { MatchItem, MatchMeta, MatchStatus } from '../../types';

// Sub-components
import { MatchCardInfo } from './MatchCardInfo';
import { StatusControls } from './StatusControls';
import { DueDiligenceChecklist } from './DueDiligenceChecklist';
import { MatchActions } from './MatchActions';

interface MatchCardProps {
  matchKey: string;
  match: MatchItem;
  meta: MatchMeta;
  selectedMatches: Set<string>;
  toggleSelectMatch: (key: string) => void;
  statusLabel: Record<MatchStatus, string>;
  updateMatchMeta: (key: string, data: Partial<MatchMeta>) => void;
  runAutonomousProcess: (match: MatchItem) => void;
  runningAutomation: Set<string>;
  automationResults: Record<string, any>;
}

export const MatchCard: React.FC<MatchCardProps> = ({
  matchKey,
  match,
  meta,
  selectedMatches,
  toggleSelectMatch,
  statusLabel,
  updateMatchMeta,
  runAutonomousProcess,
  runningAutomation,
  automationResults,
}) => {
  const scoreDetails = `
Detail skóre reálné příležitosti:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Zisk (net): ${match.arbitrageScore || 0} Kč → ${(Math.min(((match.arbitrageScore || 0) - 400) / 7000 * 100, 100)).toFixed(0)} bodů (28%)
Podobnost inzerátů: ${(match.similarity || 0).toFixed(0)}% → ${(match.similarity || 0) * 0.23} bodů (23%)
Marže: ${match.expectedNetProfit ? (((match.demand.price ? parseFloat(match.demand.price.replace(/[^0-9,-]+/g, '').replace(',', '.')) : 0) - match.expectedNetProfit) / (match.demand.price ? parseFloat(match.demand.price.replace(/[^0-9,-]+/g, '').replace(',', '.')) : 0) * 100).toFixed(1) : 'N/A'}% → ${(match.marginScore || 0).toFixed(0)} bodů (16%)
Stáří inzerátů: ${(match.freshness || 0).toFixed(0)}% → ${(match.freshness || 0) * 0.13} bodů (13%)
Lokalita: ${(match.locationScore || 0).toFixed(0)}% → ${(match.locationScore || 0) * 0.10} bodů (10%)
Důvěryhodnost ceny: ${(match.priceTrustScore || 0).toFixed(0)}% → ${(match.priceTrustScore || 0) * 0.10} bodů (10%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CELKEM: ${match.realOpportunityScore || 0} bodů (0-100)
  `.trim();

  const handleUpdateMeta = (patch: Partial<MatchMeta>) => {
    updateMatchMeta(matchKey, patch);
  };

  const handleScheduleFollowUp = () => {
    const next24h = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    handleUpdateMeta({ followUpAt: next24h, followUpState: 'waiting' });
  };

  const handleToggleResolved = () => {
    handleUpdateMeta({ resolved: !meta.resolved });
  };

  return (
    <div className={`bg-slate-700/50 rounded-xl p-5 border transition-all ${meta.resolved ? 'border-slate-800 opacity-60 grayscale-[0.2]' : 'border-slate-600 hover:border-slate-500 shadow-lg'} mb-4`}>
      {/* Header with checkboxes and scores */}
      <div className="flex flex-wrap justify-between gap-2 mb-3 items-center">
        <div className="flex items-center gap-3">
          <input 
            type="checkbox" 
            checked={selectedMatches.has(matchKey)} 
            onChange={() => toggleSelectMatch(matchKey)}
            className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-amber-600 focus:ring-amber-500 cursor-pointer"
            title="Označit pro hromadnou akci"
          />
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase transition-colors ${meta.resolved ? 'bg-slate-800 text-slate-500' : 'bg-emerald-900/40 text-emerald-400'}`}>
              {statusLabel[meta.status]}
            </span>
            <span className="hidden sm:inline">·</span>
            <span className="text-slate-400">Priorita: <b className="text-slate-200">{meta.priority}</b></span>
            <span className="hidden sm:inline">·</span>
            <span className="text-xs text-slate-500">
              Poslední akce: {new Date(meta.lastActionAt).toLocaleString('cs-CZ')}
            </span>
          </div>
        </div>
        <div className="text-right flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-sm text-slate-400">Předpokládaný zisk</span>
            <span className="text-lg font-bold text-emerald-400">
              +{match.arbitrageScore?.toLocaleString('cs-CZ')} Kč
            </span>
          </div>
          <div className="h-10 w-[1px] bg-slate-600 mx-1 hidden sm:block"></div>
          <div className="flex flex-col items-end group">
            <span className="text-sm text-slate-400 cursor-help flex items-center gap-1" title={scoreDetails}>
              Opportunity <span className="text-[10px] bg-slate-600 w-4 h-4 flex items-center justify-center rounded-full">?</span>
            </span>
            <span className="text-lg font-bold text-amber-400">
              {match.realOpportunityScore || match.opportunityScore || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Comparison Grid */}
      <MatchCardInfo match={match} />

      {/* Status Controls */}
      {!meta.resolved && (
        <>
          <StatusControls 
            meta={meta} 
            updateMatchMeta={handleUpdateMeta} 
          />

          <textarea 
            value={meta.note} 
            onChange={(e) => handleUpdateMeta({ note: e.target.value })} 
            placeholder="Přidat interní poznámku k této arbitráži..." 
            className="mt-3 w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:border-emerald-500 transition-colors min-h-[60px]" 
          />

          <DueDiligenceChecklist 
            checklist={meta.checklist}
            updateChecklist={(patch) => handleUpdateMeta({ checklist: { ...meta.checklist, ...patch } })}
          />
        </>
      )}

      {/* Action Buttons */}
      <MatchActions 
        match={match}
        runAutonomousProcess={runAutonomousProcess}
        runningAutomation={runningAutomation}
        automationResults={automationResults}
        onScheduleFollowUp={handleScheduleFollowUp}
        onToggleResolved={handleToggleResolved}
        isResolved={meta.resolved}
      />
    </div>
  );
};
