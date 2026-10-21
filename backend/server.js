const express = require('express');
const cors    = require('cors');
const http    = require('http');
const https   = require('https');
const path    = require('path');
const { URLSearchParams } = require('url');

const app  = express();
const PORT = process.env.PORT || 3002;
const INSTAT_BASE = process.env.INSTAT_BASE || 'https://service.instatfootball.com/feed.php';

// Keep-alive agent reuses TCP connections across batch requests.
const agent = new https.Agent({ keepAlive: true, maxSockets: 50 });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Non-JSON bodies from InStat's load balancer that mean "backend momentarily
// unreachable" — safe to retry. "no healthy upstream" is the classic Envoy one.
const TRANSIENT_BODY_RE = /no healthy upstream|upstream connect error|service unavailable|bad gateway|gateway time-?out|try again/i;

// One raw GET (http or https by URL scheme). Resolves (never rejects) to { status, raw, error }.
function fetchOnce(url, timeoutMs) {
  const client = url.startsWith('http://') ? http : https;
  const opts = client === https ? { agent } : {};
  return new Promise((resolve) => {
    const r = client.get(url, opts, (apiRes) => {
      let raw = '';
      apiRes.on('data', chunk => raw += chunk);
      apiRes.on('end', () => resolve({ status: apiRes.statusCode, raw }));
    });
    r.on('error', err => resolve({ status: 0, raw: '', error: err.message }));
    r.setTimeout(timeoutMs, () => { r.destroy(); resolve({ status: 0, raw: '', error: 'timeout' }); });
  });
}

// Fetch + parse JSON with automatic retry on transient upstream failures.
// Returns one of:
//   { ok: true,  json }                     — parsed successfully
//   { ok: false, transient: true,  raw }     — InStat/gateway down or too slow (give up)
//   { ok: false, transient: false, raw }     — a real, non-retryable bad response (e.g. "Invalid key2")
//
// Default timeout is generous: aggregated feeds (tpl=226) for large leagues like NCAA D1
// return every goalie in one big payload and can legitimately take 20s+.
async function fetchInstatJson(url, { retries = 3, timeout = 45000 } = {}) {
  let last = { raw: '' };
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(Math.min(2000, 300 * 2 ** (attempt - 1))); // 300ms, 600ms, 1200ms…
    const { status, raw, error } = await fetchOnce(url, timeout);
    last = { status, raw, error };

    // A timeout means the response didn't arrive in `timeout` ms. Retrying with the same
    // cap won't help a genuinely-slow-but-valid response — it just doubles the wait — so stop.
    if (error === 'timeout') return { ok: false, transient: true, raw: 'InStat request timed out' };
    if (error) continue;              // other network error (reset, hang-up) → worth retrying
    if (status >= 500) continue;      // upstream 5xx → retry

    try {
      return { ok: true, json: JSON.parse(raw) };
    } catch {
      if (TRANSIENT_BODY_RE.test(raw)) continue;             // gateway blip → retry
      return { ok: false, transient: false, raw };           // genuine bad response → stop
    }
  }
  return { ok: false, transient: true, raw: last.raw || last.error || '' };
}

const DIST = path.join(__dirname, '../frontend/dist');
const isProd = require('fs').existsSync(path.join(DIST, 'index.html'));

// Dev: restrict to Vite dev server. Prod: allow any origin so the standalone vibe/index.html can call the API.
if (!isProd) app.use(cors({ origin: 'http://localhost:5176' }));
else app.use(cors());

app.use(express.json());

// ─── Serve built frontend ────────────────────────────────────────────────────
if (isProd) {
  app.use(express.static(DIST));
}

// ─── Single-player proxy ─────────────────────────────────────────────────────
app.get('/api/instat', async (req, res) => {
  const { id, key, ...params } = req.query;
  if (!id || !key) return res.status(401).json({ error: 'Missing credentials.' });

  const qs  = new URLSearchParams({ id, key, format: 'json', lang_id: '1', ...params });
  const result = await fetchInstatJson(`${INSTAT_BASE}?${qs.toString()}`);

  if (result.ok) return res.json(result.json);
  if (result.transient) {
    return res.status(503).json({
      error: 'InStat is temporarily unavailable',
      raw: String(result.raw).slice(0, 1000),
      transient: true,
    });
  }
  return res.status(502).json({ error: 'Invalid JSON from InStat', raw: String(result.raw).slice(0, 1000) });
});

// ─── Batch player-stats proxy ─────────────────────────────────────────────────
app.post('/api/instat/batch', async (req, res) => {
  const { id, key, player_ids, tournament_id, season_id } = req.body ?? {};
  if (!id || !key) return res.status(401).json({ error: 'Missing credentials.' });
  if (!Array.isArray(player_ids) || player_ids.length === 0)
    return res.status(400).json({ error: 'player_ids must be a non-empty array.' });

  const results = {};

  await Promise.all(player_ids.map(async (pid) => {
    const qs = new URLSearchParams({
      id, key, format: 'json', lang_id: '1',
      tpl: '21', player_id: pid, tournament_id, season_id,
    });
    const r = await fetchInstatJson(`${INSTAT_BASE}?${qs.toString()}`, { retries: 2, timeout: 10000 });
    if (r.ok) results[pid] = r.json; // transient/failed players are simply omitted (retried already)
  }));

  res.json(results);
});

// ─── Fallback: send index.html for any non-API route (client-side routing) ───
if (isProd) {
  app.get('*', (req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

app.listen(PORT, () => console.log(`USA Hockey Watchlist running on http://localhost:${PORT}`));
