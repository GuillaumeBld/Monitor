// API Route: /api/financial-events
// Fetches IPO calendar, dividend calendar, and price movers
// Data: Finnhub (primary) + Yahoo Finance (movers)
// Cache: Upstash Redis with TTLs per event type

import { NextResponse } from 'next/server';
import { redisGet, redisSet } from '@/lib/redis';
import type {
  IPOEvent,
  DividendEvent,
  PriceMoverEvent,
  FinancialEventsResponse,
} from '@/lib/types';

export const runtime = 'edge';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY ?? '';
const MOVER_THRESHOLD = 2.0;

// ── Date range helper ───────────────────────────────────────────────

function dateRange(daysBack: number, daysForward: number) {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - daysBack);
  const to = new Date(now);
  to.setDate(to.getDate() + daysForward);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

// ── IPO status normalizer ───────────────────────────────────────────

function normalizeIPOStatus(raw: string): IPOEvent['status'] {
  const s = (raw ?? '').toLowerCase();
  if (s === 'priced') return 'priced';
  if (s === 'filed') return 'filed';
  if (s === 'withdrawn') return 'withdrawn';
  return 'expected';
}

function normalizeDividendFreq(raw: string): DividendEvent['frequency'] {
  const f = (raw ?? '').toLowerCase();
  if (f.includes('annual')) return 'annual';
  if (f.includes('month')) return 'monthly';
  if (f.includes('special')) return 'special';
  return 'quarterly';
}

// ── Fetchers ────────────────────────────────────────────────────────

async function fetchIPOs(): Promise<{ events: IPOEvent[]; gap: string | null }> {
  const cacheKey = 'financial:ipos';
  const cached = await redisGet(cacheKey);
  if (cached) return { events: JSON.parse(cached), gap: null };

  if (!FINNHUB_API_KEY) {
    return { events: [], gap: 'ipo: missing FINNHUB_API_KEY' };
  }

  const { from, to } = dateRange(7, 30);
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/calendar/ipo?from=${from}&to=${to}&token=${FINNHUB_API_KEY}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) throw new Error(`Finnhub IPO ${res.status}`);

    const raw = (await res.json()) as {
      ipoCalendar?: Array<{
        symbol: string;
        name: string;
        date: string;
        price: string;
        numberOfShares: number;
        exchange: string;
        status: string;
      }>;
    };

    const events: IPOEvent[] = (raw.ipoCalendar ?? []).map((item) => ({
      type: 'ipo',
      symbol: item.symbol ?? '',
      name: item.name ?? '',
      date: item.date ?? '',
      price: item.price ? parseFloat(item.price) : null,
      shares: item.numberOfShares ? item.numberOfShares / 1_000_000 : null,
      exchange: item.exchange ?? '',
      status: normalizeIPOStatus(item.status),
    }));

    await redisSet(cacheKey, JSON.stringify(events), 3600);
    return { events, gap: null };
  } catch (e) {
    return { events: [], gap: `ipo: ${(e as Error).message}` };
  }
}

async function fetchDividends(): Promise<{ events: DividendEvent[]; gap: string | null }> {
  const cacheKey = 'financial:dividends';
  const cached = await redisGet(cacheKey);
  if (cached) return { events: JSON.parse(cached), gap: null };

  if (!FINNHUB_API_KEY) {
    return { events: [], gap: 'dividends: missing FINNHUB_API_KEY' };
  }

  const { from, to } = dateRange(3, 14);
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/calendar/dividend?from=${from}&to=${to}&token=${FINNHUB_API_KEY}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) throw new Error(`Finnhub dividend ${res.status}`);

    const raw = (await res.json()) as {
      dividendCalendar?: Array<{
        symbol: string;
        exDate: string;
        payDate: string;
        amount: number;
        freq: string;
      }>;
    };

    const events: DividendEvent[] = (raw.dividendCalendar ?? [])
      .filter((item) => item.amount > 0)
      .map((item) => ({
        type: 'dividend',
        symbol: item.symbol ?? '',
        name: item.symbol ?? '',
        exDate: item.exDate ?? '',
        payDate: item.payDate || null,
        amount: item.amount ?? 0,
        frequency: normalizeDividendFreq(item.freq),
      }));

    await redisSet(cacheKey, JSON.stringify(events), 1800);
    return { events, gap: null };
  } catch (e) {
    return { events: [], gap: `dividends: ${(e as Error).message}` };
  }
}

interface YahooScreenerResponse {
  finance?: {
    result?: Array<{
      quotes: Array<{
        symbol: string;
        shortName?: string;
        regularMarketPrice?: number;
        regularMarketChangePercent?: number;
        regularMarketVolume?: number;
        marketCap?: number;
      }>;
    }>;
  };
}

async function fetchPriceMovers(): Promise<{ events: PriceMoverEvent[]; gap: string | null }> {
  const cacheKey = 'financial:movers';
  const cached = await redisGet(cacheKey);
  if (cached) return { events: JSON.parse(cached), gap: null };

  try {
    const [gainersRes, losersRes] = await Promise.all([
      fetch(
        'https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=false&scrIds=day_gainers&count=25&fields=symbol,shortName,regularMarketPrice,regularMarketChangePercent,regularMarketVolume,marketCap',
        { signal: AbortSignal.timeout(8000) }
      ),
      fetch(
        'https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=false&scrIds=day_losers&count=25&fields=symbol,shortName,regularMarketPrice,regularMarketChangePercent,regularMarketVolume,marketCap',
        { signal: AbortSignal.timeout(8000) }
      ),
    ]);

    const [gainersData, losersData] = await Promise.all([
      gainersRes.json() as Promise<YahooScreenerResponse>,
      losersRes.json() as Promise<YahooScreenerResponse>,
    ]);

    const rawQuotes = [
      ...(gainersData?.finance?.result?.[0]?.quotes ?? []),
      ...(losersData?.finance?.result?.[0]?.quotes ?? []),
    ];

    const events: PriceMoverEvent[] = rawQuotes
      .filter(
        (q) =>
          q.regularMarketChangePercent !== undefined &&
          Math.abs(q.regularMarketChangePercent) >= MOVER_THRESHOLD
      )
      .map((q) => ({
        type: 'price_mover',
        symbol: q.symbol,
        name: q.shortName ?? q.symbol,
        price: q.regularMarketPrice ?? 0,
        changePercent: q.regularMarketChangePercent ?? 0,
        volume: q.regularMarketVolume ?? 0,
        marketCap: q.marketCap ?? null,
        direction: (q.regularMarketChangePercent ?? 0) >= 0 ? 'up' : 'down',
      }));

    await redisSet(cacheKey, JSON.stringify(events), 300);
    return { events, gap: null };
  } catch (e) {
    return { events: [], gap: `movers: ${(e as Error).message}` };
  }
}

// ── Handler ─────────────────────────────────────────────────────────

export async function GET() {
  const [ipoResult, dividendResult, moversResult] = await Promise.all([
    fetchIPOs(),
    fetchDividends(),
    fetchPriceMovers(),
  ]);

  const gaps: string[] = [
    ipoResult.gap,
    dividendResult.gap,
    moversResult.gap,
  ].filter(Boolean) as string[];

  const payload: FinancialEventsResponse = {
    ipos: ipoResult.events,
    dividends: dividendResult.events,
    movers: moversResult.events,
    lastUpdated: Date.now(),
    gaps,
  };

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
