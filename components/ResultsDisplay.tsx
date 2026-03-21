import React, { useMemo, useState, useEffect } from 'react';
import { Ad, MatchItem, MatchMeta, MatchStatus, MatchPriority } from '../types';

interface ResultsDisplayProps {
  matchedAds: MatchItem[];
  isLoading?: boolean;
}

const STORAGE_KEY = 'inzerty_match_meta_v2';
const ALERTS_KEY = 'inzerty_alerts_config_v1';

const statusLabel: Record<MatchStatus, string> = {
  new: 'Nové',
  review: 'Prověřit',
  contacted: 'Kontaktováno',
  negotiation: 'Vyjednávání',
  closed: 'Uzavřeno',
};

const defaultMeta = (): MatchMeta => ({
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

const getMatchKey = (offer: Ad, demand: Ad) => `${offer.url || offer.id}__${demand.url || demand.id}`;

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ matchedAds, isLoading }) => {
  const [minProfit, setMinProfit] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'profit' | 'opportunity'>('opportunity');
  const [hideResolved, setHideResolved] = useState(true);
  const [hidePreviouslySeen, setHidePreviouslySeen] = useState(false);
  const [metaByMatch, setMetaByMatch] = useState<Record<string, MatchMeta>>({});
  const [signature, setSignature] = useState('');
  const [alertsConfig, setAlertsConfig] = useState({
    telegramBotToken: '',
    telegramChatId: '',
    emailWebhookUrl: '',
    discordWebhookUrl: '',
    minProfit: 1500,
    minScore: 70,
    enabled: false,
    autoSendAfterCompare: true,
  });

  // Načíst podpis z localStorage
  useEffect(() => {
    const savedSignature = localStorage.getItem('inzerty_signature_v1');
    if (savedSignature) {
      setSignature(savedSignature);
    }
  }, []);
  const [showAlertsConfig, setShowAlertsConfig] = useState(false);
  const [alertsStatus, setAlertsStatus] = useState<string>('');
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [previouslySeenKeys, setPreviouslySeenKeys] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [sheetsConfig, setSheetsConfig] = useState({
    apiKey: '',
    spreadsheetId: '',
    sheetName: 'Arbitráže',
    webhookUrl: '',
    useWebhook: false,
  });
  const [showSheetsConfig, setShowSheetsConfig] = useState(false);
  const [runningAutomation, setRunningAutomation] = useState<Set<string>>(new Set());
  const [automationResults, setAutomationResults] = useState<Record<string, any>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setMetaByMatch(JSON.parse(raw));
      const alertRaw = localStorage.getItem(ALERTS_KEY);
      if (alertRaw) setAlertsConfig(JSON.parse(alertRaw));
    } catch {
      setMetaByMatch({});
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(metaByMatch));
  }, [metaByMatch]);

  useEffect(() => {
    localStorage.setItem(ALERTS_KEY, JSON.stringify(alertsConfig));
  }, [alertsConfig]);

  // Load alerts config from server
  useEffect(() => {
    const loadAlertsConfig = async () => {
      try {
        const res = await fetch('http://localhost:3001/alerts/config');
        if (res.ok) {
          const data = await res.json();
          setAlertsConfig((prev) => ({ ...prev, ...data.config }));
        }
      } catch {
        // Server may not have alerts config endpoint
      }
    };
    loadAlertsConfig();
  }, []);

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
  }, [matchedAds, previouslySeenKeys]);

  const updateMatchMeta = async (matchKey: string, patch: Partial<MatchMeta>) => {
    const next = {
      ...defaultMeta(),
      ...(metaByMatch[matchKey] || {}),
      ...patch,
      lastActionAt: new Date().toISOString(),
    };
    setMetaByMatch((prev) => ({ ...prev, [matchKey]: next }));
    await fetch('http://localhost:3001/match-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchKey, ...next }),
    });
  };

  const filteredMatches = useMemo(() => {
    let list = matchedAds
      .filter((match) => (match.arbitrageScore || 0) >= minProfit)
      .filter((match) => {
        if (!hideResolved) return true;
        const meta = metaByMatch[getMatchKey(match.offer, match.demand)] || defaultMeta();
        return !meta.resolved;
      });
    
    // Filter out previously seen matches if enabled
    if (hidePreviouslySeen) {
      list = list.filter((match) => !previouslySeenKeys.has(getMatchKey(match.offer, match.demand)));
    }

    return [...list].sort((a, b) => {
      if (sortBy === 'profit') return (b.arbitrageScore || 0) - (a.arbitrageScore || 0);
      return (b.realOpportunityScore || 0) - (a.realOpportunityScore || 0);
    });
  }, [matchedAds, minProfit, sortBy, hideResolved, hidePreviouslySeen, metaByMatch, previouslySeenKeys]);

  const generateAIMessage = async (match: MatchItem, side: 'seller' | 'buyer', channel: 'bazos' | 'sms' | 'email' = 'bazos', userStyle: 'formal' | 'friendly' | 'direct' = 'friendly') => {
    const matchKey = `${match.offer.url}__${match.demand.url}`;
    
    try {
      const response = await fetch('http://localhost:3001/ai/generate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchKey,
          side,
          channel,
          userStyle,
          match: {
            offer: {
              title: match.offer.title,
              price: match.offer.price,
              location: match.offer.location,
              url: match.offer.url,
            },
            demand: {
              title: match.demand.title,
              price: match.demand.price,
              location: match.demand.location,
              url: match.demand.url,
            },
            arbitrageScore: match.arbitrageScore,
            similarityScore: match.offer.similarity,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'AI generování selhalo');
      }

      const result = await response.json();
      
      if (result.success && result.message) {
        // Zkopírovat vygenerovanou zprávu
        const textToCopy = channel === 'email' && result.subject 
          ? `${result.subject}\n\n${result.message}`
          : result.message;
          
        await navigator.clipboard.writeText(textToCopy);
        
        alert(`✅ AI zpráva generována a zkopírována!\n\n${result.reasoning || ''}`);
        return result.message;
      } else {
        throw new Error('AI nevygenerovala zprávu');
      }
    } catch (error) {
      console.error('AI message generation failed:', error);
      alert(`❌ AI generování selhalo: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
      return null;
    }
  };

  const copyTemplate = async (match: MatchItem, side: 'seller' | 'buyer', channel: 'bazos' | 'sms' | 'email' = 'bazos') => {
    const counterpart = side === 'seller' ? match.offer : match.demand;
    const otherSide = side === 'seller' ? match.demand : match.offer;
    const isSeller = side === 'seller';

    let subject = '';
    let text = '';

    if (channel === 'email') {
      // Pro prodávajícího (offer) - nabízíme konkrétní telefon
      if (isSeller) {
        subject = `${otherSide.title} - nabídka k prodeji`;
        text = [
          `Dobrý den,`,
          ``,
          `narazil jsem na Váš inzerát "${otherSide.title}" a mám pro Vás zajímavou nabídku.`,
          ``,
          `K dispozici mám ${otherSide.title} za ${otherSide.price}.`,
          ``,
          `Pokud máte zájem, mohu Vám poslat více informací včetně fotografií a detailů o stavu zařízení.`,
          ``,
          `Napište mi prosím, zda Vás tato nabídka zaujala.`,
          ``,
          `Hezký den,`,
          `${signature}`,
          ``,
          `--`,
          `Tel: [Váš telefon]`,
          `Email: [Váš email]`,
        ].join('\n');
      } 
      // Pro kupujícího (demand) - nabízíme mu konkrétní telefon k odkoupení
      else {
        subject = `Nabídka: ${otherSide.title} za ${otherSide.price}`;
        text = [
          `Dobrý den,`,
          ``,
          `viděl jsem Váš inzerát "${otherSide.title}" a mám pro Vás konkrétní nabídku.`,
          ``,
          `Mám k dispozici ${otherSide.title} který přesně odpovídá Vašemu zájmu. Cena je ${otherSide.price}.`,
          ``,
          `Zařízení je plně funkční, vše bylo testováno.`,
          ``,
          `Pokud máte zájem, mohu Vám poslat další informace a domluvit se na způsobu předání.`,
          ``,
          `Napište mi prosím, zda Vás nabídka zaujala.`,
          ``,
          `Hezký den,`,
          `${signature}`,
          ``,
          `--`,
          `Tel: [Váš telefon]`,
          `Email: [Váš email]`,
        ].join('\n');
      }
    } else if (channel === 'sms') {
      // SMS pro prodávajícího
      if (isSeller) {
        text = `Dobrý den, mám ${otherSide.title} za ${otherSide.price}. Máte zájem? Více info pošlu. Děkuji, ${signature}`;
      } 
      // SMS pro kupujícího
      else {
        text = `Dobrý den, mám ${otherSide.title} za ${otherSide.price}. Přesně co hledáte. Zájem? Děkuji, ${signature}`;
      }

      // SMS má limit 160 znaků, zkusíme se vejít
      if (text.length > 160) {
        text = text.substring(0, 157) + '...';
      }
    } else {
      // Bazoš zpráva pro prodávajícího
      if (isSeller) {
        text = [
          `Dobrý den,`,
          ``,
          `mám ${otherSide.title} za ${otherSide.price}.`,
          ``,
          `Zařízení je plně funkční, vše bylo testováno.`,
          ``,
          `Pokud máte zájem, napište mi prosím více informací.`,
          ``,
          `Hezký den, ${signature}`,
        ].join('\n');
      } 
      // Bazoš zpráva pro kupujícího
      else {
        text = [
          `Dobrý den,`,
          ``,
          `viděl jsem Váš inzerát. Mám k dispozici ${otherSide.title} za ${otherSide.price}.`,
          ``,
          `Zařízení je plně funkční.`,
          ``,
          `Napište mi prosím, zda máte zájem.`,
          ``,
          `Hezký den, ${signature}`,
        ].join('\n');
      }
    }

    // Kopírovat do schránky
    await navigator.clipboard.writeText(text);

    // Pro email zkopírovat i předmět
    if (channel === 'email' && subject) {
      await navigator.clipboard.writeText(subject + '\n\n' + text);
      alert(`Předmět a text e-mailu zkopírovány do schránky.\n\nPředmět: ${subject}`);
    }
  };

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
    setAlertsStatus(`✅ Exportováno ${data.count} zápasů do CSV`);
    setTimeout(() => setAlertsStatus(''), 3000);
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
      
      setAlertsStatus(`✅ Exportováno ${data.updatedRows || payload.length} řádků do Google Sheets`);
      setTimeout(() => setAlertsStatus(''), 5000);
    } catch (error) {
      setAlertsStatus(`❌ Export selhal: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
      setTimeout(() => setAlertsStatus(''), 5000);
    }
  };

  const sendTopAlerts = async () => {
    setAlertsStatus('Odesílám alerty...');
    try {
      await fetch('http://localhost:3001/alerts/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...alertsConfig, 
          matches: filteredMatches,
          minProfit: alertsConfig.minProfit,
          minScore: alertsConfig.minScore,
        }),
      });
      setAlertsStatus('✅ Alerty úspěšně odeslány!');
      setTimeout(() => setAlertsStatus(''), 3000);
    } catch (error) {
      setAlertsStatus(`❌ Chyba: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
      setTimeout(() => setAlertsStatus(''), 5000);
    }
  };

  const saveAlertsConfig = async () => {
    try {
      const res = await fetch('http://localhost:3001/alerts/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertsConfig),
      });
      if (res.ok) {
        setAlertsStatus('✅ Konfigurace uložena!');
        setTimeout(() => setAlertsStatus(''), 3000);
      }
    } catch (error) {
      setAlertsStatus(`❌ Chyba: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
      setTimeout(() => setAlertsStatus(''), 5000);
    }
  };

  const testAlerts = async () => {
    setAlertsStatus('Posílám testovací alert...');
    try {
      const res = await fetch('http://localhost:3001/alerts/test', { method: 'POST' });
      if (res.ok) {
        setAlertsStatus('✅ Testovací alert odeslán!');
        setTimeout(() => setAlertsStatus(''), 3000);
      } else {
        setAlertsStatus('❌ Test selhal');
        setTimeout(() => setAlertsStatus(''), 5000);
      }
    } catch (error) {
      setAlertsStatus(`❌ Chyba: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
      setTimeout(() => setAlertsStatus(''), 5000);
    }
  };

  const runAutonomousProcess = async (match: MatchItem) => {
    const matchKey = getMatchKey(match.offer, match.demand);
    
    setRunningAutomation((prev) => new Set(prev).add(matchKey));
    setAutomationResults((prev) => ({ ...prev, [matchKey]: { status: 'running', message: 'Spouštím autonomní proces...' } }));

    try {
      console.log('[AUTOMATION] Starting automation for matchKey:', matchKey);
      
      const requestBody = {
        matchKey,
        match: {
          offer: {
            title: match.offer.title,
            price: match.offer.price,
            location: match.offer.location || '',
            url: match.offer.url,
          },
          demand: {
            title: match.demand.title,
            price: match.demand.price,
            location: match.demand.location || '',
            url: match.demand.url,
          },
          arbitrageScore: match.arbitrageScore,
          similarityScore: match.similarity,
          realOpportunityScore: match.realOpportunityScore,
        },
      };
      
      console.log('[AUTOMATION] Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(`http://localhost:3001/automation/run-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      console.log('[AUTOMATION] Response status:', response.status);
      console.log('[AUTOMATION] Response headers:', Object.fromEntries(response.headers.entries()));

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      console.log('[AUTOMATION] Content-Type:', contentType);
      
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('[AUTOMATION] Non-JSON response:', text.substring(0, 1000));
        throw new Error(`Server vrátil neočekávanou odpověď (není JSON). Status: ${response.status}. Prvních 500 znaků: ${text.substring(0, 500)}`);
      }

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[AUTOMATION] Error response:', errorData);
        throw new Error(errorData.message || 'Autonomní proces selhal');
      }

      const result = await response.json();
      console.log('[AUTOMATION] Success result:', result);
      
      setAutomationResults((prev) => ({ 
        ...prev, 
        [matchKey]: { 
          status: 'success', 
          message: `Dokončeno: ${result.summary.success}/${result.summary.total} kroků`,
          data: result 
        } 
      }));

      // Show detailed results
      const successSteps = result.results
        .filter((r: any) => r.success)
        .map((r: any) => `✅ ${r.step}: ${r.message}`)
        .join('\n');
      
      const failedSteps = result.results
        .filter((r: any) => !r.success)
        .map((r: any) => `❌ ${r.step}: ${r.error || r.message}`)
        .join('\n');

      alert(`🚀 Autonomní proces dokončen!\n\n${successSteps}${failedSteps ? '\n\n' + failedSteps : ''}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Neznámá chyba';
      console.error('[AUTOMATION] Error:', error);
      setAutomationResults((prev) => ({ 
        ...prev, 
        [matchKey]: { 
          status: 'error', 
          message: errorMessage 
        } 
      }));
      alert(`❌ Autonomní proces selhal: ${errorMessage}`);
    } finally {
      setRunningAutomation((prev) => {
        const next = new Set(prev);
        next.delete(matchKey);
        return next;
      });
    }
  };

  // Bulk actions
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

  const selectAllVisible = () => {
    filteredMatches.forEach((m) => {
      setSelectedMatches((prev) => new Set(prev).add(getMatchKey(m.offer, m.demand)));
    });
  };

  const clearSelection = () => {
    setSelectedMatches(new Set());
  };

  const bulkMarkAsResolved = async () => {
    if (selectedMatches.size === 0) return;
    try {
      await fetch('http://localhost:3001/matches/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchKeys: Array.from(selectedMatches), updates: { resolved: true } }),
      });
      setAlertsStatus(`✅ Označeno ${selectedMatches.size} zápasů jako vyřešené`);
      setTimeout(() => setAlertsStatus(''), 3000);
      clearSelection();
    } catch (error) {
      setAlertsStatus(`❌ Chyba: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
      setTimeout(() => setAlertsStatus(''), 5000);
    }
  };

  const bulkMarkAsContacted = async () => {
    if (selectedMatches.size === 0) return;
    try {
      await fetch('http://localhost:3001/matches/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchKeys: Array.from(selectedMatches), updates: { status: 'contacted' } }),
      });
      setAlertsStatus(`✅ Označeno ${selectedMatches.size} zápasů jako kontaktováno`);
      setTimeout(() => setAlertsStatus(''), 3000);
      clearSelection();
    } catch (error) {
      setAlertsStatus(`❌ Chyba: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
      setTimeout(() => setAlertsStatus(''), 5000);
    }
  };

  const showDailyReport = async () => {
    const res = await fetch('http://localhost:3001/reports/daily');
    const data = await res.json();
    alert(`Denní report:\nNové: ${data.newCount}\nKontaktováno: ${data.contactedCount}\nUzavřeno: ${data.closedCount}`);
  };

  if (isLoading) return <div className="py-8">Načítám...</div>;
  if (!matchedAds.length) return <div className="bg-slate-800 p-8 rounded-xl mt-8">Zatím nebyly nalezeny žádné shody.</div>;

  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-2xl mt-8 border border-slate-700">
      <div className="flex flex-wrap gap-2 items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold text-emerald-400">Akční fronta arbitrážních příležitostí ({filteredMatches.length})</h2>
        <div className="flex flex-wrap gap-2">
          <button className="px-3 py-1 bg-sky-700 rounded hover:bg-sky-600" onClick={exportCsv}>📊 Export CSV</button>
          <button className="px-3 py-1 bg-emerald-700 rounded hover:bg-emerald-600" onClick={() => setShowSheetsConfig(!showSheetsConfig)}>
            {showSheetsConfig ? 'Skrýt' : '📈'} Google Sheets
          </button>
          <button className="px-3 py-1 bg-purple-700 rounded hover:bg-purple-600" onClick={showDailyReport}>Denní report</button>
          <button className="px-3 py-1 bg-teal-700 rounded hover:bg-teal-600" onClick={sendTopAlerts}>Poslat TOP alerty</button>
          {selectedMatches.size > 0 && (
            <button 
              className="px-3 py-1 bg-amber-700 rounded hover:bg-amber-600" 
              onClick={() => setShowBulkActions(!showBulkActions)}
            >
              Hromadné akce ({selectedMatches.size})
            </button>
          )}
        </div>
      </div>

      {/* Google Sheets Configuration & Export Panel */}
      {showSheetsConfig && (
        <div className="mb-4 p-4 bg-slate-900 border border-slate-700 rounded-xl">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-emerald-400">📈 Export do Google Sheets</h3>
            <button onClick={() => setShowSheetsConfig(false)} className="text-sm text-slate-400 hover:text-white">Skrýt</button>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-sky-400">Možnost 1: Google Sheets API (oficiální)</h4>
              <input 
                value={sheetsConfig.spreadsheetId} 
                onChange={(e) => setSheetsConfig((p) => ({ ...p, spreadsheetId: e.target.value }))} 
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm" 
                placeholder="Spreadsheet ID (z URL Google Sheets)" 
              />
              <input 
                value={sheetsConfig.apiKey} 
                onChange={(e) => setSheetsConfig((p) => ({ ...p, apiKey: e.target.value }))} 
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm" 
                placeholder="OAuth Token / API Key" 
              />
              <input 
                value={sheetsConfig.sheetName} 
                onChange={(e) => setSheetsConfig((p) => ({ ...p, sheetName: e.target.value }))} 
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm" 
                placeholder="Název listu (např. Arbitráže)" 
              />
              <button 
                onClick={() => exportToGoogleSheets(false)}
                className="w-full px-3 py-2 bg-emerald-700 hover:bg-emerald-600 rounded font-medium"
              >
                📈 Exportovat přes Google API
              </button>
            </div>
            
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-purple-400">Možnost 2: Google Apps Script (jednodušší)</h4>
              <textarea 
                value={sheetsConfig.webhookUrl} 
                onChange={(e) => setSheetsConfig((p) => ({ ...p, webhookUrl: e.target.value }))} 
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm" 
                placeholder="Google Apps Script Web App URL" 
                rows={3}
              />
              <div className="text-xs text-slate-400">
                <p>Vytvořte Google Apps Script s funkcí <code className="bg-slate-700 px-1 rounded">doPost(e)</code> která přijme JSON a uloží do Sheets.</p>
              </div>
              <button 
                onClick={() => exportToGoogleSheets(true)}
                className="w-full px-3 py-2 bg-purple-700 hover:bg-purple-600 rounded font-medium"
              >
                📊 Exportovat přes Webhook
              </button>
            </div>
          </div>
          
          <div className="p-3 bg-slate-800 border border-slate-600 rounded text-xs text-slate-300">
            <p className="font-semibold mb-2">📝 Jak nastavit Google Sheets export:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li><strong>Google API:</strong> Získejte OAuth token z Google Cloud Console, povolte Sheets API</li>
              <li><strong>Apps Script:</strong> Vytvořte script v Google Sheets → Extensions → Apps Script → Deploy as Web App</li>
              <li>Export zahrnuje: datum, nabídku, poptávku, zisk, score, lokality, URL, stav, prioritu, poznámky</li>
            </ol>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-4 gap-2 mb-4">
        <input type="number" value={minProfit} onChange={(e) => setMinProfit(Number(e.target.value))} className="bg-slate-900 border border-slate-700 rounded p-2" placeholder="Min zisk" />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="bg-slate-900 border border-slate-700 rounded p-2"><option value="opportunity">Řadit dle opportunity score</option><option value="profit">Řadit dle zisku</option></select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hideResolved} onChange={(e) => setHideResolved(e.target.checked)} /> Skrýt vyřešené</label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hidePreviouslySeen} onChange={(e) => setHidePreviouslySeen(e.target.checked)} /> 
          Skrýt dříve zobrazené ({previouslySeenKeys.size})
        </label>
        <input value={signature} onChange={(e) => setSignature(e.target.value)} className="bg-slate-900 border border-slate-700 rounded p-2" placeholder="Podpis do šablon" />
      </div>
      
      {/* Select All / Bulk Actions Info */}
      {filteredMatches.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <button onClick={selectAllVisible} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm">
            ✅ Označit všechny na stránce
          </button>
          {selectedMatches.size > 0 && (
            <>
              <span className="text-sm text-slate-300">
                📦 Vybráno: <strong className="text-amber-400">{selectedMatches.size}</strong> zápasů
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
      )}
      
      {/* Bulk Actions Panel */}
      {showBulkActions && selectedMatches.size > 0 && (
        <div className="mb-4 p-4 bg-slate-900 border border-slate-700 rounded-xl">
          <h3 className="text-lg font-semibold text-amber-400 mb-3">📦 Hromadné akce pro {selectedMatches.size} vybraných zápasů</h3>
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

      <div className="grid md:grid-cols-4 gap-2 mb-5 text-sm">
        <input value={alertsConfig.telegramBotToken} onChange={(e) => setAlertsConfig((p) => ({ ...p, telegramBotToken: e.target.value }))} className="bg-slate-900 border border-slate-700 rounded p-2" placeholder="Telegram bot token" />
        <input value={alertsConfig.telegramChatId} onChange={(e) => setAlertsConfig((p) => ({ ...p, telegramChatId: e.target.value }))} className="bg-slate-900 border border-slate-700 rounded p-2" placeholder="Telegram chat ID" />
        <input value={alertsConfig.emailWebhookUrl} onChange={(e) => setAlertsConfig((p) => ({ ...p, emailWebhookUrl: e.target.value }))} className="bg-slate-900 border border-slate-700 rounded p-2" placeholder="Email webhook" />
        <input value={alertsConfig.discordWebhookUrl} onChange={(e) => setAlertsConfig((p) => ({ ...p, discordWebhookUrl: e.target.value }))} className="bg-slate-900 border border-slate-700 rounded p-2" placeholder="Discord webhook" />
      </div>

      <div className="space-y-6">
        {/* Alerts Configuration Panel */}
        <div className="bg-slate-900 rounded-xl p-5 border border-slate-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-emerald-400">🔔 Konfigurace alertů</h3>
            <div className="flex gap-2">
              <button onClick={() => setShowAlertsConfig(!showAlertsConfig)} className="px-3 py-1 bg-slate-700 rounded hover:bg-slate-600">
                {showAlertsConfig ? 'Skrýt' : 'Zobrazit'} konfiguraci
              </button>
              <button onClick={testAlerts} className="px-3 py-1 bg-amber-700 rounded hover:bg-amber-600">🧪 Test</button>
              <button onClick={saveAlertsConfig} className="px-3 py-1 bg-emerald-700 rounded hover:bg-emerald-600">💾 Uložit</button>
            </div>
          </div>
          
          {alertsStatus && (
            <div className="mb-4 p-3 bg-slate-800 rounded border border-slate-600 text-sm">
              {alertsStatus}
            </div>
          )}
          
          {showAlertsConfig && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-sky-400">Telegram</h4>
                <input 
                  value={alertsConfig.telegramBotToken} 
                  onChange={(e) => setAlertsConfig((p) => ({ ...p, telegramBotToken: e.target.value }))} 
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm" 
                  placeholder="Bot token (např. 123456:ABC-DEF1234...)" 
                />
                <input 
                  value={alertsConfig.telegramChatId} 
                  onChange={(e) => setAlertsConfig((p) => ({ ...p, telegramChatId: e.target.value }))} 
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm" 
                  placeholder="Chat ID (např. -1001234567890)" 
                />
              </div>
              
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-purple-400">Email & Discord</h4>
                <input 
                  value={alertsConfig.emailWebhookUrl} 
                  onChange={(e) => setAlertsConfig((p) => ({ ...p, emailWebhookUrl: e.target.value }))} 
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm" 
                  placeholder="Email webhook URL" 
                />
                <input 
                  value={alertsConfig.discordWebhookUrl} 
                  onChange={(e) => setAlertsConfig((p) => ({ ...p, discordWebhookUrl: e.target.value }))} 
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm" 
                  placeholder="Discord webhook URL" 
                />
              </div>
              
              <div className="space-y-3 md:col-span-2">
                <h4 className="text-sm font-medium text-amber-400">Filtry</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Minimální zisk (Kč)</label>
                    <input 
                      type="number"
                      value={alertsConfig.minProfit} 
                      onChange={(e) => setAlertsConfig((p) => ({ ...p, minProfit: Number(e.target.value) }))} 
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm" 
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Minimální score</label>
                    <input 
                      type="number"
                      value={alertsConfig.minScore} 
                      onChange={(e) => setAlertsConfig((p) => ({ ...p, minScore: Number(e.target.value) }))} 
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm" 
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-2 md:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input 
                    type="checkbox" 
                    checked={alertsConfig.enabled} 
                    onChange={(e) => setAlertsConfig((p) => ({ ...p, enabled: e.target.checked }))} 
                  />
                  <span>Povolit automatické alerty</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input 
                    type="checkbox" 
                    checked={alertsConfig.autoSendAfterCompare} 
                    onChange={(e) => setAlertsConfig((p) => ({ ...p, autoSendAfterCompare: e.target.checked }))} 
                  />
                  <span>Poslat automaticky po porovnání</span>
                </label>
              </div>
            </div>
          )}
        </div>
        {filteredMatches.map((match) => {
          const matchKey = getMatchKey(match.offer, match.demand);
          const meta = metaByMatch[matchKey] || defaultMeta();
          
          // Score breakdown tooltip
          const scoreDetails = `
Detail skóre reálné příležitosti:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Zisk (net): ${match.arbitrageScore || 0} Kč → ${(Math.min(((match.arbitrageScore || 0) - 400) / 7000 * 100, 100)).toFixed(0)} bodů (28%)
Podobnost inzerátů: ${(match.similarity || 0).toFixed(0)}% → ${(match.similarity || 0) * 0.23} bodů (23%)
Marže: ${match.expectedNetProfit ? (((match.demand.price ? parseFloat(match.demand.price.replace(/[^0-9,-]+/g, '').replace(',', '.')) : 0) - match.expectedNetProfit) / (match.demand.price ? parseFloat(match.demand.price.replace(/[^0-9,-]+/g, '').replace(',', '.')) : 0) * 100).toFixed(1) : 'N/A'}% → ${(match.marginScore || 0).toFixed(0)} bodů (16%)
Stáří inzerátů: ${(match.freshness || 0).toFixed(0)}% → ${(match.freshness || 0) * 0.13} bodů (13%)
Lokalita: ${(match.locationScore || 0).toFixed(0)}% → ${(match.locationScore || 0) * 0.10} bodů (10%)
Důvěryhodnost ceny: ${(match.priceTrustScore || 0).toFixed(0)}% → ${(match.priceTrustScore || 0) * 0.10} bodů (10%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CELKEM: ${match.realOpportunityScore || 0} bodů (0-100)
          `.trim();
          
          return (
            <div key={matchKey} className="bg-slate-700/50 rounded-xl p-5 border border-slate-600">
              <div className="flex flex-wrap justify-between gap-2 mb-2">
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    checked={selectedMatches.has(matchKey)} 
                    onChange={() => toggleSelectMatch(matchKey)}
                    className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-amber-600 focus:ring-amber-500"
                    title="Označit pro hromadnou akci"
                  />
                  <div className="text-sm">Stav: <b>{statusLabel[meta.status]}</b> · Priorita: <b>{meta.priority}</b> · Poslední akce: <b>{new Date(meta.lastActionAt).toLocaleString('cs-CZ')}</b></div>
                </div>
                <div className="text-right flex items-center gap-3">
                  <span title={scoreDetails} className="cursor-help" aria-label={scoreDetails}>
                    Zisk <b className="text-emerald-400">+{match.arbitrageScore?.toLocaleString('cs-CZ')} Kč</b> ·
                    Opportunity <b className="text-amber-400" title={scoreDetails}>{match.realOpportunityScore || match.opportunityScore || 0}</b>
                    <span className="ml-1 text-xs text-slate-400">❓</span>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
                <div className="bg-slate-800 rounded-lg p-3"><b>Nabídka</b><div>{match.offer.title}</div><div>{match.offer.price} · {match.offer.location}</div><a className="text-sky-400" target="_blank" href={match.offer.link || match.offer.url}>Otevřít</a></div>
                <div className="bg-slate-800 rounded-lg p-3"><b>Poptávka</b><div>{match.demand.title}</div><div>{match.demand.price} · {match.demand.location}</div><a className="text-purple-400" target="_blank" href={match.demand.link || match.demand.url}>Otevřít</a></div>
              </div>

              <div className="grid md:grid-cols-4 gap-2 mt-3">
                <select value={meta.status} onChange={(e) => updateMatchMeta(matchKey, { status: e.target.value as MatchStatus })} className="bg-slate-900 border border-slate-700 rounded p-2">
                  <option value="new">Nové</option><option value="review">Prověřit</option><option value="contacted">Kontaktováno</option><option value="negotiation">Vyjednávání</option><option value="closed">Uzavřeno</option>
                </select>
                <select value={meta.priority} onChange={(e) => updateMatchMeta(matchKey, { priority: e.target.value as MatchPriority })} className="bg-slate-900 border border-slate-700 rounded p-2">
                  <option value="low">Nízká</option><option value="medium">Střední</option><option value="high">Vysoká</option><option value="critical">Kritická</option>
                </select>
                <input type="datetime-local" value={meta.followUpAt ? meta.followUpAt.slice(0, 16) : ''} onChange={(e) => updateMatchMeta(matchKey, { followUpAt: e.target.value, followUpState: 'waiting' })} className="bg-slate-900 border border-slate-700 rounded p-2" />
                <select value={meta.followUpState} onChange={(e) => updateMatchMeta(matchKey, { followUpState: e.target.value as any })} className="bg-slate-900 border border-slate-700 rounded p-2">
                  <option value="none">Bez reminderu</option><option value="waiting">Čeká se</option><option value="no_response">Neodpověděl</option><option value="done">Hotovo</option>
                </select>
              </div>

              <textarea value={meta.note} onChange={(e) => updateMatchMeta(matchKey, { note: e.target.value })} placeholder="Poznámka" className="mt-2 w-full bg-slate-900 border border-slate-700 rounded p-2" />

              {/* Due Diligence Checklist */}
              <div className="mt-4 bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-emerald-400">✅ Due Diligence Checklist</h4>
                  <span className="text-xs text-slate-400">
                    {Object.values(meta.checklist).filter(Boolean).length} / {Object.keys(meta.checklist).length} splněno
                  </span>
                </div>
                
                {/* Progress bar */}
                <div className="w-full bg-slate-700 rounded-full h-2 mb-3">
                  <div 
                    className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(Object.values(meta.checklist).filter(Boolean).length / Object.keys(meta.checklist).length) * 100}%` }}
                  />
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <label className={`flex flex-col items-center justify-center p-3 rounded-lg border cursor-pointer transition-all ${meta.checklist.imeiVerified ? 'bg-emerald-900/30 border-emerald-600' : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'}`}>
                    <input 
                      type="checkbox" 
                      checked={meta.checklist.imeiVerified} 
                      onChange={(e) => updateMatchMeta(matchKey, { checklist: { ...meta.checklist, imeiVerified: e.target.checked } })} 
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="text-xs mt-2 text-center">🆔 IMEI</span>
                    <span className="text-xs text-slate-400 text-center">Ověřeno</span>
                  </label>
                  
                  <label className={`flex flex-col items-center justify-center p-3 rounded-lg border cursor-pointer transition-all ${meta.checklist.batteryHealthChecked ? 'bg-emerald-900/30 border-emerald-600' : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'}`}>
                    <input 
                      type="checkbox" 
                      checked={meta.checklist.batteryHealthChecked} 
                      onChange={(e) => updateMatchMeta(matchKey, { checklist: { ...meta.checklist, batteryHealthChecked: e.target.checked } })} 
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="text-xs mt-2 text-center">🔋 Baterie</span>
                    <span className="text-xs text-slate-400 text-center">Zkontrolována</span>
                  </label>
                  
                  <label className={`flex flex-col items-center justify-center p-3 rounded-lg border cursor-pointer transition-all ${meta.checklist.displayChecked ? 'bg-emerald-900/30 border-emerald-600' : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'}`}>
                    <input 
                      type="checkbox" 
                      checked={meta.checklist.displayChecked} 
                      onChange={(e) => updateMatchMeta(matchKey, { checklist: { ...meta.checklist, displayChecked: e.target.checked } })} 
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="text-xs mt-2 text-center">📱 Displej</span>
                    <span className="text-xs text-slate-400 text-center">Bez vad</span>
                  </label>
                  
                  <label className={`flex flex-col items-center justify-center p-3 rounded-lg border cursor-pointer transition-all ${meta.checklist.accessoriesChecked ? 'bg-emerald-900/30 border-emerald-600' : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'}`}>
                    <input 
                      type="checkbox" 
                      checked={meta.checklist.accessoriesChecked} 
                      onChange={(e) => updateMatchMeta(matchKey, { checklist: { ...meta.checklist, accessoriesChecked: e.target.checked } })} 
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="text-xs mt-2 text-center">🔌 Příslušenství</span>
                    <span className="text-xs text-slate-400 text-center">Kompletní</span>
                  </label>
                  
                  <label className={`flex flex-col items-center justify-center p-3 rounded-lg border cursor-pointer transition-all ${meta.checklist.warrantyProofChecked ? 'bg-emerald-900/30 border-emerald-600' : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'}`}>
                    <input 
                      type="checkbox" 
                      checked={meta.checklist.warrantyProofChecked} 
                      onChange={(e) => updateMatchMeta(matchKey, { checklist: { ...meta.checklist, warrantyProofChecked: e.target.checked } })} 
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="text-xs mt-2 text-center">📄 Záruka</span>
                    <span className="text-xs text-slate-400 text-center">Doklad</span>
                  </label>
                </div>
              </div>

              {/* Autonomous Process Button */}
              <div className="mt-4 flex flex-wrap gap-3 items-center">
                <button
                  onClick={() => runAutonomousProcess(match)}
                  disabled={runningAutomation.has(matchKey)}
                  className={`px-5 py-3 rounded-lg font-medium flex items-center gap-2 transition-all ${
                    runningAutomation.has(matchKey)
                      ? 'bg-slate-600 cursor-not-allowed'
                      : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg hover:shadow-xl'
                  }`}
                  title="Spustí všechny autonomní kroky: Fraud analýza, Priority scoring, Follow-up scheduling, Analytics, Meeting suggestions"
                >
                  {runningAutomation.has(matchKey) ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Probíhá autonomní proces...
                    </>
                  ) : (
                    <>
                      <span>🚀</span>
                      Spustit autonomní proces
                    </>
                  )}
                </button>

                {/* Automation Result Status */}
                {automationResults[matchKey] && (
                  <div className={`text-sm px-3 py-2 rounded-lg ${
                    automationResults[matchKey].status === 'success'
                      ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-700'
                      : automationResults[matchKey].status === 'error'
                      ? 'bg-rose-900/30 text-rose-400 border border-rose-700'
                      : 'bg-slate-700 text-slate-300 border border-slate-600'
                  }`}>
                    {automationResults[matchKey].message}
                  </div>
                )}

                {/* Quick Actions */}
                <div className="flex gap-2 ml-auto">
                  <button
                    className="px-3 py-1 bg-amber-700 hover:bg-amber-600 rounded text-sm"
                    onClick={() => updateMatchMeta(matchKey, { followUpAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), followUpState: 'waiting' })}
                    title="Naplánovat follow-up za 24 hodin"
                  >
                    ⏰ Follow-up 24h
                  </button>
                  <button
                    className="px-3 py-1 bg-rose-700 hover:bg-rose-600 rounded text-sm"
                    onClick={() => updateMatchMeta(matchKey, { resolved: !meta.resolved })}
                    title={meta.resolved ? 'Označit jako aktivní' : 'Označit jako vyřešené'}
                  >
                    {meta.resolved ? '✅ Aktivní' : '❌ Vyřešeno'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ResultsDisplay;
