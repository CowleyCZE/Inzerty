import { useState, useEffect } from 'react';
import { MatchItem } from '../types';

interface UsePreviouslySeenOptions {
  matchedAds: MatchItem[];
  getMatchKey: (offer: any, demand: any) => string;
}

export const usePreviouslySeen = ({ matchedAds, getMatchKey }: UsePreviouslySeenOptions) => {
  const [previouslySeenKeys, setPreviouslySeenKeys] = useState<Set<string>>(new Set());

  // Load previously seen matches for deduplication
  useEffect(() => {
    const loadPreviouslySeen = async () => {
      try {
        const res = await fetch('http://localhost:3001/matches/seen');
        if (res.ok) {
          const data = await res.json();
          setPreviouslySeenKeys(new Set(data.seenKeys));
        }
      } catch {
        // Server may not have dedup endpoint
      }
    };
    loadPreviouslySeen();
  }, []);

  // Auto-mark displayed matches as seen after 3 seconds
  useEffect(() => {
    if (!matchedAds.length) return;
    
    const timer = setTimeout(async () => {
      const newMatchKeys = matchedAds
        .map((m) => getMatchKey(m.offer, m.demand))
        .filter((key) => !previouslySeenKeys.has(key));
      
      if (newMatchKeys.length > 0) {
        try {
          await fetch('http://localhost:3001/matches/mark-seen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matchKeys: newMatchKeys }),
          });
          setPreviouslySeenKeys((prev) => new Set([...Array.from(prev), ...newMatchKeys]));
        } catch {
          // Silently fail - dedup is not critical
        }
      }
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [matchedAds, previouslySeenKeys, getMatchKey]);

  return {
    previouslySeenKeys,
    setPreviouslySeenKeys,
  };
};
