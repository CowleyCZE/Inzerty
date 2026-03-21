import { useState } from 'react';

export const useBulkActions = () => {
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  const toggleSelectMatch = (matchKey: string) => {
    setSelectedMatches((prev) => {
      const next = new Set(prev);
      if (next.has(matchKey)) {
        next.delete(matchKey);
      } else {
        next.add(matchKey);
      }
      return next;
    });
  };

  const selectAll = (matchKeys: string[]) => {
    matchKeys.forEach((key) => {
      setSelectedMatches((prev) => new Set(prev).add(key));
    });
  };

  const clearSelection = () => {
    setSelectedMatches(new Set());
  };

  const bulkUpdate = async (updates: Record<string, any>) => {
    if (selectedMatches.size === 0) return;
    try {
      await fetch('http://localhost:3001/matches/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          matchKeys: Array.from(selectedMatches), 
          updates 
        }),
      });
      clearSelection();
      return true;
    } catch (e) {
      console.error('Bulk update error', e);
      return false;
    }
  };

  const bulkMarkAsResolved = () => bulkUpdate({ resolved: true });
  const bulkMarkAsContacted = () => bulkUpdate({ status: 'contacted' });

  return {
    selectedMatches,
    selectedCount: selectedMatches.size,
    showBulkActions,
    setShowBulkActions,
    toggleSelectMatch,
    selectAll,
    clearSelection,
    bulkMarkAsResolved,
    bulkMarkAsContacted,
  };
};
