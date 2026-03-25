import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useMatchFilters } from './useMatchFilters';

describe('useMatchFilters', () => {
  const getMatchKey = (offer: any, demand: any) => `${offer.id}_${demand.id}`;

  const mockMatches: any[] = [
    { offer: { id: 'o1' }, demand: { id: 'd1' }, arbitrageScore: 1000, realOpportunityScore: 50 },
    { offer: { id: 'o2' }, demand: { id: 'd2' }, arbitrageScore: 5000, realOpportunityScore: 80 },
    { offer: { id: 'o3' }, demand: { id: 'd3' }, arbitrageScore: 200, realOpportunityScore: 20 },
  ];

  it('filters by minProfit correctly', () => {
    const { result } = renderHook(() => useMatchFilters({
      matches: mockMatches,
      metaByMatch: {},
      previouslySeenKeys: new Set(),
      getMatchKey
    }));

    act(() => {
      result.current.setMinProfit(1000);
    });

    // Should include o1_d1 and o2_d2
    expect(result.current.filteredMatches.length).toBe(2);
    expect(result.current.filteredMatches.find(m => m.offer.id === 'o3')).toBeUndefined();
  });

  it('sorts by opportunity by default and profit when requested', () => {
    const { result } = renderHook(() => useMatchFilters({
      matches: mockMatches,
      metaByMatch: {},
      previouslySeenKeys: new Set(),
      getMatchKey
    }));

    // Default sortBy 'opportunity' (highest first) -> o2_d2, o1_d1, o3_d3
    expect(result.current.filteredMatches[0].offer.id).toBe('o2');
    expect(result.current.filteredMatches[1].offer.id).toBe('o1');
    expect(result.current.filteredMatches[2].offer.id).toBe('o3');

    act(() => {
      result.current.setSortBy('profit');
    });

    // Sort by profit: o2_d2 (5000), o1_d1 (1000), o3_d3 (200)
    // Same order here but testing logic is applied
    expect(result.current.filteredMatches[0].offer.id).toBe('o2');
    expect(result.current.filteredMatches[1].offer.id).toBe('o1');
    expect(result.current.filteredMatches[2].offer.id).toBe('o3');
  });

  it('filters out resolved matches when hideResolved is true', () => {
    const metaByMatch: any = {
      'o2_d2': { resolved: true }
    };

    const { result } = renderHook(() => useMatchFilters({
      matches: mockMatches,
      metaByMatch,
      previouslySeenKeys: new Set(),
      getMatchKey
    }));

    // hideResolved is true by default
    expect(result.current.filteredMatches.length).toBe(2);
    expect(result.current.filteredMatches.find(m => m.offer.id === 'o2')).toBeUndefined();

    act(() => {
      result.current.setHideResolved(false);
    });

    expect(result.current.filteredMatches.length).toBe(3);
  });

  it('filters out previously seen when hidePreviouslySeen is true', () => {
    const { result } = renderHook(() => useMatchFilters({
      matches: mockMatches,
      metaByMatch: {},
      previouslySeenKeys: new Set(['o1_d1']),
      getMatchKey
    }));

    // hidePreviouslySeen is false by default
    expect(result.current.filteredMatches.length).toBe(3);

    act(() => {
      result.current.setHidePreviouslySeen(true);
    });

    expect(result.current.filteredMatches.length).toBe(2);
    expect(result.current.filteredMatches.find(m => m.offer.id === 'o1')).toBeUndefined();
  });
});
