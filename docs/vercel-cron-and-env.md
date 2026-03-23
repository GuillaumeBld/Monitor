# Financial Events -- Integration Checklist

## 1. Env vars to add (Vercel Dashboard > Settings > Environment Variables)

| Variable | Where to get it | Notes |
|---|---|---|
| `FINNHUB_API_KEY` | finnhub.io (free tier) | Already used in codebase |
| `UPSTASH_REDIS_REST_URL` | console.upstash.com | Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | console.upstash.com | Redis auth token |
| `SLACK_WEBHOOK_URL` | Slack > Your App > Incoming Webhooks | One webhook per channel |
| `TELEGRAM_BOT_TOKEN` | @BotFather on Telegram | Create a bot, copy token |
| `TELEGRAM_CHAT_ID` | Chat with @userinfobot | Use -100xxxxx for channels |
| `ALERT_SECRET` | Generate: `openssl rand -hex 32` | Shared between API routes and client |
| `NEXT_PUBLIC_ALERT_SECRET` | Same value as ALERT_SECRET | Exposed to browser for client-side dispatch |
| `CRON_SECRET` | Auto-set by Vercel or generate | Protects cron endpoint |

## 2. Vercel Cron (configured in vercel.json)

The cron job at `/api/cron-alert-dispatch` runs every 5 minutes server-side, so alerts work even without a browser tab open.

## 3. Telegram setup (5 minutes)

1. Message @BotFather on Telegram, send /newbot, follow prompts.
2. Copy the token -> TELEGRAM_BOT_TOKEN.
3. Add the bot to your target channel or group.
4. Get the channel ID via @userinfobot (negative number starting with -100).
5. Set TELEGRAM_CHAT_ID to that value.

## 4. Slack setup (5 minutes)

1. Go to api.slack.com/apps > Create New App > From scratch.
2. Add "Incoming Webhooks" feature, enable it.
3. Click "Add New Webhook to Workspace", choose target channel.
4. Copy the webhook URL -> SLACK_WEBHOOK_URL.

## 5. Data Refresh Intervals

- Price movers: 5 minutes (Redis TTL 300s)
- Dividends: 30 minutes (Redis TTL 1800s)
- IPOs: 1 hour (Redis TTL 3600s)
- Alert dedup: 24 hours per event

## 6. Future Event Types

| Event type | Data source | Endpoint |
|---|---|---|
| Earnings surprises | Finnhub | /calendar/earnings |
| Analyst upgrades/downgrades | Finnhub | /stock/recommendation |
| Unusual options flow | Unusual Whales API (paid) | - |
| Short interest spikes | FINRA (free, weekly) | Manual scrape |
