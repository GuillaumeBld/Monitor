// API Route: /api/alert-dispatch
// Fires Slack and/or Telegram webhooks for financial events.
// Deduplicates alerts via Redis (24h TTL).

import { NextResponse } from 'next/server';
import { redisGet, redisSet } from '@/lib/redis';
import type {
  FinancialEvent,
  IPOEvent,
  DividendEvent,
  PriceMoverEvent,
  AlertDispatchRequest,
} from '@/lib/types';

export const runtime = 'edge';

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL ?? '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? '';
const ALERT_SECRET = process.env.ALERT_SECRET ?? '';
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL ?? '';
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? '';

// ── Redis deduplication ─────────────────────────────────────────────

async function hasBeenAlerted(alertId: string): Promise<boolean> {
  if (!UPSTASH_REDIS_REST_URL) return false;
  try {
    const res = await fetch(`${UPSTASH_REDIS_REST_URL}/get/alert:${alertId}`, {
      headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
    });
    const data = (await res.json()) as { result: string | null };
    return data.result !== null;
  } catch {
    return false;
  }
}

async function markAlerted(alertId: string) {
  if (!UPSTASH_REDIS_REST_URL) return;
  await fetch(`${UPSTASH_REDIS_REST_URL}/set/alert:${alertId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ value: '1', ex: 86400 }),
  });
}

// ── Slack formatters ────────────────────────────────────────────────

function formatIPOSlack(e: IPOEvent): object {
  const priceStr = e.price ? `$${e.price.toFixed(2)}` : 'TBD';
  const sharesStr = e.shares ? `${e.shares.toFixed(1)}M shares` : '';
  return {
    text: `IPO Alert: ${e.name || e.symbol}`,
    blocks: [{
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `*IPO -- ${e.name || e.symbol}* (\`${e.symbol}\`)`,
          `Date: *${e.date}* | Status: *${e.status.toUpperCase()}*`,
          `Offering price: *${priceStr}* ${sharesStr}`,
          `Exchange: ${e.exchange}`,
        ].join('\n'),
      },
    }],
  };
}

function formatDividendSlack(e: DividendEvent): object {
  return {
    text: `Dividend Alert: ${e.symbol}`,
    blocks: [{
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `*Dividend -- \`${e.symbol}\`*`,
          `Ex-date: *${e.exDate}* | Pay date: ${e.payDate ?? 'TBD'}`,
          `Amount: *$${e.amount.toFixed(4)} / share* (${e.frequency})`,
        ].join('\n'),
      },
    }],
  };
}

function formatMoverSlack(e: PriceMoverEvent): object {
  const sign = e.direction === 'up' ? '+' : '';
  return {
    text: `Price Mover: ${e.symbol} ${sign}${e.changePercent.toFixed(2)}%`,
    blocks: [{
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `*Price Mover -- \`${e.symbol}\`* (${e.name})`,
          `Change: *${sign}${e.changePercent.toFixed(2)}%* | Price: $${e.price.toFixed(2)}`,
          `Volume: ${(e.volume / 1_000_000).toFixed(2)}M`,
        ].join('\n'),
      },
    }],
  };
}

// ── Telegram formatter ──────────────────────────────────────────────

function formatTelegram(e: FinancialEvent): string {
  if (e.type === 'ipo') {
    const priceStr = e.price ? `$${e.price.toFixed(2)}` : 'TBD';
    return [
      `<b>IPO Alert: ${e.name || e.symbol}</b>`,
      `Symbol: <code>${e.symbol}</code>`,
      `Date: ${e.date} | Status: ${e.status.toUpperCase()}`,
      `Offering price: ${priceStr}`,
      `Exchange: ${e.exchange}`,
    ].join('\n');
  }
  if (e.type === 'dividend') {
    return [
      `<b>Dividend: ${e.symbol}</b>`,
      `Ex-date: ${e.exDate} | Pay: ${e.payDate ?? 'TBD'}`,
      `Amount: $${e.amount.toFixed(4)}/share (${e.frequency})`,
    ].join('\n');
  }
  const sign = e.direction === 'up' ? '+' : '';
  return [
    `<b>Price Mover: ${e.symbol}</b> (${e.name})`,
    `Change: ${sign}${e.changePercent.toFixed(2)}% | Price: $${e.price.toFixed(2)}`,
    `Volume: ${(e.volume / 1_000_000).toFixed(2)}M`,
  ].join('\n');
}

// ── Senders ─────────────────────────────────────────────────────────

async function sendSlack(payload: object): Promise<void> {
  if (!SLACK_WEBHOOK_URL) return;
  await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function sendTelegram(text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    }
  );
}

// ── Alert ID generators ─────────────────────────────────────────────

function getAlertId(e: FinancialEvent): string {
  const today = new Date().toISOString().split('T')[0];
  if (e.type === 'ipo') return `ipo:${e.symbol}:${e.date}`;
  if (e.type === 'dividend') return `div:${e.symbol}:${e.exDate}`;
  return `mover:${e.symbol}:${e.direction}:${today}`;
}

function buildSlackPayload(e: FinancialEvent): object {
  if (e.type === 'ipo') return formatIPOSlack(e as IPOEvent);
  if (e.type === 'dividend') return formatDividendSlack(e as DividendEvent);
  return formatMoverSlack(e as PriceMoverEvent);
}

// ── Handler ─────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const body = (await request.json()) as AlertDispatchRequest;
  if (!body || body.secret !== ALERT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const events: FinancialEvent[] = body.events ?? [];
  const results: Array<{ id: string; sent: boolean; skipped: boolean }> = [];

  for (const event of events) {
    const id = getAlertId(event);
    const alreadySent = await hasBeenAlerted(id);

    if (alreadySent) {
      results.push({ id, sent: false, skipped: true });
      continue;
    }

    await Promise.all([
      sendSlack(buildSlackPayload(event)),
      sendTelegram(formatTelegram(event)),
    ]);

    await markAlerted(id);
    results.push({ id, sent: true, skipped: false });
  }

  return NextResponse.json({ dispatched: results });
}
