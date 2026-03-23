// /tv - Lightweight dashboard for Samsung Tizen TV browsers (2019+)
// No React hydration, no modern JS syntax, fully server-rendered
// Auto-refreshes every 5 minutes via meta refresh + JS fallback

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function getData() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3850';
  try {
    const res = await fetch(base + '/api/financial-events', {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    return null;
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtPct(n: number): string {
  var sign = n >= 0 ? '+' : '';
  return sign + n.toFixed(2) + '%';
}

function fmtVol(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

function fmtCap(n: number | null): string {
  if (n === null || n === undefined) return '-';
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(0) + 'M';
  return '$' + String(n);
}

function fmtPrice(n: number | null): string {
  if (n === null || n === undefined) return '-';
  return '$' + n.toFixed(2);
}

export default async function TVPage() {
  const data = await getData();

  if (!data) {
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta httpEquiv="refresh" content="30" />
          <title>Financial Monitor - TV</title>
        </head>
        <body style={{ background: '#020617', color: '#ef4444', fontFamily: 'sans-serif', padding: '80px', fontSize: '32px', textAlign: 'center' as const }}>
          <p>Failed to load data. Retrying in 30s...</p>
        </body>
      </html>
    );
  }

  const ipos = data.ipos || [];
  const movers = data.movers || [];
  const dividends = data.dividends || [];
  const lastUpdated = data.lastUpdated ? new Date(data.lastUpdated).toLocaleString('en-US', { timeZone: 'America/New_York' }) : 'Unknown';

  const gainers = movers.filter(function(m: any) { return m.direction === 'up'; }).slice(0, 15);
  const losers = movers.filter(function(m: any) { return m.direction === 'down'; }).slice(0, 15);

  // Build raw HTML string for Tizen compatibility
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="300">
<title>Financial Monitor - TV</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  background: #020617;
  color: #e2e8f0;
  font-family: -apple-system, Helvetica, Arial, sans-serif;
  padding: 24px 32px;
  overflow-x: hidden;
}
.header {
  display: -webkit-flex;
  display: flex;
  -webkit-justify-content: space-between;
  justify-content: space-between;
  -webkit-align-items: center;
  align-items: center;
  padding: 12px 0 16px;
  border-bottom: 2px solid #1e293b;
  margin-bottom: 20px;
}
.header-title {
  font-size: 26px;
  font-weight: 700;
  color: #f1f5f9;
}
.header-time {
  font-size: 14px;
  color: #64748b;
}
.live-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  margin-right: 8px;
  vertical-align: middle;
}
.sections {
  display: -webkit-flex;
  display: flex;
  -webkit-flex-wrap: wrap;
  flex-wrap: wrap;
  gap: 20px;
}
.section {
  -webkit-flex: 1 1 300px;
  flex: 1 1 300px;
  min-width: 280px;
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 8px;
  padding: 16px;
}
.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #1e293b;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
th {
  text-align: left;
  color: #64748b;
  font-weight: 500;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 4px 8px 8px;
  border-bottom: 1px solid #1e293b;
}
td {
  padding: 6px 8px;
  border-bottom: 1px solid #0f172a;
  vertical-align: top;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}
tr:nth-child(even) { background: rgba(30, 41, 59, 0.3); }
.sym { color: #60a5fa; font-weight: 600; }
.up { color: #22c55e; font-weight: 600; }
.down { color: #ef4444; font-weight: 600; }
.status-expected { color: #f59e0b; }
.status-priced { color: #22c55e; }
.status-filed { color: #64748b; }
.status-withdrawn { color: #ef4444; text-decoration: line-through; }
.name-cell { color: #94a3b8; font-size: 12px; }
.vol { color: #64748b; font-size: 12px; }
.cap { color: #475569; font-size: 12px; }
.footer {
  margin-top: 20px;
  text-align: center;
  color: #334155;
  font-size: 12px;
}
</style>
</head>
<body>

<div class="header">
  <div>
    <span style="font-size:24px">&#x1F4CA;</span>
    <span class="header-title">Financial Events Monitor</span>
  </div>
  <div class="header-time">
    <span class="live-dot"></span>
    Updated: ${esc(lastUpdated)} ET
  </div>
</div>

<div class="sections">

<!-- GAINERS -->
<div class="section">
  <div class="section-title" style="color:#22c55e">&#x1F4C8; Top Gainers</div>
  <table>
    <tr><th>Symbol</th><th>Price</th><th>Change</th><th>Vol</th><th>MCap</th></tr>
    ${gainers.map(function(m: any) {
      return '<tr>'
        + '<td><span class="sym">' + esc(m.symbol) + '</span><br><span class="name-cell">' + esc((m.name || '').substring(0, 25)) + '</span></td>'
        + '<td>' + fmtPrice(m.price) + '</td>'
        + '<td class="up">' + fmtPct(m.changePercent) + '</td>'
        + '<td class="vol">' + fmtVol(m.volume) + '</td>'
        + '<td class="cap">' + fmtCap(m.marketCap) + '</td>'
        + '</tr>';
    }).join('')}
  </table>
</div>

<!-- LOSERS -->
<div class="section">
  <div class="section-title" style="color:#ef4444">&#x1F4C9; Top Losers</div>
  <table>
    <tr><th>Symbol</th><th>Price</th><th>Change</th><th>Vol</th><th>MCap</th></tr>
    ${losers.map(function(m: any) {
      return '<tr>'
        + '<td><span class="sym">' + esc(m.symbol) + '</span><br><span class="name-cell">' + esc((m.name || '').substring(0, 25)) + '</span></td>'
        + '<td>' + fmtPrice(m.price) + '</td>'
        + '<td class="down">' + fmtPct(m.changePercent) + '</td>'
        + '<td class="vol">' + fmtVol(m.volume) + '</td>'
        + '<td class="cap">' + fmtCap(m.marketCap) + '</td>'
        + '</tr>';
    }).join('')}
  </table>
</div>

<!-- IPOs -->
<div class="section">
  <div class="section-title" style="color:#a78bfa">&#x1F680; IPO Calendar</div>
  <table>
    <tr><th>Symbol</th><th>Date</th><th>Price</th><th>Exchange</th><th>Status</th></tr>
    ${ipos.slice(0, 15).map(function(ipo: any) {
      var statusClass = 'status-' + (ipo.status || 'filed');
      return '<tr>'
        + '<td><span class="sym">' + esc(ipo.symbol || '-') + '</span><br><span class="name-cell">' + esc((ipo.name || '').substring(0, 25)) + '</span></td>'
        + '<td>' + esc(ipo.date || '-') + '</td>'
        + '<td>' + (ipo.price ? fmtPrice(ipo.price) : '-') + '</td>'
        + '<td class="vol">' + esc((ipo.exchange || '-').substring(0, 15)) + '</td>'
        + '<td class="' + statusClass + '">' + esc(ipo.status || '-') + '</td>'
        + '</tr>';
    }).join('')}
  </table>
</div>

${dividends.length > 0 ? '<div class="section">'
  + '<div class="section-title" style="color:#fbbf24">&#x1F4B0; Dividends</div>'
  + '<table>'
  + '<tr><th>Symbol</th><th>Ex-Date</th><th>Amount</th><th>Freq</th></tr>'
  + dividends.slice(0, 15).map(function(d: any) {
      return '<tr>'
        + '<td><span class="sym">' + esc(d.symbol) + '</span><br><span class="name-cell">' + esc((d.name || '').substring(0, 25)) + '</span></td>'
        + '<td>' + esc(d.exDate || '-') + '</td>'
        + '<td>' + fmtPrice(d.amount) + '</td>'
        + '<td class="vol">' + esc(d.frequency || '-') + '</td>'
        + '</tr>';
    }).join('')
  + '</table></div>'
  : ''}

</div>

<div class="footer">
  Auto-refresh every 5 min &bull; TV Mode &bull; monitor.qualiaai.fr/tv
</div>

<script>
// Fallback auto-refresh for browsers that ignore meta refresh
(function() {
  try {
    setTimeout(function() {
      window.location.reload();
    }, 300000);
  } catch(e) {}
})();
</script>

</body>
</html>`;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
      </head>
      <body suppressHydrationWarning dangerouslySetInnerHTML={{ __html: '' }}>
      </body>
    </html>
  );
}
`;

  // We need to bypass React rendering entirely for Tizen.
  // Use a Route Handler approach instead.
