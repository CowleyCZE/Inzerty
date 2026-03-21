import { useState, useMemo } from 'react';
import { MatchItem, MatchMeta } from '../types';
import { defaultMeta } from './useMatchMeta';

interface UseMatchFiltersOptions {
  matches: MatchItem[];
  metaByMatch: Record<string, MatchMeta>;
  previouslySeenKeys: Set<string>;
  getMatchKey: (offer: any, demand: any) => string;
}

export const useMatchFilters = ({
  matches,
  metaByMatch,
  previouslySeenKeys,
  getMatchKey,
}: UseMatchFiltersOptions) => {
  const [minProfit, setMinProfit] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'profit' | 'opportunity'>('opportunity');
  const [hideResolved, setHideResolved] = useState(true);
  const [hidePreviouslySeen, setHidePreviouslySeen] = useState(false);

  const filteredMatches = useMemo(() => {
    let list = matches
      .filter((match) => (match.arbitrageScore || 0) >= minProfit)
      .filter((match) => {
        if (!hideResolved) return true;
        const meta = metaByMatch[getMatchKey(match.offer, match.demand)] || defaultMeta();
        return !meta.resolved;
      });

    if (hidePreviouslySeen) {
      list = list.filter((match) => !previouslySeenKeys.has(getMatchKey(match.offer, match.demand)));
    }

    return [...list].sort((a, b) => {
      if (sortBy === 'profit') return (b.arbitrageScore || 0) - (a.arbitrageScore || 0);
      return (b.realOpportunityScore || 0) - (a.realOpportunityScore || 0);
    });
  }, [matches, minProfit, sortBy, hideResolved, hidePreviouslySeen, metaByMatch, previouslySeenKeys, getMatchKey]);

  return {
    filteredMatches,
    minProfit,
    setMinProfit,
    sortBy,
    setSortBy,
    hideResolved,
    setHideResolved,
    hidePreviouslySeen,
    setHidePreviouslySeen,
  };
};
