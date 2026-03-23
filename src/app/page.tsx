'use client';

import { useEffect, useState, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────

interface IPOEvent {
  type: 'ipo';
  symbol: string;
  name: string;
  date: string;
  price: number | null;
  shares: number | null;
  exchange: string;
  status: 'expected' | 'priced' | 'filed' | 'withdrawn';
}

interface DividendEvent {
  type: 'dividend';
  symbol: string;
  name: string;
  exDate: string;
  payDate: string | null;
  amount: number;
  frequency: 'annual' | 'quarterly' | 'monthly' | 'special';
}

interface PriceMoverEvent {
  type: 'price_mover';
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  volume: number;
  marketCap: number | null;
  direction: 'up' | 'down';
}

interface FinancialEventsResponse {
  ipos: IPOEvent[];
  dividends: DividendEvent[];
  movers: PriceMoverEvent[];
  lastUpdated: number;
  gaps: string[];
}

// ── Helpers ─────────────────────────────────────────────────────────

function pct(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function shortDate(iso: string): string {
  if (!iso) return '\u2014';
  const parts = iso.split('-');
  return `${parts[1]}/${parts[2]}`;
}

function mcap(cap: number | null): string {
  if (!cap) return '';
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`;
  return `$${(cap / 1e6).toFixed(0)}M`;
}

// ── Status colors ───────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  priced: '#22c55e',
  expected: '#3b82f6',
  filed: '#f59e0b',
  withdrawn: '#ef4444',
};

// ── Components ──────────────────────────────────────────────────────

function IPOCard({ e }: { e: IPOEvent }) {
  const priceStr = e.price ? `$${e.price.toFixed(2)}` : 'TBD';
  return (
    <div style={cardStyle}>
      <div style={cardHeaderStyle}>
        <span style={symbolStyle}>{e.symbol || '\u2014'}</span>
        <span style={{ ...badgeStyle, background: statusColors[e.status] || '#475569' }}>
          {e.status.toUpperCase()}
        </span>
      </div>
      <div style={nameStyle}>{e.name || e.symbol}</div>
      <div style={metaStyle}>
        <span>\ud83d\udcc5 {shortDate(e.date)}</span>
        <span>\ud83d\udcb5 {priceStr}</span>
        {e.shares && <span>{e.shares.toFixed(1)}M shares</span>}
        <span>{e.exchange}</span>
      </div>
    </div>
  );
}

function DividendCard({ e }: { e: DividendEvent }) {
  return (
    <div style={cardStyle}>
      <div style={cardHeaderStyle}>
        <span style={symbolStyle}>{e.symbol}</span>
        <span style={{ ...badgeStyle, background: '#7c3aed' }}>
          {e.frequency.toUpperCase()}
        </span>
      </div>
      <div style={metaStyle}>
        <span>\ud83d\udcb0 ${e.amount.toFixed(4)}/share</span>
        <span>Ex: {shortDate(e.exDate)}</span>
        <span>Pay: {shortDate(e.payDate ?? '')}</span>
      </div>
    </div>
  );
}

function MoverCard({ e }: { e: PriceMoverEvent }) {
  const isUp = e.direction === 'up';
  const color = isUp ? '#22c55e' : '#ef4444';
  const arrow = isUp ? '\u25b2' : '\u25bc';
  return (
    <div style={cardStyle}>
      <div style={cardHeaderStyle}>
        <span style={symbolStyle}>{e.symbol}</span>
        <span style={{ ...pctStyle, color }}>{arrow} {pct(e.changePercent)}</span>
      </div>
      <div style={nameStyle}>{e.name}</div>
      <div style={metaStyle}>
        <span>${e.price.toFixed(2)}</span>
        {e.marketCap && <span>{mcap(e.marketCap)}</span>}
        <span>{(e.volume / 1_000_000).toFixed(1)}M vol</span>
      </div>
    </div>
  );
}

function Section({
  title,
  emoji,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  emoji: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid #1e293b' }}>
      <button onClick={() => setOpen(!open)} style={toggleStyle}>
        <span>{emoji} {title}</span>
        <span style={countBadgeStyle}>{count}</span>
        <span style={{ marginLeft: 'auto', fontSize: '20px' }}>{open ? '\u25be' : '\u25b8'}</span>
      </button>
      {open && (
        <div style={sectionBodyStyle}>
          {count === 0 ? (
            <div style={emptyStyle}>No events in current window</div>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState<FinancialEventsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>('');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/financial-events');
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json: FinancialEventsResponse = await res.json();
      setData(json);
      setError(null);
      setLastRefresh(
        new Date(json.lastUpdated).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Clock
  const [clock, setClock] = useState('');
  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={rootStyle}>
      {/* Header */}
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '32px' }}>\ud83d\udcca</span>
          <span style={titleStyle}>Financial Events Monitor</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          {lastRefresh && (
            <span style={updatedStyle}>Updated {lastRefresh}</span>
          )}
          <span style={clockStyle}>{clock}</span>
        </div>
      </header>

      {/* Gap warnings */}
      {data?.gaps && data.gaps.length > 0 && (
        <div style={gapStyle}>
          \u26a0\ufe0f Data gaps: {data.gaps.join(' | ')}
        </div>
      )}

      {/* Error */}
      {error && <div style={errorStyle}>\u26a0\ufe0f {error}</div>}

      {/* Loading */}
      {!data && !error && (
        <div style={loadingStyle}>
          <div style={shimmerStyle} />
        </div>
      )}

      {/* Content */}
      {data && (
        <div style={contentStyle}>
          {/* Price Movers - most dynamic, shown first */}
          <Section title="Price Movers \u22652%" emoji="\ud83d\udcc8" count={data.movers.length}>
            <div style={gridStyle}>
              {data.movers
                .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
                .map((e) => (
                  <MoverCard key={`${e.symbol}-${e.direction}`} e={e} />
                ))}
            </div>
          </Section>

          {/* IPOs */}
          <Section title="IPO Calendar" emoji="\ud83d\ude80" count={data.ipos.length}>
            <div style={gridStyle}>
              {data.ipos.map((e) => (
                <IPOCard key={`${e.symbol}-${e.date}`} e={e} />
              ))}
            </div>
          </Section>

          {/* Dividends */}
          <Section title="Dividends" emoji="\ud83d\udcb0" count={data.dividends.length} defaultOpen={false}>
            <div style={gridStyle}>
              {data.dividends.map((e) => (
                <DividendCard key={`${e.symbol}-${e.exDate}`} e={e} />
              ))}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

// ── Styles (inline for TV, large fonts, dark theme) ─────────────────

const rootStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#020617',
  fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
  color: '#e2e8f0',
  padding: '24px 32px',
  boxSizing: 'border-box',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '16px 0 20px',
  borderBottom: '2px solid #1e293b',
  marginBottom: '16px',
};

const titleStyle: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: 700,
  color: '#f1f5f9',
  letterSpacing: '-0.5px',
};

const clockStyle: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: 700,
  color: '#3b82f6',
  fontVariantNumeric: 'tabular-nums',
};

const updatedStyle: React.CSSProperties = {
  fontSize: '16px',
  color: '#64748b',
};

const contentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const toggleStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '14px 16px',
  background: 'none',
  border: 'none',
  borderBottom: '1px solid #1e293b',
  color: '#94a3b8',
  cursor: 'pointer',
  fontSize: '20px',
  textAlign: 'left' as const,
  fontFamily: 'inherit',
};

const countBadgeStyle: React.CSSProperties = {
  background: '#334155',
  borderRadius: '12px',
  padding: '2px 12px',
  fontSize: '16px',
  fontWeight: 600,
};

const sectionBodyStyle: React.CSSProperties = {
  padding: '12px 8px',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: '12px',
};

const cardStyle: React.CSSProperties = {
  background: '#0f172a',
  border: '1px solid #1e293b',
  borderRadius: '10px',
  padding: '14px 18px',
};

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  marginBottom: '6px',
};

const symbolStyle: React.CSSProperties = {
  fontWeight: 700,
  color: '#f1f5f9',
  fontSize: '22px',
};

const pctStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '22px',
  marginLeft: 'auto',
};

const badgeStyle: React.CSSProperties = {
  fontSize: '13px',
  padding: '2px 10px',
  borderRadius: '6px',
  color: '#fff',
  fontWeight: 600,
  marginLeft: 'auto',
};

const nameStyle: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: '16px',
  marginBottom: '6px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const metaStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '14px',
  color: '#64748b',
  fontSize: '16px',
};

const emptyStyle: React.CSSProperties = {
  color: '#475569',
  padding: '20px',
  textAlign: 'center',
  fontSize: '18px',
};

const errorStyle: React.CSSProperties = {
  color: '#f87171',
  padding: '12px 16px',
  fontSize: '16px',
  background: '#1c0808',
  borderRadius: '8px',
  marginBottom: '8px',
};

const gapStyle: React.CSSProperties = {
  background: '#1c1008',
  color: '#fbbf24',
  padding: '10px 16px',
  fontSize: '16px',
  borderRadius: '8px',
  marginBottom: '8px',
};

const loadingStyle: React.CSSProperties = {
  padding: '40px',
};

const shimmerStyle: React.CSSProperties = {
  height: '200px',
  background: 'linear-gradient(90deg, #1e293b 25%, #0f172a 50%, #1e293b 75%)',
  backgroundSize: '200% 100%',
  borderRadius: '10px',
  animation: 'shimmer 1.5s infinite',
};
