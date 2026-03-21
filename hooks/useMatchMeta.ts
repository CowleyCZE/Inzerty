import { useState, useEffect } from 'react';
import { MatchMeta, MatchStatus, MatchPriority, DueDiligenceChecklist } from '../types';

const STORAGE_KEY = 'inzerty_match_meta_v2';

export const defaultMeta = (): MatchMeta => ({
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
});

export const useMatchMeta = () => {
  const [metaByMatch, setMetaByMatch] = useState<Record<string, MatchMeta>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setMetaByMatch(JSON.parse(raw));
    } catch {
      setMetaByMatch({});
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(metaByMatch));
  }, [metaByMatch]);

  const updateMatchMeta = async (matchKey: string, patch: Partial<MatchMeta>) => {
    const next = {
      ...defaultMeta(),
      ...(metaByMatch[matchKey] || {}),
      ...patch,
      lastActionAt: new Date().toISOString(),
    };
    
    setMetaByMatch((prev) => ({ ...prev, [matchKey]: next }));
    
    try {
      await fetch('http://localhost:3001/match-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchKey, ...next }),
      });
    } catch (e) {
      console.warn('Sync s backendem selhal', e);
    }
  };

  const updateStatus = (matchKey: string, status: MatchStatus) =>
    updateMatchMeta(matchKey, { status });

  const updatePriority = (matchKey: string, priority: MatchPriority) =>
    updateMatchMeta(matchKey, { priority });

  const updateChecklist = (matchKey: string, checklist: Partial<DueDiligenceChecklist>) =>
    updateMatchMeta(matchKey, { 
      checklist: { ...(metaByMatch[matchKey]?.checklist || defaultMeta().checklist), ...checklist } 
    });

  const toggleResolved = (matchKey: string) =>
    updateMatchMeta(matchKey, { resolved: !metaByMatch[matchKey]?.resolved });

  return {
    metaByMatch,
    updateMatchMeta,
    updateStatus,
    updatePriority,
    updateChecklist,
    toggleResolved,
  };
};
