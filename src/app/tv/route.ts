// GET /tv - Lightweight HTML dashboard for Samsung Tizen TV browsers (2019+)
// Returns raw HTML with no React hydration, no modern JS syntax.
// Auto-refreshes every 5 minutes. Dark theme, large fonts for TV viewing.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

function fmtCap(n: number | null | undefined): string {
  if (n == null) return '-';
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(0) + 'M';
  return '$' + String(n);
}

function fmtPrice(n: number | null | undefined): string {
  if (n == null) return '-';
  return '$' + n.toFixed(2);
}

interface Mover {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  volume: number;
  marketCap: number | null;
  direction: string;
}

interface IPO {
  symbol: string;
  name: string;
  date: string;
  price: number | null;
  exchange: string;
  status: string;
}

interface Dividend {
  symbol: string;
  name: string;
  exDate: string;
  amount: number;
  frequency: string;
}

export async function GET() {
  var data: any = null;
  try {
    var res = await fetch('http://localhost:3850/api/financial-events', {
      cache: 'no-store',
    });
    if (res.ok) {
      data = await res.json();
    }
  } catch (e) {
    // fall through
  }

  if (!data) {
    return new Response(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="30">' +
      '<title>Monitor - TV</title></head>' +
      '<body style="background:#020617;color:#ef4444;font-family:sans-serif;padding:80px;font-size:32px;text-align:center">' +
      '<p>Failed to load data. Retrying in 30s...</p></body></html>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  var ipos: IPO[] = data.ipos || [];
  var movers: Mover[] = data.movers || [];
  var dividends: Dividend[] = data.dividends || [];
  var lastUpdated = data.lastUpdated
    ? new Date(data.lastUpdated).toLocaleString('en-US', { timeZone: 'America/New_York' })
    : 'Unknown';

  var gainers = movers.filter(function(m) { return m.direction === 'up'; }).slice(0, 15);
  var losers = movers.filter(function(m) { return m.direction === 'down'; }).slice(0, 15);

  // Build mover rows
  function moverRow(m: Mover): string {
    var cls = m.direction === 'up' ? 'up' : 'down';
    return '<tr>'
      + '<td><span class="sym">' + esc(m.symbol) + '</span><br><span class="nm">' + esc((m.name || '').substring(0, 28)) + '</span></td>'
      + '<td>' + fmtPrice(m.price) + '</td>'
      + '<td class="' + cls + '">' + fmtPct(m.changePercent) + '</td>'
      + '<td class="vol">' + fmtVol(m.volume) + '</td>'
      + '<td class="cap">' + fmtCap(m.marketCap) + '</td>'
      + '</tr>';
  }

  function ipoRow(ipo: IPO): string {
    var sc = 'st-' + (ipo.status || 'filed');
    return '<tr>'
      + '<td><span class="sym">' + esc(ipo.symbol || '-') + '</span><br><span class="nm">' + esc((ipo.name || '').substring(0, 28)) + '</span></td>'
      + '<td>' + esc(ipo.date || '-') + '</td>'
      + '<td>' + (ipo.price != null ? fmtPrice(ipo.price) : '-') + '</td>'
      + '<td class="vol">' + esc((ipo.exchange || '-').substring(0, 18)) + '</td>'
      + '<td class="' + sc + '">' + esc(ipo.status || '-') + '</td>'
      + '</tr>';
  }

  var gainersHtml = gainers.map(moverRow).join('');
  var losersHtml = losers.map(moverRow).join('');
  var iposHtml = ipos.slice(0, 15).map(ipoRow).join('');

  var divsHtml = '';
  if (dividends.length > 0) {
    divsHtml = '<div class="sec">'
      + '<div class="stl" style="color:#fbbf24">&#x1F4B0; Dividends</div>'
      + '<table><tr><th>Symbol</th><th>Ex-Date</th><th>Amount</th><th>Freq</th></tr>';
    for (var i = 0; i < Math.min(dividends.length, 15); i++) {
      var d = dividends[i];
      divsHtml += '<tr>'
        + '<td><span class="sym">' + esc(d.symbol) + '</span><br><span class="nm">' + esc((d.name || '').substring(0, 28)) + '</span></td>'
        + '<td>' + esc(d.exDate || '-') + '</td>'
        + '<td>' + fmtPrice(d.amount) + '</td>'
        + '<td class="vol">' + esc(d.frequency || '-') + '</td>'
        + '</tr>';
    }
    divsHtml += '</table></div>';
  }

  var html = '<!DOCTYPE html>\n'
    + '<html lang="en">\n<head>\n'
    + '<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + '<meta http-equiv="refresh" content="300">\n'
    + '<title>Financial Monitor - TV</title>\n'
    + '<style>\n'
    + '* { margin:0; padding:0; box-sizing:border-box; }\n'
    + 'body { background:#020617; color:#e2e8f0; font-family:-apple-system,Helvetica,Arial,sans-serif; padding:20px 28px; overflow-x:hidden; }\n'
    + '.hdr { display:-webkit-flex; display:flex; -webkit-justify-content:space-between; justify-content:space-between; -webkit-align-items:center; align-items:center; padding:10px 0 14px; border-bottom:2px solid #1e293b; margin-bottom:16px; }\n'
    + '.htl { font-size:24px; font-weight:700; color:#f1f5f9; }\n'
    + '.htm { font-size:13px; color:#64748b; }\n'
    + '.dot { display:inline-block; width:8px; height:8px; border-radius:50%; background:#22c55e; margin-right:6px; vertical-align:middle; }\n'
    + '.grid { display:-webkit-flex; display:flex; -webkit-flex-wrap:wrap; flex-wrap:wrap; gap:16px; }\n'
    + '.sec { -webkit-flex:1 1 300px; flex:1 1 300px; min-width:260px; background:#0f172a; border:1px solid #1e293b; border-radius:8px; padding:14px; }\n'
    + '.stl { font-size:15px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px; padding-bottom:6px; border-bottom:1px solid #1e293b; }\n'
    + 'table { width:100%; border-collapse:collapse; font-size:13px; }\n'
    + 'th { text-align:left; color:#64748b; font-weight:500; font-size:10px; text-transform:uppercase; letter-spacing:.5px; padding:3px 6px 6px; border-bottom:1px solid #1e293b; }\n'
    + 'td { padding:5px 6px; border-bottom:1px solid rgba(15,23,42,.5); vertical-align:top; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px; }\n'
    + 'tr:nth-child(even) { background:rgba(30,41,59,.3); }\n'
    + '.sym { color:#60a5fa; font-weight:600; }\n'
    + '.nm { color:#94a3b8; font-size:11px; }\n'
    + '.up { color:#22c55e; font-weight:600; }\n'
    + '.down { color:#ef4444; font-weight:600; }\n'
    + '.vol { color:#64748b; font-size:12px; }\n'
    + '.cap { color:#475569; font-size:12px; }\n'
    + '.st-expected { color:#f59e0b; }\n'
    + '.st-priced { color:#22c55e; }\n'
    + '.st-filed { color:#64748b; }\n'
    + '.st-withdrawn { color:#ef4444; text-decoration:line-through; }\n'
    + '.ft { margin-top:16px; text-align:center; color:#334155; font-size:11px; }\n'
    + '</style>\n</head>\n<body>\n\n'

    + '<div class="hdr">\n'
    + '  <div><span style="font-size:22px">&#x1F4CA;</span> <span class="htl">Financial Events Monitor</span></div>\n'
    + '  <div class="htm"><span class="dot"></span>Updated: ' + esc(lastUpdated) + ' ET</div>\n'
    + '</div>\n\n'

    + '<div class="grid">\n\n'

    // Gainers
    + '<div class="sec">\n'
    + '  <div class="stl" style="color:#22c55e">&#x1F4C8; Top Gainers</div>\n'
    + '  <table><tr><th>Symbol</th><th>Price</th><th>Change</th><th>Vol</th><th>MCap</th></tr>\n'
    + gainersHtml
    + '  </table>\n</div>\n\n'

    // Losers
    + '<div class="sec">\n'
    + '  <div class="stl" style="color:#ef4444">&#x1F4C9; Top Losers</div>\n'
    + '  <table><tr><th>Symbol</th><th>Price</th><th>Change</th><th>Vol</th><th>MCap</th></tr>\n'
    + losersHtml
    + '  </table>\n</div>\n\n'

    // IPOs
    + '<div class="sec">\n'
    + '  <div class="stl" style="color:#a78bfa">&#x1F680; IPO Calendar</div>\n'
    + '  <table><tr><th>Symbol</th><th>Date</th><th>Price</th><th>Exchange</th><th>Status</th></tr>\n'
    + iposHtml
    + '  </table>\n</div>\n\n'

    // Dividends (if any)
    + divsHtml

    + '</div>\n\n'

    + '<div class="ft">Auto-refresh 5 min &bull; TV Mode &bull; monitor.qualiaai.fr/tv</div>\n\n'

    + '<script>\n'
    + '(function(){\n'
    + '  try {\n'
    + '    setTimeout(function(){ window.location.reload(); }, 300000);\n'
    + '  } catch(e) {}\n'
    + '})();\n'
    + '</script>\n\n'

    + '</body>\n</html>';

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
