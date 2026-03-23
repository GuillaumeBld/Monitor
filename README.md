# Financial Events Monitor

Real-time financial events dashboard designed for always-on TV display. Tracks IPOs, dividends, and significant price movers (2%+) with Slack and Telegram alert dispatch.

## Architecture

- **Frontend**: Next.js 14, dark theme optimized for Samsung TV (large fonts, high contrast)
- **Data**: Finnhub (IPOs, dividends) + Yahoo Finance (price movers)
- **Cache**: Upstash Redis with TTLs (5m movers, 30m dividends, 1h IPOs)
- **Alerts**: Deduplicated via Redis, dispatched to Slack and Telegram
- **Hosting**: Vercel Edge Functions + Cron

## Setup

1. Clone and install:
   ```bash
   git clone https://github.com/GuillaumeBld/Monitor.git
   cd Monitor
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your keys.

3. Run locally:
   ```bash
   npm run dev
   ```

4. Deploy to Vercel:
   ```bash
   npx vercel --prod
   ```

5. Set environment variables in Vercel Dashboard > Settings > Environment Variables.

## Environment Variables

| Variable | Required | Source |
|---|---|---|
| `FINNHUB_API_KEY` | Yes | finnhub.io (free tier) |
| `UPSTASH_REDIS_REST_URL` | Yes | console.upstash.com |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | console.upstash.com |
| `SLACK_WEBHOOK_URL` | No | Slack app Incoming Webhooks |
| `TELEGRAM_BOT_TOKEN` | No | @BotFather on Telegram |
| `TELEGRAM_CHAT_ID` | No | @userinfobot on Telegram |
| `ALERT_SECRET` | Yes | `openssl rand -hex 32` |
| `NEXT_PUBLIC_ALERT_SECRET` | Yes | Same as ALERT_SECRET |
| `CRON_SECRET` | Auto | Set by Vercel or generate |

## TV Display

Open `http://<vercel-url>` in Samsung TV browser at 10.0.0.155. The dashboard auto-refreshes every 5 minutes and fills the entire screen with large, readable cards.

## Data Refresh Intervals

- Price movers: 5 minutes
- Dividends: 30 minutes
- IPOs: 1 hour
- Alerts: Deduplicated per event per 24h window
