import React, { useState, useEffect } from 'react';
import { MatchItem } from '../types';

// Hooks
import { useMatchMeta, defaultMeta } from '../hooks/useMatchMeta';
import { useMatchFilters } from '../hooks/useMatchFilters';
import { useBulkActions } from '../hooks/useBulkActions';
import { usePreviouslySeen } from '../hooks/usePreviouslySeen';
import { useAlertsConfig } from '../hooks/useAlertsConfig';
import { useExport } from '../hooks/useExport';
import { useAutomation } from '../hooks/useAutomation';

// Components
import { MatchFilters } from '../components/MatchFilters/MatchFilters';
import { BulkActionsPanel } from '../components/MatchList/BulkActionsPanel';
import { MatchList } from '../components/MatchList/MatchList';
import { ExportPanel } from '../components/ExportPanel/ExportPanel';
import { AlertsPanel } from '../components/AlertsPanel/AlertsPanel';

// Utils
import { getMatchKey, statusLabel } from '../utils/matchUtils';

interface ResultsDisplayProps {
  matchedAds: MatchItem[];
  isLoading?: boolean;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ matchedAds, isLoading }) => {
  const [signature, setSignature] = useState('');

  // 1. Meta & Status management
  const { metaByMatch, updateMatchMeta } = useMatchMeta();

  // 2. Previously seen tracking (deduplication)
  const { previouslySeenKeys } = usePreviouslySeen({ matchedAds, getMatchKey });

  // 3. Filtering & Sorting logic
  const { 
    filteredMatches, 
    minProfit, setMinProfit, 
    sortBy, setSortBy, 
    hideResolved, setHideResolved, 
    hidePreviouslySeen, setHidePreviouslySeen 
  } = useMatchFilters({ 
    matches: matchedAds, 
    metaByMatch, 
    previouslySeenKeys, 
    getMatchKey 
  });

  // 4. Bulk Actions
  const { 
    selectedMatches, selectedCount, 
    showBulkActions, setShowBulkActions, 
    toggleSelectMatch, selectAll, clearSelection, 
    bulkMarkAsResolved, bulkMarkAsContacted 
  } = useBulkActions();

  // 5. Alerts & Notifications
  const { 
    alertsConfig, setAlertsConfig, 
    showAlertsConfig, setShowAlertsConfig, 
    alertsStatus, sendTopAlerts, saveAlertsConfig, testAlerts 
  } = useAlertsConfig();

  // 6. Export logic
  const { 
    sheetsConfig, setSheetsConfig, 
    showSheetsConfig, setShowSheetsConfig, 
    exportStatus, exportCsv, exportToGoogleSheets 
  } = useExport({ 
    filteredMatches, 
    metaByMatch, 
    defaultMeta, 
    getMatchKey 
  });

  // 7. Automation
  const { runningAutomation, automationResults, runAutonomousProcess } = useAutomation(getMatchKey);

  // General effects
  useEffect(() => {
    const savedSignature = localStorage.getItem('inzerty_signature_v1');
    if (savedSignature) setSignature(savedSignature);
  }, []);

  useEffect(() => {
    if (signature) localStorage.setItem('inzerty_signature_v1', signature);
  }, [signature]);

  const showDailyReport = async () => {
    try {
      const res = await fetch('http://localhost:3001/reports/daily');
      if (res.ok) {
        const data = await res.json();
        alert(`Denní report:\nNové: ${data.newCount}\nKontaktováno: ${data.contactedCount}\nUzavřeno: ${data.closedCount}`);
      }
    } catch (e) {
      console.error('Report failed', e);
    }
  };

  const selectAllVisible = () => {
    const visibleKeys = filteredMatches.map(m => getMatchKey(m.offer, m.demand));
    selectAll(visibleKeys);
  };

  if (isLoading) return <div className="py-8 text-center text-slate-400">Načítám...</div>;
  if (!matchedAds.length) return <div className="bg-slate-800 p-8 rounded-xl mt-8 text-center text-slate-400">Zatím nebyly nalezeny žádné shody.</div>;

  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-2xl mt-8 border border-slate-700">
      {/* Header & Main Actions */}
      <div className="flex flex-wrap gap-2 items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-emerald-400">
          Akční fronta arbitrážních příležitostí ({filteredMatches.length})
        </h2>
        <div className="flex flex-wrap gap-2">
          <button className="px-3 py-1 bg-sky-700 rounded hover:bg-sky-600 transition-colors" onClick={exportCsv}>
            📊 Export CSV
          </button>
          <button 
            className={`px-3 py-1 rounded transition-colors ${showSheetsConfig ? 'bg-slate-600' : 'bg-emerald-700 hover:bg-emerald-600'}`} 
            onClick={() => setShowSheetsConfig(!showSheetsConfig)}
          >
            {showSheetsConfig ? 'Skrýt Sheets' : '📈 Google Sheets'}
          </button>
          <button className="px-3 py-1 bg-purple-700 rounded hover:bg-purple-600 transition-colors" onClick={showDailyReport}>
            Denní report
          </button>
          <button className="px-3 py-1 bg-teal-700 rounded hover:bg-teal-600 transition-colors" onClick={() => sendTopAlerts(filteredMatches)}>
            Poslat TOP alerty
          </button>
          {selectedCount > 0 && (
            <button 
              className="px-3 py-1 bg-amber-700 rounded hover:bg-amber-600 transition-colors" 
              onClick={() => setShowBulkActions(!showBulkActions)}
            >
              Hromadné akce ({selectedCount})
            </button>
          )}
        </div>
      </div>

      {/* Experimental Panels */}
      <ExportPanel 
        showSheetsConfig={showSheetsConfig}
        setShowSheetsConfig={setShowSheetsConfig}
        sheetsConfig={sheetsConfig}
        setSheetsConfig={setSheetsConfig}
        exportToGoogleSheets={exportToGoogleSheets}
        exportStatus={exportStatus}
      />

      <MatchFilters 
        minProfit={minProfit} 
        setMinProfit={setMinProfit}
        sortBy={sortBy}
        setSortBy={setSortBy}
        hideResolved={hideResolved}
        setHideResolved={setHideResolved}
        hidePreviouslySeen={hidePreviouslySeen}
        setHidePreviouslySeen={setHidePreviouslySeen}
        previouslySeenCount={previouslySeenKeys.size}
        signature={signature}
        setSignature={setSignature}
      />

      <BulkActionsPanel 
        selectedCount={selectedCount}
        showBulkActions={showBulkActions}
        setShowBulkActions={setShowBulkActions}
        selectAllVisible={selectAllVisible}
        clearSelection={clearSelection}
        bulkMarkAsResolved={bulkMarkAsResolved}
        bulkMarkAsContacted={bulkMarkAsContacted}
      />

      <AlertsPanel 
        alertsConfig={alertsConfig}
        setAlertsConfig={setAlertsConfig}
        showAlertsConfig={showAlertsConfig}
        setShowAlertsConfig={setShowAlertsConfig}
        alertsStatus={alertsStatus}
        testAlerts={testAlerts}
        saveAlertsConfig={saveAlertsConfig}
      />

      {/* Results List */}
      <MatchList 
        matches={filteredMatches}
        metaByMatch={metaByMatch}
        selectedMatches={selectedMatches}
        toggleSelectMatch={toggleSelectMatch}
        statusLabel={statusLabel}
        updateMatchMeta={updateMatchMeta}
        runAutonomousProcess={runAutonomousProcess}
        runningAutomation={runningAutomation}
        automationResults={automationResults}
        getMatchKey={getMatchKey}
      />
    </div>
  );
};

export default ResultsDisplay;
