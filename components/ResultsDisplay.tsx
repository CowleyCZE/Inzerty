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
  const [metaByMatch, setMetaByMatch] = useState<Record<string, MatchMeta>>({});
  const [signature, setSignature] = useState('Inzerty Bot');
  const [alertsConfig, setAlertsConfig] = useState({ telegramBotToken: '', telegramChatId: '', emailWebhookUrl: '', discordWebhookUrl: '', minProfit: 1500, minScore: 70 });

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
    const list = matchedAds
      .filter((match) => (match.arbitrageScore || 0) >= minProfit)
      .filter((match) => {
        if (!hideResolved) return true;
        const meta = metaByMatch[getMatchKey(match.offer, match.demand)] || defaultMeta();
        return !meta.resolved;
      });

    return [...list].sort((a, b) => {
      if (sortBy === 'profit') return (b.arbitrageScore || 0) - (a.arbitrageScore || 0);
      return (b.realOpportunityScore || 0) - (a.realOpportunityScore || 0);
    });
  }, [matchedAds, minProfit, sortBy, hideResolved, metaByMatch]);

  const copyTemplate = async (match: MatchItem, side: 'seller' | 'buyer') => {
    const counterpart = side === 'seller' ? match.offer : match.demand;
    const text = [
      `Dobrý den,`,
      `mám zájem o ${counterpart.title} (${counterpart.price}) v lokalitě ${counterpart.location || 'neuvedeno'}.`,
      `Můžeme se domluvit na detailu a rychlém kontaktu?`,
      `S pozdravem, ${signature}`,
    ].join('\n');
    await navigator.clipboard.writeText(text);
  };

  const exportCsv = async () => {
    const payload = filteredMatches.map((m) => ({
      matchKey: getMatchKey(m.offer, m.demand),
      offerTitle: m.offer.title,
      demandTitle: m.demand.title,
      profit: m.arbitrageScore || 0,
      opportunity: m.realOpportunityScore || 0,
      offerUrl: m.offer.link || m.offer.url,
      demandUrl: m.demand.link || m.demand.url,
      ...(metaByMatch[getMatchKey(m.offer, m.demand)] || defaultMeta()),
    }));

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
    a.download = `inzerty-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sendTopAlerts = async () => {
    await fetch('http://localhost:3001/alerts/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...alertsConfig, matches: filteredMatches }),
    });
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
          <button className="px-3 py-1 bg-sky-700 rounded" onClick={exportCsv}>Export CSV</button>
          <button className="px-3 py-1 bg-purple-700 rounded" onClick={showDailyReport}>Denní report</button>
          <button className="px-3 py-1 bg-emerald-700 rounded" onClick={sendTopAlerts}>Poslat TOP alerty</button>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-2 mb-4">
        <input type="number" value={minProfit} onChange={(e) => setMinProfit(Number(e.target.value))} className="bg-slate-900 border border-slate-700 rounded p-2" placeholder="Min zisk" />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="bg-slate-900 border border-slate-700 rounded p-2"><option value="opportunity">Řadit dle opportunity score</option><option value="profit">Řadit dle zisku</option></select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hideResolved} onChange={(e) => setHideResolved(e.target.checked)} /> Skrýt vyřešené</label>
        <input value={signature} onChange={(e) => setSignature(e.target.value)} className="bg-slate-900 border border-slate-700 rounded p-2" placeholder="Podpis do šablon" />
      </div>

      <div className="grid md:grid-cols-4 gap-2 mb-5 text-sm">
        <input value={alertsConfig.telegramBotToken} onChange={(e) => setAlertsConfig((p) => ({ ...p, telegramBotToken: e.target.value }))} className="bg-slate-900 border border-slate-700 rounded p-2" placeholder="Telegram bot token" />
        <input value={alertsConfig.telegramChatId} onChange={(e) => setAlertsConfig((p) => ({ ...p, telegramChatId: e.target.value }))} className="bg-slate-900 border border-slate-700 rounded p-2" placeholder="Telegram chat ID" />
        <input value={alertsConfig.emailWebhookUrl} onChange={(e) => setAlertsConfig((p) => ({ ...p, emailWebhookUrl: e.target.value }))} className="bg-slate-900 border border-slate-700 rounded p-2" placeholder="Email webhook" />
        <input value={alertsConfig.discordWebhookUrl} onChange={(e) => setAlertsConfig((p) => ({ ...p, discordWebhookUrl: e.target.value }))} className="bg-slate-900 border border-slate-700 rounded p-2" placeholder="Discord webhook" />
      </div>

      <div className="space-y-6">
        {filteredMatches.map((match) => {
          const matchKey = getMatchKey(match.offer, match.demand);
          const meta = metaByMatch[matchKey] || defaultMeta();
          return (
            <div key={matchKey} className="bg-slate-700/50 rounded-xl p-5 border border-slate-600">
              <div className="flex flex-wrap justify-between gap-2">
                <div className="text-sm">Stav: <b>{statusLabel[meta.status]}</b> · Priorita: <b>{meta.priority}</b> · Poslední akce: <b>{new Date(meta.lastActionAt).toLocaleString('cs-CZ')}</b></div>
                <div className="text-right">Zisk <b className="text-emerald-400">+{match.arbitrageScore?.toLocaleString('cs-CZ')} Kč</b> · Opportunity <b>{match.realOpportunityScore}</b></div>
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

              <div className="mt-3 grid md:grid-cols-5 gap-2 text-sm">
                {Object.entries(meta.checklist).map(([k, v]) => (
                  <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={v as boolean} onChange={(e) => updateMatchMeta(matchKey, { checklist: { ...meta.checklist, [k]: e.target.checked } as any })} />{k}</label>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button className="px-3 py-1 bg-cyan-700 rounded" onClick={() => copyTemplate(match, 'seller')}>Zkopírovat zprávu prodávajícímu</button>
                <button className="px-3 py-1 bg-indigo-700 rounded" onClick={() => copyTemplate(match, 'buyer')}>Zkopírovat zprávu kupujícímu</button>
                <button className="px-3 py-1 bg-amber-700 rounded" onClick={() => updateMatchMeta(matchKey, { followUpAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), followUpState: 'waiting' })}>Připomenout za 24h</button>
                <button className="px-3 py-1 bg-rose-700 rounded" onClick={() => updateMatchMeta(matchKey, { resolved: !meta.resolved })}>{meta.resolved ? 'Označit jako aktivní' : 'Označit jako vyřešené / nebrat'}</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ResultsDisplay;
