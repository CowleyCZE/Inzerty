import React from 'react';
import { MatchItem, MatchMeta, MatchStatus } from '../../types';
import { MatchCard } from '../MatchCard/MatchCard';

interface MatchListProps {
  matches: MatchItem[];
  metaByMatch: Record<string, MatchMeta>;
  selectedMatches: Set<string>;
  toggleSelectMatch: (key: string) => void;
  statusLabel: Record<MatchStatus, string>;
  updateMatchMeta: (key: string, data: Partial<MatchMeta>) => void;
  runAutonomousProcess: (match: MatchItem) => void;
  runningAutomation: Set<string>;
  automationResults: Record<string, any>;
  getMatchKey: (offer: any, demand: any) => string;
}

export const MatchList: React.FC<MatchListProps> = ({
  matches,
  metaByMatch,
  selectedMatches,
  toggleSelectMatch,
  statusLabel,
  updateMatchMeta,
  runAutonomousProcess,
  runningAutomation,
  automationResults,
  getMatchKey,
}) => {
  return (
    <div className="space-y-6">
      {matches.map((match) => {
        const matchKey = getMatchKey(match.offer, match.demand);
        const meta = metaByMatch[matchKey] || {
          status: 'new',
          note: '',
          priority: 'medium',
          lastActionAt: new Date().toISOString(),
          resolved: false,
          followUpAt: '',
          followUpState: 'none',
          checklist: {
            imeiVerified: false,
            batteryHealthChecked: false,
            displayChecked: false,
            accessoriesChecked: false,
            warrantyProofChecked: false,
          },
        };

        return (
          <MatchCard
            key={matchKey}
            matchKey={matchKey}
            match={match}
            meta={meta as MatchMeta}
            selectedMatches={selectedMatches}
            toggleSelectMatch={toggleSelectMatch}
            statusLabel={statusLabel}
            updateMatchMeta={updateMatchMeta}
            runAutonomousProcess={runAutonomousProcess}
            runningAutomation={runningAutomation}
            automationResults={automationResults}
          />
        );
      })}
    </div>
  );
};
