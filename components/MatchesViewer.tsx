import React, { useState, useEffect, useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchEntry {
  offer: {
    title: string;
    price: string;
    location: string;
    url: string;
    brand: string;
  };
  demand: {
    title: string;
    price: string;
    location: string;
    url: string;
    brand: string;
  };
  arbitrageScore: number;
  similarityScore: number;
  realOpportunityScore: number;
  expectedNetProfit: number;
  locationScore: number;
  priceTrustScore: number;
}

interface MatchesExport {
  timestamp: string;
  totalMatches: number;
  matches: MatchEntry[];
}

// ─── Helper functions ─────────────────────────────────────────────────────────

const getProfitColor = (profit: number): string => {
  if (profit >= 3000) return '#10b981';
  if (profit >= 1000) return '#f59e0b';
  if (profit > 0)     return '#6366f1';
  return '#64748b';
};

const getScoreColor = (score: number): string => {
  if (score >= 60) return '#10b981';
  if (score >= 50) return '#f59e0b';
  if (score >= 40) return '#6366f1';
  return '#64748b';
};

const formatPrice = (price: string) => price.replace(/\s/g, '\u00a0');

// ─── ScoreBar ─────────────────────────────────────────────────────────────────

const ScoreBar: React.FC<{ label: string; value: number; max?: number; color?: string }> = ({
  label, value, max = 100, color
}) => {
  const pct = Math.min(100, (value / max) * 100);
  const barColor = color ?? getScoreColor(value);
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ color: barColor, fontWeight: 600 }}>{value}</span>
      </div>
      <div style={{ height: 4, background: '#1e293b', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: barColor,
          borderRadius: 99,
          transition: 'width 0.6s ease'
        }} />
      </div>
    </div>
  );
};

// ─── MetricBox ────────────────────────────────────────────────────────────────

const MetricBox: React.FC<{ label: string; value: string; sub: string; valueColor?: string }> = ({ label, value, sub, valueColor }) => (
  <div style={{ background: '#0f172a', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
    <div style={{ fontSize: 10, color: '#475569', marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 14, fontWeight: 700, color: valueColor ?? '#e2e8f0', marginBottom: 1 }}>{value}</div>
    <div style={{ fontSize: 10, color: '#334155' }}>{sub}</div>
  </div>
);

// ─── ScorePill ────────────────────────────────────────────────────────────────

const ScorePill: React.FC<{ label: string; value: number; isKc?: boolean }> = ({ label, value, isKc }) => {
  const color = getScoreColor(isKc ? (value > 2000 ? 70 : value > 500 ? 55 : 40) : value);
  return (
    <div style={{
      background: '#0f172a', border: `1px solid ${color}33`,
      borderRadius: 8, padding: '6px 10px', textAlign: 'center'
    }}>
      <div style={{ fontSize: 10, color: '#475569', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color }}>
        {isKc ? `${value.toLocaleString('cs-CZ')} Kč` : value}
      </div>
    </div>
  );
};

// ─── StatChip ────────────────────────────────────────────────────────────────

const StatChip: React.FC<{ label: string; value: string | number; color: string }> = ({ label, value, color }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
    <div style={{ fontSize: 11, color: '#475569' }}>{label}</div>
  </div>
);

// ─── MatchCard ────────────────────────────────────────────────────────────────

const MatchResultCard: React.FC<{ match: MatchEntry; rank: number }> = ({ match, rank }) => {
  const [expanded, setExpanded] = useState(false);
  const profitColor = getProfitColor(match.expectedNetProfit);

  return (
    <div
      onClick={() => setExpanded(p => !p)}
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        border: `1px solid ${expanded ? '#334155' : '#1e293b'}`,
        borderRadius: 16,
        padding: '18px 20px',
        cursor: 'pointer',
        transition: 'all 0.25s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.border = '1px solid #334155';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.border = `1px solid ${expanded ? '#334155' : '#1e293b'}`;
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      {/* Rank badge */}
      <div style={{
        position: 'absolute', top: 14, right: 14,
        width: 28, height: 28, borderRadius: '50%',
        background: rank <= 3 ? 'linear-gradient(135deg,#f59e0b,#d97706)' : '#1e293b',
        border: rank <= 3 ? 'none' : '1px solid #334155',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700,
        color: rank <= 3 ? '#fff' : '#64748b',
      }}>
        #{rank}
      </div>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginRight: 36 }}>
        <span style={{
          background: '#0f172a', border: '1px solid #334155',
          borderRadius: 8, padding: '2px 10px', fontSize: 11,
          color: '#7dd3fc', whiteSpace: 'nowrap', flexShrink: 0
        }}>
          {match.offer.brand}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 600, lineHeight: 1.4, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {match.offer.title}
          </div>
          <div style={{ fontSize: 11, color: '#475569' }}>
            📍 {match.offer.location}
          </div>
        </div>
      </div>

      {/* Arrow */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0' }}>
        <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, #1e3a5f, #0f172a)' }} />
        <span style={{ fontSize: 16, color: '#38bdf8' }}>→</span>
        <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, #1e3a5f, #0f172a)' }} />
      </div>

      {/* Demand */}
      <div style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 10 }}>
        <span style={{ color: '#10b981', marginRight: 6 }}>🛒</span>
        {match.demand.title}
        <span style={{ color: '#475569', marginLeft: 8, fontSize: 11 }}>📍 {match.demand.location}</span>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <MetricBox label="Kupní cena" value={formatPrice(match.offer.price)} sub="nabídka" />
        <MetricBox
          label="Očekávaný zisk"
          value={match.expectedNetProfit > 0 ? `+${match.expectedNetProfit.toLocaleString('cs-CZ')} Kč` : '—'}
          sub="čistý profit"
          valueColor={profitColor}
        />
        <MetricBox label="Prodejní cena" value={formatPrice(match.demand.price)} sub="poptávka" />
      </div>

      {/* Score pills */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
        <ScorePill label="Příležitost" value={match.realOpportunityScore} />
        <ScorePill label="Arbitráž" value={match.arbitrageScore} isKc />
        <ScorePill label="Podobnost" value={match.similarityScore} />
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ marginTop: 16, borderTop: '1px solid #1e3a5f', paddingTop: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
            <ScoreBar label="Skóre příležitosti" value={match.realOpportunityScore} />
            <ScoreBar label="Důvěra v cenu" value={match.priceTrustScore} />
            <ScoreBar label="Lokační skóre" value={match.locationScore} />
            <ScoreBar label="Arbitrážní spread" value={match.arbitrageScore} max={5000} color="#6366f1" />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a
              href={match.offer.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12, textDecoration: 'none',
                background: '#0f172a', border: '1px solid #334155', color: '#7dd3fc',
                transition: 'all 0.2s'
              }}
            >
              🔗 Nabídka (koupit)
            </a>
            <a
              href={match.demand.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12, textDecoration: 'none',
                background: '#0f172a', border: '1px solid #334155', color: '#86efac',
                transition: 'all 0.2s'
              }}
            >
              🔗 Poptávka (prodat)
            </a>
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: '#334155' }}>
        {expanded ? '▲ Skrýt detail' : '▼ Zobrazit detail'}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

type SortKey = 'profit' | 'opportunity' | 'arbitrage';
const BRANDS = ['Vše', 'Apple', 'Samsung', 'Google', 'Nokia', 'Ostatní'];

const MatchesViewer: React.FC = () => {
  const [data, setData] = useState<MatchesExport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brandFilter, setBrandFilter] = useState('Vše');
  const [sortKey, setSortKey] = useState<SortKey>('opportunity');
  const [minProfit, setMinProfit] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch('http://localhost:3001/matches/export');
        if (!res.ok) throw new Error(`Server vrátil ${res.status}`);
        const json: MatchesExport = await res.json();
        setData(json);
      } catch (err) {
        try {
          const res2 = await fetch('/matches_export.json');
          if (!res2.ok) throw new Error('Soubor nenalezen');
          const json2: MatchesExport = await res2.json();
          setData(json2);
        } catch {
          setError(err instanceof Error ? err.message : 'Neznámá chyba');
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.matches
      .filter(m => brandFilter === 'Vše' || m.offer.brand === brandFilter)
      .filter(m => m.expectedNetProfit >= minProfit)
      .filter(m => {
        if (!search) return true;
        const q = search.toLowerCase();
        return m.offer.title.toLowerCase().includes(q) || m.demand.title.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (sortKey === 'profit') return b.expectedNetProfit - a.expectedNetProfit;
        if (sortKey === 'opportunity') return b.realOpportunityScore - a.realOpportunityScore;
        return b.arbitrageScore - a.arbitrageScore;
      });
  }, [data, brandFilter, sortKey, minProfit, search]);

  const totalProfit = useMemo(() =>
    filtered.reduce((s, m) => s + Math.max(0, m.expectedNetProfit), 0),
    [filtered]
  );

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, flexDirection: 'column', gap: 16 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        border: '3px solid #1e293b', borderTop: '3px solid #38bdf8',
        animation: 'spin 0.8s linear infinite'
      }} />
      <div style={{ color: '#475569', fontSize: 14 }}>Načítám výsledky…</div>
    </div>
  );

  if (error || !data) return (
    <div style={{
      background: '#1e293b', border: '1px solid #7f1d1d', borderRadius: 16,
      padding: 32, textAlign: 'center', color: '#fca5a5'
    }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
      <div style={{ fontSize: 16, marginBottom: 8 }}>Nepodařilo se načíst výsledky</div>
      <div style={{ fontSize: 13, color: '#94a3b8' }}>{error}</div>
      <div style={{ fontSize: 12, color: '#475569', marginTop: 12 }}>
        Ujistěte se, že backend běží na <code style={{ color: '#7dd3fc' }}>localhost:3001</code>
      </div>
    </div>
  );

  return (
    <div>
      {/* Header stats */}
      <div style={{
        background: 'linear-gradient(135deg, #0c1628 0%, #0f2044 50%, #0c1628 100%)',
        border: '1px solid #1e3a5f',
        borderRadius: 20, padding: '24px 28px', marginBottom: 24
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.5px' }}>
              📊 Výsledky porovnání inzerátů
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569' }}>
              Export ze dne {new Date(data.timestamp).toLocaleString('cs-CZ')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <StatChip label="Celkem shod" value={data.totalMatches} color="#38bdf8" />
            <StatChip label="Zobrazeno" value={filtered.length} color="#a78bfa" />
            <StatChip label="Potenciál" value={`${totalProfit.toLocaleString('cs-CZ')} Kč`} color="#10b981" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        background: '#0f172a', border: '1px solid #1e293b',
        borderRadius: 14, padding: '16px 20px', marginBottom: 20,
        display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center'
      }}>
        {/* Search */}
        <div style={{ flex: '1 1 200px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#475569' }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Hledat v inzerátech…"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#1e293b', border: '1px solid #334155',
              borderRadius: 10, padding: '8px 12px 8px 36px',
              color: '#e2e8f0', fontSize: 13, outline: 'none'
            }}
          />
        </div>

        {/* Brand filter */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {BRANDS.map(b => (
            <button
              key={b}
              onClick={() => setBrandFilter(b)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12, border: 'none', cursor: 'pointer',
                background: brandFilter === b ? '#1d4ed8' : '#1e293b',
                color: brandFilter === b ? '#fff' : '#94a3b8',
                transition: 'all 0.15s', fontWeight: brandFilter === b ? 700 : 400
              }}
            >
              {b}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select
          value={sortKey}
          onChange={e => setSortKey(e.target.value as SortKey)}
          style={{
            background: '#1e293b', border: '1px solid #334155', borderRadius: 10,
            padding: '8px 12px', color: '#e2e8f0', fontSize: 13, cursor: 'pointer', outline: 'none'
          }}
        >
          <option value="opportunity">↓ Skóre příležitosti</option>
          <option value="profit">↓ Čistý zisk</option>
          <option value="arbitrage">↓ Arbitrážní spread</option>
        </select>

        {/* Min profit */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#475569', whiteSpace: 'nowrap' }}>Min. zisk</span>
          <input
            type="number"
            value={minProfit}
            onChange={e => setMinProfit(Number(e.target.value))}
            step={100}
            style={{
              width: 80, background: '#1e293b', border: '1px solid #334155',
              borderRadius: 10, padding: '8px 10px', color: '#e2e8f0', fontSize: 13, outline: 'none'
            }}
          />
          <span style={{ fontSize: 12, color: '#475569' }}>Kč</span>
        </div>
      </div>

      {/* Results grid */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60, color: '#475569',
          background: '#0f172a', borderRadius: 16, border: '1px solid #1e293b'
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔎</div>
          <div style={{ fontSize: 15 }}>Žádné shody neodpovídají filtrům</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {filtered.map((match, i) => (
            <MatchResultCard key={`${match.offer.url}-${i}`} match={match} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export default MatchesViewer;
