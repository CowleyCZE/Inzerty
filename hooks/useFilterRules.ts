import { useState, useCallback } from 'react';
import { Config } from '../types';

export const useFilterRules = (draft: Config, setDraft: React.Dispatch<React.SetStateAction<Config>>) => {
  const [blacklistInput, setBlacklistInput] = useState('');
  const [whitelistInput, setWhitelistInput] = useState('');
  const [showBlacklistHelp, setShowBlacklistHelp] = useState(false);
  const [showWhitelistHelp, setShowWhitelistHelp] = useState(false);

  const filterRules = draft.filterRules || {
    blacklistTerms: [],
    whitelistModels: [],
    minPrice: null,
    maxPrice: null,
    minStorageGb: null,
  };

  const updateRules = useCallback((patch: Partial<typeof filterRules>) => {
    setDraft((prev) => ({ 
      ...prev, 
      filterRules: { 
        ...(prev.filterRules || filterRules), 
        ...patch 
      } 
    }));
  }, [setDraft, filterRules]);

  const addToBlacklist = (term: string) => {
    const trimmed = term.trim().toLowerCase();
    if (!trimmed) return;
    if (filterRules.blacklistTerms.includes(trimmed)) return;
    updateRules({ blacklistTerms: [...filterRules.blacklistTerms, trimmed] });
    setBlacklistInput('');
  };

  const removeFromBlacklist = (term: string) => {
    updateRules({ blacklistTerms: filterRules.blacklistTerms.filter(t => t !== term) });
  };

  const addToWhitelist = (model: string) => {
    const trimmed = model.trim().toLowerCase();
    if (!trimmed) return;
    if (filterRules.whitelistModels.includes(trimmed)) return;
    updateRules({ whitelistModels: [...filterRules.whitelistModels, trimmed] });
    setWhitelistInput('');
  };

  const removeFromWhitelist = (model: string) => {
    updateRules({ whitelistModels: filterRules.whitelistModels.filter(m => m !== model) });
  };

  return {
    filterRules,
    blacklistInput,
    setBlacklistInput,
    whitelistInput,
    setWhitelistInput,
    showBlacklistHelp,
    setShowBlacklistHelp,
    showWhitelistHelp,
    setShowWhitelistHelp,
    updateRules,
    addToBlacklist,
    removeFromBlacklist,
    addToWhitelist,
    removeFromWhitelist,
  };
};
