import React, { useMemo, useState, useEffect } from 'react';
import { Ad } from '../types';

type MatchStatus = 'new' | 'review' | 'contacted' | 'negotiation' | 'closed';

type DueDiligenceChecklist = {
  imeiChecked: boolean;
  batteryChecked: boolean;
  displayChecked: boolean;
  accessoriesChecked: boolean;
  proofChecked: boolean;
};

interface MatchMeta {
  status: MatchStatus;
  note: string;
  reminderAt: string;
  checklist: DueDiligenceChecklist;
}

interface AlertConfig {
  telegramBotToken: string;
  telegramChatId: string;
  emailWebhookUrl: string;
}

interface MatchItem {
  offer: Ad;
  demand: Ad;
  arbitrageScore?: number;
  opportunityScore?: number;
  realOpportunityScore?: number;
  expectedNetProfit?: number;
}

interface ResultsDisplayProps {
  matchedAds: MatchItem[];
  isLoading?: boolean;
}

const STORAGE_KEY = 'inzerty_match_meta_v2';
const ALERT_STORAGE_KEY = 'inzerty_alert_config_v1';

const defaultChecklist: DueDiligenceChecklist = {
  imeiChecked: false,
  batteryChecked: false,
  displayChecked: false,
  accessoriesChecked: false,
  proofChecked: false,
};

const statusLabel: Record<MatchStatus, string> = {
  new: 'Nové',
  review: 'Prověřit',
  contacted: 'Kontaktováno',
  negotiation: 'Vyjednávání',
  closed: 'Uzavřeno',
};

const statusColorClass: Record<MatchStatus, string> = {
  new: 'bg-blue-900/40 text-blue-300 border-blue-500/30',
  review: 'bg-amber-900/40 text-amber-300 border-amber-500/30',
  contacted: 'bg-purple-900/40 text-purple-300 border-purple-500/30',
  negotiation: 'bg-cyan-900/40 text-cyan-300 border-cyan-500/30',
  closed: 'bg-emerald-900/40 text-emerald-300 border-emerald-500/30',
};

const getMatchKey = (offer: Ad, demand: Ad) => `${offer.url || offer.id}__${demand.url || demand.id}`;

const loadInitialMeta = (): Record<string, MatchMeta> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, MatchMeta>;
  } catch {
    return {};
  }
};

const loadInitialAlertConfig = (): AlertConfig => {
  try {
    const raw = localStorage.getItem(ALERT_STORAGE_KEY);
    if (!raw) {
      return { telegramBotToken: '', telegramChatId: '', emailWebhookUrl: '' };
    }
    return JSON.parse(raw) as AlertConfig;
  } catch {
    return { telegramBotToken: '', telegramChatId: '', emailWebhookUrl: '' };
  }
};

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ matchedAds, isLoading }) => {
  const [minProfit, setMinProfit] = useState<number>(0);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [hideResolved, setHideResolved] = useState<boolean>(false);
  const [metaByMatch, setMetaByMatch] = useState<Record<string, MatchMeta>>(() => loadInitialMeta());
  const [alertConfig, setAlertConfig] = useState<AlertConfig>(() => loadInitialAlertConfig());
  const [alertMessage, setAlertMessage] = useState<string>('');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(metaByMatch));
  }, [metaByMatch]);

  useEffect(() => {
    localStorage.setItem(ALERT_STORAGE_KEY, JSON.stringify(alertConfig));
  }, [alertConfig]);

  const updateMatchMeta = (key: string, partial: Partial<MatchMeta>) => {
    setMetaByMatch((prev) => {
      const current = prev[key] || { status: 'new' as MatchStatus, note: '', reminderAt: '', checklist: defaultChecklist };
      return {
        ...prev,
        [key]: {
          ...current,
          ...partial,
        },
      };
    });
  };

  const updateChecklist = (key: string, field: keyof DueDiligenceChecklist, value: boolean) => {
    setMetaByMatch((prev) => {
      const current = prev[key] || { status: 'new' as MatchStatus, note: '', reminderAt: '', checklist: defaultChecklist };
      return {
        ...prev,
        [key]: {
          ...current,
          checklist: {
            ...(current.checklist || defaultChecklist),
            [field]: value,
          },
        },
      };
    });
  };

  const filteredMatches = useMemo(() => {
    return matchedAds
      .filter((match) => (match.arbitrageScore || 0) >= minProfit)
      .filter((match) => {
        if (!hideResolved) return true;
        const key = getMatchKey(match.offer, match.demand);
        return (metaByMatch[key]?.status || 'new') !== 'closed';
      })
      .sort((a, b) => {
        const factor = sortOrder === 'desc' ? -1 : 1;
        const first = (a.realOpportunityScore || a.opportunityScore || 0) - (b.realOpportunityScore || b.opportunityScore || 0);
        if (first !== 0) return first * factor;
        return ((a.arbitrageScore || 0) - (b.arbitrageScore || 0)) * factor;
      });
  }, [matchedAds, minProfit, sortOrder, hideResolved, metaByMatch]);

  const summary = useMemo(() => {
    if (filteredMatches.length === 0) return { count: 0, totalProfit: 0, avgProfit: 0, avgRealScore: 0 };
    const totalProfit = filteredMatches.reduce((sum, m) => sum + (m.arbitrageScore || 0), 0);
    const avgProfit = Math.round(totalProfit / filteredMatches.length);
    const avgRealScore = Math.round(filteredMatches.reduce((sum, m) => sum + (m.realOpportunityScore || 0), 0) / filteredMatches.length);
    return { count: filteredMatches.length, totalProfit, avgProfit, avgRealScore };
  }, [filteredMatches]);

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  const buildOfferTemplate = (match: MatchItem) =>
    `Dobrý den, mám zájem o inzerát „${match.offer.title}". Je telefon stále dostupný?\nMohu poprosit o stav baterie, displeje a IMEI kontrolu? Děkuji.`;

  const buildDemandTemplate = (match: MatchItem) =>
    `Dobrý den, mám k dispozici telefon odpovídající poptávce „${match.demand.title}".\nPředpokládaná cena: ${(match.demand.price || '').toString()}. Máte stále zájem?`;

  const exportCsv = () => {
    const header = ['offer_title', 'offer_url', 'demand_title', 'demand_url', 'arbitrage', 'opportunity_score', 'real_opportunity_score', 'status', 'note'];
    const rows = filteredMatches.map((m) => {
      const key = getMatchKey(m.offer, m.demand);
      const meta = metaByMatch[key] || { status: 'new' as MatchStatus, note: '', reminderAt: '', checklist: defaultChecklist };
      return [
        m.offer.title,
        m.offer.link || m.offer.url || '',
        m.demand.title,
        m.demand.link || m.demand.url || '',
        m.arbitrageScore || 0,
        m.opportunityScore || 0,
        m.realOpportunityScore || 0,
        meta.status,
        meta.note.replace(/\n/g, ' '),
      ];
    });

    const csv = [header, ...rows]
      .map((line) => line.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arbitrage-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportDailyReport = () => {
    const report = {
      createdAt: new Date().toISOString(),
      summary,
      top5: filteredMatches.slice(0, 5).map((m) => ({
        offer: m.offer.title,
        demand: m.demand.title,
        arbitrage: m.arbitrageScore || 0,
        opportunity: m.opportunityScore || 0,
        realOpportunity: m.realOpportunityScore || 0,
      })),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sendAlerts = async () => {
    setAlertMessage('Odesílám alerty...');
    try {
      const response = await fetch('http://localhost:3001/alerts/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...alertConfig,
          matches: filteredMatches.slice(0, 5),
        }),
      });
      const data = await response.json();
      setAlertMessage(data.message || 'Hotovo');
    } catch {
      setAlertMessage('Alerty se nepodařilo odeslat.');
    }
  };

  const exportIcsReminder = (match: MatchItem, reminderAt: string) => {
    if (!reminderAt) return;
    const start = new Date(reminderAt);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const toIcsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const content = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `UID:${Date.now()}@inzerty`,
      `DTSTAMP:${toIcsDate(new Date())}`,
      `DTSTART:${toIcsDate(start)}`,
      `DTEND:${toIcsDate(end)}`,
      `SUMMARY:Follow-up: ${match.offer.title}`,
      `DESCRIPTION:Prověřit arbitrážní příležitost.`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');

    const blob = new Blob([content], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `follow-up-${Date.now()}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  if (!matchedAds || matchedAds.length === 0) {
    return (
      <div className="bg-slate-800 p-8 rounded-xl shadow-2xl mt-8 text-center border border-slate-700">
        <p className="text-xl text-slate-300">Zatím nebyly nalezeny žádné shody.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-2xl mt-8 border border-slate-700">
      <div className="flex flex-col gap-4 mb-6 border-b border-slate-700 pb-4">
        <h2 className="text-2xl font-semibold text-emerald-400">Akční fronta arbitrážních příležitostí ({filteredMatches.length})</h2>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
          <div className="bg-slate-900 p-3 rounded border border-slate-700">Položky: <b>{summary.count}</b></div>
          <div className="bg-slate-900 p-3 rounded border border-slate-700">Součet zisku: <b>{summary.totalProfit.toLocaleString('cs-CZ')} Kč</b></div>
          <div className="bg-slate-900 p-3 rounded border border-slate-700">Průměrný zisk: <b>{summary.avgProfit.toLocaleString('cs-CZ')} Kč</b></div>
          <div className="bg-slate-900 p-3 rounded border border-slate-700">Průměr Real Score: <b>{summary.avgRealScore}</b></div>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-slate-900 p-2 rounded-lg border border-slate-700">
          <label htmlFor="minProfit" className="text-sm font-medium text-slate-300">Minimální zisk:</label>
          <input type="number" id="minProfit" value={minProfit} onChange={(e) => setMinProfit(Number(e.target.value))} className="w-24 bg-slate-700 border border-slate-600 text-emerald-400 font-bold rounded p-1 text-sm" step="500" min="0" />
          <span className="text-slate-400 text-sm">Kč</span>

          <label htmlFor="sortOrder" className="text-sm font-medium text-slate-300 ml-2">Řazení:</label>
          <select id="sortOrder" value={sortOrder} onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')} className="bg-slate-700 border border-slate-600 text-slate-100 rounded p-1 text-sm">
            <option value="desc">Nejvyšší skóre</option>
            <option value="asc">Nejnižší skóre</option>
          </select>

          <label className="inline-flex items-center gap-2 text-sm text-slate-300 ml-1">
            <input type="checkbox" checked={hideResolved} onChange={(e) => setHideResolved(e.target.checked)} />
            Skrýt vyřešené
          </label>

          <button onClick={exportCsv} className="ml-auto bg-sky-700 hover:bg-sky-600 text-white px-3 py-1 rounded text-sm">Export CSV</button>
          <button onClick={exportDailyReport} className="bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1 rounded text-sm">Denní report</button>
        </div>

        <div className="bg-slate-900 p-3 rounded border border-slate-700 grid md:grid-cols-3 gap-3">
          <input placeholder="Telegram Bot Token" value={alertConfig.telegramBotToken} onChange={(e) => setAlertConfig((p) => ({ ...p, telegramBotToken: e.target.value }))} className="bg-slate-700 border border-slate-600 rounded p-2 text-sm" />
          <input placeholder="Telegram Chat ID" value={alertConfig.telegramChatId} onChange={(e) => setAlertConfig((p) => ({ ...p, telegramChatId: e.target.value }))} className="bg-slate-700 border border-slate-600 rounded p-2 text-sm" />
          <input placeholder="Email webhook URL" value={alertConfig.emailWebhookUrl} onChange={(e) => setAlertConfig((p) => ({ ...p, emailWebhookUrl: e.target.value }))} className="bg-slate-700 border border-slate-600 rounded p-2 text-sm" />
          <button onClick={sendAlerts} className="md:col-span-3 bg-purple-700 hover:bg-purple-600 text-white px-3 py-2 rounded text-sm">Odeslat alerty (Telegram / email webhook)</button>
          {alertMessage && <p className="md:col-span-3 text-xs text-slate-300">{alertMessage}</p>}
        </div>
      </div>

      <div className="space-y-6">
        {filteredMatches.map((match, index) => {
          const matchKey = getMatchKey(match.offer, match.demand);
          const meta = metaByMatch[matchKey] || { status: 'new' as MatchStatus, note: '', reminderAt: '', checklist: defaultChecklist };
          const checklist = meta.checklist || defaultChecklist;

          return (
            <div key={matchKey || index} className="bg-slate-700/50 rounded-xl p-5 border border-slate-600">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4 pb-3 border-b border-slate-600">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-3 py-1 rounded-full text-xs border ${statusColorClass[meta.status]}`}>Stav: {statusLabel[meta.status]}</span>
                  <span className="px-3 py-1 bg-slate-900 rounded-full text-xs text-slate-200">Opportunity: {match.opportunityScore || 0}</span>
                  <span className="px-3 py-1 bg-slate-900 rounded-full text-xs text-slate-200">Real Score: {match.realOpportunityScore || 0}</span>
                  <span className="px-3 py-1 bg-slate-900 rounded-full text-xs text-slate-200">Net: {(match.expectedNetProfit || 0).toLocaleString('cs-CZ')} Kč</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block uppercase tracking-wider font-semibold">Hrubý zisk</span>
                  <span className="text-xl font-bold text-emerald-400">+{(match.arbitrageScore || 0).toLocaleString('cs-CZ')} Kč</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
                <div className="bg-slate-800 rounded-lg p-4 border-l-4 border-sky-500">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-400 bg-sky-900/30 px-2 py-1 rounded">Nabídka (Koupit)</span>
                    <span className="font-bold text-lg text-slate-100">{match.offer.price}</span>
                  </div>
                  <h4 className="font-medium text-slate-200 mb-2">{match.offer.title}</h4>
                  <p className="text-sm text-slate-400 line-clamp-2 mb-3">{match.offer.description}</p>
                  <div className="flex flex-wrap gap-2">
                    <a href={match.offer.link || match.offer.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-sm text-sky-400 hover:text-sky-300">Otevřít inzerát</a>
                    <button onClick={() => copyText(buildOfferTemplate(match))} className="text-xs bg-sky-800 hover:bg-sky-700 px-2 py-1 rounded">Kopírovat šablonu zprávy</button>
                  </div>
                </div>

                <div className="bg-slate-800 rounded-lg p-4 border-l-4 border-purple-500">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-400 bg-purple-900/30 px-2 py-1 rounded">Poptávka (Prodat)</span>
                    <span className="font-bold text-lg text-slate-100">{match.demand.price}</span>
                  </div>
                  <h4 className="font-medium text-slate-200 mb-2">{match.demand.title}</h4>
                  <p className="text-sm text-slate-400 line-clamp-2 mb-3">{match.demand.description}</p>
                  <div className="flex flex-wrap gap-2">
                    <a href={match.demand.link || match.demand.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-sm text-purple-400 hover:text-purple-300">Otevřít inzerát</a>
                    <button onClick={() => copyText(buildDemandTemplate(match))} className="text-xs bg-purple-800 hover:bg-purple-700 px-2 py-1 rounded">Kopírovat šablonu zprávy</button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Stav příležitosti</label>
                  <select value={meta.status} onChange={(e) => updateMatchMeta(matchKey, { status: e.target.value as MatchStatus })} className="w-full bg-slate-900 border border-slate-600 text-slate-100 rounded p-2 text-sm">
                    <option value="new">Nové</option>
                    <option value="review">Prověřit</option>
                    <option value="contacted">Kontaktováno</option>
                    <option value="negotiation">Vyjednávání</option>
                    <option value="closed">Uzavřeno</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Reminder</label>
                  <input type="datetime-local" value={meta.reminderAt || ''} onChange={(e) => updateMatchMeta(matchKey, { reminderAt: e.target.value })} className="w-full bg-slate-900 border border-slate-600 text-slate-100 rounded p-2 text-sm" />
                </div>

                <div className="flex items-end gap-2">
                  <button onClick={() => exportIcsReminder(match, meta.reminderAt)} className="bg-amber-700 hover:bg-amber-600 text-white px-3 py-2 rounded text-sm">Export .ics</button>
                  <button onClick={() => updateMatchMeta(matchKey, { status: 'closed' })} className="bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-2 rounded text-sm">Označit vyřešené</button>
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-xs text-slate-300 mb-1">Poznámka</label>
                <textarea value={meta.note} onChange={(e) => updateMatchMeta(matchKey, { note: e.target.value })} rows={2} placeholder="např. čeká na odpověď, volat večer" className="w-full bg-slate-900 border border-slate-600 text-slate-100 rounded p-2 text-sm" />
              </div>

              <div className="bg-slate-900 rounded p-3 border border-slate-700">
                <p className="text-xs font-semibold text-slate-300 mb-2">Due diligence checklist</p>
                <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-2 text-xs text-slate-200">
                  {[
                    ['imeiChecked', 'IMEI ověřeno'],
                    ['batteryChecked', 'Baterie ověřena'],
                    ['displayChecked', 'Displej ověřen'],
                    ['accessoriesChecked', 'Příslušenství ověřeno'],
                    ['proofChecked', 'Doklad/záruka ověřeny'],
                  ].map(([field, label]) => (
                    <label key={field} className="inline-flex items-center gap-2 bg-slate-800 p-2 rounded border border-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(checklist[field as keyof DueDiligenceChecklist])}
                        onChange={(e) => updateChecklist(matchKey, field as keyof DueDiligenceChecklist, e.target.checked)}
                      />
                      {label}
                    </label>
                  ))}
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
