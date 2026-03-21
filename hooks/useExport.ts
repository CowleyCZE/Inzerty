import { useState } from 'react';
import { MatchItem, MatchMeta } from '../types';

interface UseExportOptions {
  filteredMatches: MatchItem[];
  metaByMatch: Record<string, MatchMeta>;
  defaultMeta: () => MatchMeta;
  getMatchKey: (offer: any, demand: any) => string;
}

export const useExport = ({ filteredMatches, metaByMatch, defaultMeta, getMatchKey }: UseExportOptions) => {
  const [sheetsConfig, setSheetsConfig] = useState({
    apiKey: '',
    spreadsheetId: '',
    sheetName: 'Arbitráže',
    webhookUrl: '',
    useWebhook: false,
  });
  const [showSheetsConfig, setShowSheetsConfig] = useState(false);
  const [exportStatus, setExportStatus] = useState<string>('');

  const exportCsv = async () => {
    const payload = filteredMatches.map((m) => {
      const matchKey = getMatchKey(m.offer, m.demand);
      const meta = metaByMatch[matchKey] || defaultMeta();
      return {
        matchKey,
        offerTitle: m.offer.title,
        demandTitle: m.demand.title,
        profit: m.arbitrageScore || 0,
        opportunity: m.realOpportunityScore || 0,
        offerPrice: m.offer.price,
        demandPrice: m.demand.price,
        offerLocation: m.offer.location || '',
        demandLocation: m.demand.location || '',
        offerUrl: m.offer.link || m.offer.url,
        demandUrl: m.demand.link || m.demand.url,
        status: meta.status,
        priority: meta.priority,
        note: meta.note,
        lastActionAt: meta.lastActionAt,
        followUpAt: meta.followUpAt,
        resolved: meta.resolved,
        brand: m.offer.brand || '',
      };
    });

    const res = await fetch('http://localhost:3001/export/csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: payload }),
    });
    const data = await res.json();
    const blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inzerty-export-${new Date().toISOString().slice(0, 10)}-${data.count}zaraz.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportStatus(`✅ Exportováno ${data.count} zápasů do CSV`);
    setTimeout(() => setExportStatus(''), 3000);
  };

  const exportToGoogleSheets = async (useWebhook = false) => {
    const payload = filteredMatches.map((m) => {
      const matchKey = getMatchKey(m.offer, m.demand);
      const meta = metaByMatch[matchKey] || defaultMeta();
      return {
        matchKey,
        offerTitle: m.offer.title,
        demandTitle: m.demand.title,
        profit: m.arbitrageScore || 0,
        opportunity: m.realOpportunityScore || 0,
        offerPrice: m.offer.price,
        demandPrice: m.demand.price,
        offerLocation: m.offer.location || '',
        demandLocation: m.demand.location || '',
        offerUrl: m.offer.link || m.offer.url,
        demandUrl: m.demand.link || m.demand.url,
        status: meta.status,
        priority: meta.priority,
        note: meta.note,
        followUpAt: meta.followUpAt,
        resolved: meta.resolved,
      };
    });

    try {
      const endpoint = useWebhook ? '/export/sheets/webhook' : '/export/sheets';
      const res = await fetch(`http://localhost:3001${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          rows: payload,
          webhookUrl: useWebhook ? sheetsConfig.webhookUrl : undefined,
          spreadsheetId: sheetsConfig.spreadsheetId,
          sheetName: sheetsConfig.sheetName,
          apiKey: sheetsConfig.apiKey,
        }),
      });
      
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();
      
      setExportStatus(`✅ Exportováno ${data.updatedRows || payload.length} řádků do Google Sheets`);
      setTimeout(() => setExportStatus(''), 5000);
    } catch (error) {
      setExportStatus(`❌ Export selhal: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
      setTimeout(() => setExportStatus(''), 5000);
    }
  };

  return {
    sheetsConfig,
    setSheetsConfig,
    showSheetsConfig,
    setShowSheetsConfig,
    exportStatus,
    setExportStatus,
    exportCsv,
    exportToGoogleSheets,
  };
};
