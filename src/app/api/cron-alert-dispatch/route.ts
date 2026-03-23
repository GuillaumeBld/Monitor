// API Route: /api/cron-alert-dispatch
// Vercel Cron job: fetches financial events and dispatches alerts server-side.
// Schedule: every 5 minutes (configured in vercel.json)
// No browser tab required.

import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: Request) {
  // Verify cron auth header
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  try {
    const eventsRes = await fetch(`${base}/api/financial-events`);
    const data = await eventsRes.json();

    const allEvents = [
      ...(data.ipos ?? []),
      ...(data.dividends ?? []),
      ...(data.movers ?? []),
    ];

    if (allEvents.length === 0) {
      return NextResponse.json({ ok: true, processed: 0 });
    }

    await fetch(`${base}/api/alert-dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: allEvents,
        secret: process.env.ALERT_SECRET,
      }),
    });

    return NextResponse.json({ ok: true, processed: allEvents.length });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
