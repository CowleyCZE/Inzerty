import React from 'react';

interface BulkActionsPanelProps {
  selectedCount: number;
  showBulkActions: boolean;
  setShowBulkActions: (v: boolean) => void;
  selectAllVisible: () => void;
  clearSelection: () => void;
  bulkMarkAsResolved: () => void;
  bulkMarkAsContacted: () => void;
}

export const BulkActionsPanel: React.FC<BulkActionsPanelProps> = ({
  selectedCount,
  showBulkActions,
  setShowBulkActions,
  selectAllVisible,
  clearSelection,
  bulkMarkAsResolved,
  bulkMarkAsContacted,
}) => {
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button onClick={selectAllVisible} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm">
          ✅ Označit všechny na stránce
        </button>
        {selectedCount > 0 && (
          <>
            <span className="text-sm text-slate-300">
              📦 Vybráno: <strong className="text-amber-400">{selectedCount}</strong> zápasů
            </span>
            <button onClick={() => setShowBulkActions(!showBulkActions)} className="px-3 py-1 bg-amber-700 hover:bg-amber-600 rounded text-sm">
              Hromadné akce ▼
            </button>
            <button onClick={clearSelection} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm">
              Zrušit výběr
            </button>
          </>
        )}
      </div>

      {showBulkActions && selectedCount > 0 && (
        <div className="mb-4 p-4 bg-slate-900 border border-slate-700 rounded-xl">
          <h3 className="text-lg font-semibold text-amber-400 mb-3">📦 Hromadné akce pro {selectedCount} vybraných zápasů</h3>
          <div className="flex flex-wrap gap-2">
            <button onClick={bulkMarkAsResolved} className="px-4 py-2 bg-rose-700 hover:bg-rose-600 rounded font-medium">
              ❌ Označit jako vyřešené / nebrat
            </button>
            <button onClick={bulkMarkAsContacted} className="px-4 py-2 bg-sky-700 hover:bg-sky-600 rounded font-medium">
              📞 Označit jako kontaktováno
            </button>
          </div>
        </div>
      )}
    </>
  );
};
