// GET /tv - Worldmonitor-styled financial dashboard for Samsung Tizen TV browsers
// Dark terminal aesthetic, monospace font, sharp corners, pulsing status dots.
// Auto-refreshes every 5 minutes. ES5-compatible runtime JS.
// Includes YouTube live stream embed in top-left panel.

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
  yield?: number;
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
      '<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="30">'
      + '<title>WORLD MONITOR</title></head>'
      + '<body style="background:#0a0a0a;color:#ef4444;font-family:\'SF Mono\',\'Monaco\',\'Cascadia Code\',\'Fira Code\',monospace;padding:80px;font-size:18px;text-align:center">'
      + '<p style="color:#4ade80">WORLD MONITOR</p>'
      + '<p style="margin-top:20px;color:#ef4444">CONNECTION LOST // RETRYING IN 30s...</p>'
      + '</body></html>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  var ipos: IPO[] = data.ipos || [];
  var movers: Mover[] = data.movers || [];
  var dividends: Dividend[] = data.dividends || [];

  var gainers = movers.filter(function(m) { return m.direction === 'up'; }).slice(0, 15);
  var losers = movers.filter(function(m) { return m.direction === 'down'; }).slice(0, 15);

  // Build mover rows
  function moverRow(m: Mover, isGainer: boolean): string {
    var arrow = isGainer ? '&#x25B2;' : '&#x25BC;';
    var colorCls = isGainer ? 'g' : 'r';
    return '<tr>'
      + '<td class="sym">' + esc(m.symbol) + '</td>'
      + '<td class="nm">' + esc((m.name || '').substring(0, 24)) + '</td>'
      + '<td class="' + colorCls + '">' + arrow + ' ' + fmtPct(m.changePercent) + '</td>'
      + '<td>' + fmtPrice(m.price) + '</td>'
      + '<td class="dim">' + fmtVol(m.volume) + '</td>'
      + '</tr>';
  }

  function ipoRow(ipo: IPO): string {
    var statusCls = 'badge';
    if (ipo.status === 'priced') statusCls += ' badge-g';
    else if (ipo.status === 'expected') statusCls += ' badge-y';
    else if (ipo.status === 'withdrawn') statusCls += ' badge-r';
    else statusCls += ' badge-d';
    return '<tr>'
      + '<td class="sym">' + esc(ipo.symbol || '-') + '</td>'
      + '<td class="nm">' + esc((ipo.name || '').substring(0, 22)) + '</td>'
      + '<td>' + esc(ipo.date || '-') + '</td>'
      + '<td><span class="' + statusCls + '">' + esc((ipo.status || '-').toUpperCase()) + '</span></td>'
      + '</tr>';
  }

  function divRow(d: Dividend): string {
    var yieldStr = d.yield != null ? d.yield.toFixed(2) + '%' : '-';
    return '<tr>'
      + '<td class="sym">' + esc(d.symbol) + '</td>'
      + '<td>' + esc(d.exDate || '-') + '</td>'
      + '<td class="g">' + fmtPrice(d.amount) + '</td>'
      + '<td class="dim">' + esc(yieldStr) + '</td>'
      + '</tr>';
  }

  var gainersHtml = gainers.map(function(m) { return moverRow(m, true); }).join('');
  var losersHtml = losers.map(function(m) { return moverRow(m, false); }).join('');
  var iposHtml = ipos.slice(0, 12).map(ipoRow).join('');
  var divsHtml = dividends.slice(0, 12).map(divRow).join('');

  var html = '<!DOCTYPE html>\n'
    + '<html lang="en">\n<head>\n'
    + '<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + '<meta http-equiv="refresh" content="300">\n'
    + '<title>WORLD MONITOR // FINANCIAL</title>\n'
    + '<style>\n'

    // Reset & base
    + '*, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }\n'
    + 'html, body { height:100%; overflow:hidden; }\n'
    + 'body {\n'
    + '  background:#0a0a0a;\n'
    + '  color:#a0a0a0;\n'
    + '  font-family:\'SF Mono\',\'Monaco\',\'Cascadia Code\',\'Fira Code\',\'Consolas\',monospace;\n'
    + '  font-size:12px;\n'
    + '  line-height:1.5;\n'
    + '  -webkit-font-smoothing:antialiased;\n'
    + '}\n'

    // Shimmer animation
    + '@-webkit-keyframes shimmer {\n'
    + '  0% { background-position:-200px 0; }\n'
    + '  100% { background-position:200px 0; }\n'
    + '}\n'
    + '@keyframes shimmer {\n'
    + '  0% { background-position:-200px 0; }\n'
    + '  100% { background-position:200px 0; }\n'
    + '}\n'

    // Pulse animation for status dot
    + '@-webkit-keyframes pulse {\n'
    + '  0%, 100% { opacity:1; }\n'
    + '  50% { opacity:0.4; }\n'
    + '}\n'
    + '@keyframes pulse {\n'
    + '  0%, 100% { opacity:1; }\n'
    + '  50% { opacity:0.4; }\n'
    + '}\n'

    // Header bar
    + '.header {\n'
    + '  display:-webkit-flex; display:flex;\n'
    + '  -webkit-align-items:center; align-items:center;\n'
    + '  -webkit-justify-content:space-between; justify-content:space-between;\n'
    + '  height:40px;\n'
    + '  background:#141414;\n'
    + '  border-bottom:1px solid #2a2a2a;\n'
    + '  padding:0 16px;\n'
    + '}\n'
    + '.header-left {\n'
    + '  display:-webkit-flex; display:flex;\n'
    + '  -webkit-align-items:center; align-items:center;\n'
    + '  gap:10px;\n'
    + '}\n'
    + '.header-title {\n'
    + '  color:#e0e0e0;\n'
    + '  font-size:13px;\n'
    + '  font-weight:600;\n'
    + '  letter-spacing:2px;\n'
    + '}\n'
    + '.status-dot {\n'
    + '  display:inline-block;\n'
    + '  width:7px; height:7px;\n'
    + '  border-radius:50%;\n'
    + '  background:#4ade80;\n'
    + '  box-shadow:0 0 6px rgba(74,222,128,0.5);\n'
    + '  -webkit-animation:pulse 2s ease-in-out infinite;\n'
    + '  animation:pulse 2s ease-in-out infinite;\n'
    + '}\n'
    + '.live-label {\n'
    + '  color:#4ade80;\n'
    + '  font-size:10px;\n'
    + '  font-weight:600;\n'
    + '  letter-spacing:1.5px;\n'
    + '}\n'
    + '.header-right {\n'
    + '  display:-webkit-flex; display:flex;\n'
    + '  -webkit-align-items:center; align-items:center;\n'
    + '  gap:12px;\n'
    + '}\n'
    + '.header-time {\n'
    + '  color:#707070;\n'
    + '  font-size:11px;\n'
    + '}\n'
    + '.header-badge {\n'
    + '  background:#1a1a2e;\n'
    + '  color:#818cf8;\n'
    + '  font-size:9px;\n'
    + '  font-weight:600;\n'
    + '  letter-spacing:1.5px;\n'
    + '  padding:3px 8px;\n'
    + '  border:1px solid #2a2a4a;\n'
    + '}\n'

    // Main grid: 2 rows
    + '.main-grid {\n'
    + '  display:-webkit-flex; display:flex;\n'
    + '  -webkit-flex-direction:column; flex-direction:column;\n'
    + '  height:calc(100vh - 40px);\n'
    + '  padding:8px;\n'
    + '  gap:8px;\n'
    + '}\n'

    // Top row: YouTube (60%) + Gainers (40%)
    + '.top-row {\n'
    + '  display:-webkit-flex; display:flex;\n'
    + '  gap:8px;\n'
    + '  height:55%;\n'
    + '  -webkit-flex-shrink:0; flex-shrink:0;\n'
    + '}\n'
    + '.top-row .panel-yt {\n'
    + '  -webkit-flex:0 0 60%; flex:0 0 60%;\n'
    + '  max-width:60%;\n'
    + '}\n'
    + '.top-row .panel-side {\n'
    + '  -webkit-flex:1 1 40%; flex:1 1 40%;\n'
    + '}\n'

    // Bottom row: 3 equal panels
    + '.bottom-row {\n'
    + '  display:-webkit-flex; display:flex;\n'
    + '  gap:8px;\n'
    + '  -webkit-flex:1; flex:1;\n'
    + '  min-height:0;\n'
    + '}\n'
    + '.bottom-row .panel {\n'
    + '  -webkit-flex:1 1 0; flex:1 1 0;\n'
    + '  min-width:0;\n'
    + '}\n'

    // Panel base
    + '.panel {\n'
    + '  background:#141414;\n'
    + '  border:1px solid #2a2a2a;\n'
    + '  display:-webkit-flex; display:flex;\n'
    + '  -webkit-flex-direction:column; flex-direction:column;\n'
    + '  overflow:hidden;\n'
    + '}\n'
    + '.panel-yt {\n'
    + '  background:#141414;\n'
    + '  border:1px solid #2a2a2a;\n'
    + '  display:-webkit-flex; display:flex;\n'
    + '  -webkit-flex-direction:column; flex-direction:column;\n'
    + '  overflow:hidden;\n'
    + '}\n'
    + '.panel-side {\n'
    + '  background:#141414;\n'
    + '  border:1px solid #2a2a2a;\n'
    + '  display:-webkit-flex; display:flex;\n'
    + '  -webkit-flex-direction:column; flex-direction:column;\n'
    + '  overflow:hidden;\n'
    + '}\n'
    + '.panel-header {\n'
    + '  display:-webkit-flex; display:flex;\n'
    + '  -webkit-align-items:center; align-items:center;\n'
    + '  -webkit-justify-content:space-between; justify-content:space-between;\n'
    + '  height:30px;\n'
    + '  padding:0 12px;\n'
    + '  background:#1a1a1a;\n'
    + '  border-bottom:1px solid #2a2a2a;\n'
    + '  -webkit-flex-shrink:0; flex-shrink:0;\n'
    + '}\n'
    + '.panel-label {\n'
    + '  font-size:10px;\n'
    + '  font-weight:600;\n'
    + '  letter-spacing:2px;\n'
    + '  color:#707070;\n'
    + '}\n'
    + '.panel-count {\n'
    + '  font-size:9px;\n'
    + '  color:#505050;\n'
    + '}\n'
    + '.panel-body {\n'
    + '  -webkit-flex:1; flex:1;\n'
    + '  overflow-y:auto;\n'
    + '  padding:0;\n'
    + '}\n'

    // YouTube iframe container
    + '.yt-container {\n'
    + '  -webkit-flex:1; flex:1;\n'
    + '  position:relative;\n'
    + '  background:#000;\n'
    + '}\n'
    + '.yt-container iframe {\n'
    + '  position:absolute;\n'
    + '  top:0; left:0;\n'
    + '  width:100%; height:100%;\n'
    + '  border:0;\n'
    + '}\n'

    // Scrollbar styling
    + '.panel-body::-webkit-scrollbar { width:4px; }\n'
    + '.panel-body::-webkit-scrollbar-track { background:#141414; }\n'
    + '.panel-body::-webkit-scrollbar-thumb { background:#2a2a2a; }\n'

    // Table
    + 'table { width:100%; border-collapse:collapse; }\n'
    + 'th {\n'
    + '  text-align:left;\n'
    + '  color:#505050;\n'
    + '  font-weight:500;\n'
    + '  font-size:9px;\n'
    + '  text-transform:uppercase;\n'
    + '  letter-spacing:1px;\n'
    + '  padding:6px 10px;\n'
    + '  border-bottom:1px solid #2a2a2a;\n'
    + '  position:-webkit-sticky; position:sticky;\n'
    + '  top:0;\n'
    + '  background:#141414;\n'
    + '  z-index:1;\n'
    + '}\n'
    + 'td {\n'
    + '  padding:5px 10px;\n'
    + '  border-bottom:1px solid #1a1a1a;\n'
    + '  white-space:nowrap;\n'
    + '  overflow:hidden;\n'
    + '  text-overflow:ellipsis;\n'
    + '  max-width:200px;\n'
    + '  font-size:11px;\n'
    + '}\n'
    + 'tr:hover { background:#1a1a1a; }\n'

    // Colors
    + '.sym { color:#4ade80; font-weight:600; }\n'
    + '.nm { color:#606060; font-size:10px; }\n'
    + '.g { color:#4ade80; font-weight:600; }\n'
    + '.r { color:#ef4444; font-weight:600; }\n'
    + '.dim { color:#505050; }\n'

    // Badges
    + '.badge {\n'
    + '  display:inline-block;\n'
    + '  font-size:8px;\n'
    + '  font-weight:600;\n'
    + '  letter-spacing:1px;\n'
    + '  padding:2px 6px;\n'
    + '  border:1px solid;\n'
    + '}\n'
    + '.badge-g { color:#4ade80; border-color:#0f5040; background:rgba(74,222,128,0.08); }\n'
    + '.badge-y { color:#fbbf24; border-color:#6b5b00; background:rgba(251,191,36,0.08); }\n'
    + '.badge-r { color:#ef4444; border-color:#5c1a1a; background:rgba(239,68,68,0.08); }\n'
    + '.badge-d { color:#505050; border-color:#2a2a2a; background:rgba(80,80,80,0.05); }\n'

    + '</style>\n</head>\n<body>\n\n'

    // Header bar
    + '<div class="header">\n'
    + '  <div class="header-left">\n'
    + '    <span class="header-title">WORLD MONITOR</span>\n'
    + '    <span class="status-dot"></span>\n'
    + '    <span class="live-label">LIVE</span>\n'
    + '  </div>\n'
    + '  <div class="header-right">\n'
    + '    <span class="header-time" id="clock">--:--:--</span>\n'
    + '    <span class="header-badge">FINANCIAL</span>\n'
    + '  </div>\n'
    + '</div>\n\n'

    // Main grid
    + '<div class="main-grid">\n\n'

    // === TOP ROW ===
    + '<div class="top-row">\n\n'

    // YouTube Live Stream
    + '<div class="panel-yt">\n'
    + '  <div class="panel-header">\n'
    + '    <span class="panel-label" style="color:#ef4444"><span class="status-dot" style="background:#ef4444;box-shadow:0 0 6px rgba(239,68,68,0.5);margin-right:6px;vertical-align:middle"></span>LIVE STREAM</span>\n'
    + '    <span class="panel-count">YOUTUBE</span>\n'
    + '  </div>\n'
    + '  <div class="yt-container">\n'
    + '    <iframe\n'
    + '      src="https://www.youtube-nocookie.com/embed/iEpJwprxDdk?autoplay=1&mute=0&controls=1&rel=0&modestbranding=1&playsinline=1"\n'
    + '      allow="autoplay; encrypted-media"\n'
    + '      allowfullscreen\n'
    + '    ></iframe>\n'
    + '  </div>\n'
    + '</div>\n\n'

    // TOP GAINERS (right side of top row)
    + '<div class="panel-side">\n'
    + '  <div class="panel-header">\n'
    + '    <span class="panel-label" style="color:#4ade80">TOP GAINERS</span>\n'
    + '    <span class="panel-count">' + gainers.length + ' ITEMS</span>\n'
    + '  </div>\n'
    + '  <div class="panel-body">\n'
    + '    <table>\n'
    + '      <tr><th>SYM</th><th>NAME</th><th>CHANGE</th><th>PRICE</th><th>VOL</th></tr>\n'
    + gainersHtml
    + '    </table>\n'
    + '  </div>\n'
    + '</div>\n\n'

    + '</div>\n\n'

    // === BOTTOM ROW ===
    + '<div class="bottom-row">\n\n'

    // TOP LOSERS
    + '<div class="panel">\n'
    + '  <div class="panel-header">\n'
    + '    <span class="panel-label" style="color:#ef4444">TOP LOSERS</span>\n'
    + '    <span class="panel-count">' + losers.length + ' ITEMS</span>\n'
    + '  </div>\n'
    + '  <div class="panel-body">\n'
    + '    <table>\n'
    + '      <tr><th>SYM</th><th>NAME</th><th>CHANGE</th><th>PRICE</th><th>VOL</th></tr>\n'
    + losersHtml
    + '    </table>\n'
    + '  </div>\n'
    + '</div>\n\n'

    // IPO CALENDAR
    + '<div class="panel">\n'
    + '  <div class="panel-header">\n'
    + '    <span class="panel-label" style="color:#818cf8">IPO CALENDAR</span>\n'
    + '    <span class="panel-count">' + Math.min(ipos.length, 12) + ' ITEMS</span>\n'
    + '  </div>\n'
    + '  <div class="panel-body">\n'
    + '    <table>\n'
    + '      <tr><th>SYM</th><th>COMPANY</th><th>DATE</th><th>STATUS</th></tr>\n'
    + iposHtml
    + '    </table>\n'
    + '  </div>\n'
    + '</div>\n\n'

    // DIVIDENDS
    + '<div class="panel">\n'
    + '  <div class="panel-header">\n'
    + '    <span class="panel-label" style="color:#fbbf24">DIVIDENDS</span>\n'
    + '    <span class="panel-count">' + Math.min(dividends.length, 12) + ' ITEMS</span>\n'
    + '  </div>\n'
    + '  <div class="panel-body">\n'
    + '    <table>\n'
    + '      <tr><th>SYM</th><th>EX-DATE</th><th>AMOUNT</th><th>YIELD</th></tr>\n'
    + divsHtml
    + '    </table>\n'
    + '  </div>\n'
    + '</div>\n\n'

    + '</div>\n\n'

    + '</div>\n\n'

    // ES5-compatible clock + auto-refresh
    + '<script>\n'
    + '(function(){\n'
    + '  function updateClock() {\n'
    + '    var now = new Date();\n'
    + '    var h = now.getHours();\n'
    + '    var m = now.getMinutes();\n'
    + '    var s = now.getSeconds();\n'
    + '    var hh = h < 10 ? "0" + h : "" + h;\n'
    + '    var mm = m < 10 ? "0" + m : "" + m;\n'
    + '    var ss = s < 10 ? "0" + s : "" + s;\n'
    + '    var el = document.getElementById("clock");\n'
    + '    if (el) { el.textContent = hh + ":" + mm + ":" + ss; }\n'
    + '  }\n'
    + '  updateClock();\n'
    + '  setInterval(updateClock, 1000);\n'
    + '  setTimeout(function(){ window.location.reload(); }, 300000);\n'
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
