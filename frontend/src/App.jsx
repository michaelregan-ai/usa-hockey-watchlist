import { useState, useEffect, useRef } from 'react';
import CredentialsBadge from './components/CredentialsBadge.jsx';
import CredentialsModal from './components/CredentialsModal.jsx';
import AddPlayer from './components/AddPlayer.jsx';
import WatchlistTable, { SKATER_COLS, GOALIE_COLS } from './components/WatchlistTable.jsx';
import { fetchSeasons } from './api.js';
import { loadLeagueSkaters, loadLeagueGoalies } from './leagueLoader.js';
import { getPlayerId, timeAgo } from './playerUtils.js';
import { useWatchlist, clearAll, importWatchlist } from './watchlist.js';
import { TOURNAMENTS } from './tournaments.js';

const CREDS_KEY = 'usah_watchlist_creds';

const ALLOWED_SEASONS = new Set([
  '2018-2019','2019-2020','2020-2021','2021-2022',
  '2022-2023','2023-2024','2024-2025','2025-2026','2026-2027',
]);

function deepFindArray(node, depth = 0) {
  if (depth > 4) return null;
  if (Array.isArray(node) && node.length > 0) return node;
  if (node && typeof node === 'object') {
    for (const v of Object.values(node)) {
      const found = deepFindArray(v, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

const groupKey = (e) => `${e.isGoalie ? 'g' : 's'}:${e.tournamentId}_${e.seasonId}`;

// Pull season-aggregate stats for every league/season on the watchlist (IndexedDB-cached),
// returning { [playerId]: norm } plus loading/error state.
function useWatchlistStats(credentials, items) {
  const [norms, setNorms]     = useState({});
  const [pending, setPending] = useState(new Set());
  const [errors, setErrors]   = useState({});
  const [savedAt, setSavedAt] = useState(null);
  const loaded = useRef(new Set());

  async function loadGroup(key, entry, force) {
    setPending((p) => new Set(p).add(key));
    try {
      const loader = entry.isGoalie ? loadLeagueGoalies : loadLeagueSkaters;
      const res = await loader(credentials, entry.tournamentId, entry.seasonId, { force });
      const map = {};
      for (const { player, norm } of res.data) map[String(getPlayerId(player))] = norm;
      setNorms((n) => ({ ...n, [key]: map }));
      setErrors(({ [key]: _, ...rest }) => rest);
      if (res.fromCache) setSavedAt((s) => Math.min(s ?? Infinity, res.savedAt));
    } catch (e) {
      setErrors((er) => ({ ...er, [key]: `${entry.leagueName || entry.tournamentId} ${entry.isGoalie ? 'goalies' : 'skaters'}: ${e.message}` }));
    } finally {
      setPending((p) => { const n = new Set(p); n.delete(key); return n; });
    }
  }

  useEffect(() => {
    if (!credentials) return;
    for (const e of items) {
      const k = groupKey(e);
      if (loaded.current.has(k)) continue;
      loaded.current.add(k);
      loadGroup(k, e, false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials, items]);

  function refreshAll() {
    setSavedAt(null);
    const seen = new Set();
    for (const e of items) {
      const k = groupKey(e);
      if (seen.has(k)) continue;
      seen.add(k);
      loadGroup(k, e, true);
    }
  }

  return { norms, pending, errors: Object.values(errors), savedAt, refreshAll };
}

function Toolbar({ items, onRefresh, refreshing, savedAt }) {
  const fileRef = useRef(null);
  const [msg, setMsg] = useState('');
  const btn = 'rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-brand-600 hover:text-brand-300 transition disabled:opacity-40';

  function doExport() {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usa-hockey-watchlist-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function doImport(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try { parsed = JSON.parse(String(reader.result)); } catch { setMsg('Could not read that file.'); return; }
      const res = importWatchlist(parsed);
      setMsg(res.ok ? `Imported ${res.added} player${res.added !== 1 ? 's' : ''}${res.skipped ? ` (${res.skipped} already listed)` : ''}.` : res.error);
    };
    reader.readAsText(file);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {savedAt && <span className="text-xs text-slate-600">Stats cached {timeAgo(savedAt)}</span>}
      <input ref={fileRef} type="file" accept="application/json,.json" onChange={doImport} className="hidden" />
      {items.length > 0 && <button onClick={onRefresh} disabled={refreshing} className={btn}>{refreshing ? 'Refreshing…' : '↻ Refresh stats'}</button>}
      {items.length > 0 && <button onClick={doExport} className={btn}>Export</button>}
      <button onClick={() => fileRef.current?.click()} className={btn}>Import</button>
      {items.length > 0 && (
        <button onClick={() => { if (confirm('Remove all players from your watchlist?')) clearAll(); }}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:border-rose-700 hover:text-rose-400 transition">
          Clear all
        </button>
      )}
      {msg && <span className="text-xs text-emerald-400">{msg}</span>}
    </div>
  );
}

export default function App() {
  const [credentials, setCredentials] = useState(() => {
    try { const raw = localStorage.getItem(CREDS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  const [showModal, setShowModal] = useState(false);
  const [seasons, setSeasons] = useState([]);
  const [contextError, setContextError] = useState('');
  const [loadingContext, setLoadingContext] = useState(false);

  const items = useWatchlist();
  const { norms, pending, errors, savedAt, refreshAll } = useWatchlistStats(credentials, items);

  useEffect(() => {
    if (credentials) localStorage.setItem(CREDS_KEY, JSON.stringify(credentials));
    else localStorage.removeItem(CREDS_KEY);
  }, [credentials]);

  useEffect(() => {
    setSeasons([]); setContextError('');
    if (!credentials) return;
    setLoadingContext(true);
    fetchSeasons(credentials)
      .then((sData) => {
        const sList = (deepFindArray(sData) ?? []).filter((s) => ALLOWED_SEASONS.has(s.name || s.season_name || s.title || ''));
        setSeasons(sList);
        if (sList.length === 0) setContextError('No matching seasons returned from InStat.');
      })
      .catch((e) => setContextError(e.message))
      .finally(() => setLoadingContext(false));
  }, [credentials]);

  const rowsFor = (list) => list.map((entry) => {
    const k = groupKey(entry);
    return { entry, norm: norms[k]?.[entry.id] ?? null, loading: pending.has(k) && !norms[k] };
  });
  const skaters = rowsFor(items.filter((i) => !i.isGoalie));
  const goalies = rowsFor(items.filter((i) => i.isGoalie));

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 border-t-4 border-t-brand-600 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-1.5 rounded-full bg-brand-600" />
            <div>
              <h1 className="font-display text-2xl font-bold uppercase leading-none tracking-wide text-white">USA Hockey Watchlist</h1>
              <p className="text-xs text-slate-500">Personal scouting dashboard</p>
            </div>
          </div>
          <CredentialsBadge hasCredentials={!!credentials} onOpen={() => setShowModal(true)} />
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        {!credentials && (
          <div className="rounded-xl border border-amber-800 bg-amber-950/40 p-6 text-center">
            <p className="text-sm font-medium text-amber-300">Enter your InStat API credentials to get started.</p>
            <button onClick={() => setShowModal(true)}
              className="mt-3 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600">
              Set Credentials ⚙️
            </button>
          </div>
        )}

        {contextError && <p className="rounded-lg border border-rose-800 bg-rose-950/40 px-4 py-2 text-sm text-rose-400">{contextError}</p>}

        {credentials && (
          <>
            <AddPlayer credentials={credentials} tournaments={TOURNAMENTS} seasons={seasons} loadingContext={loadingContext} />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-400">
                {items.length} player{items.length !== 1 ? 's' : ''} on watchlist
                {items.length > 0 && ` · ${skaters.length} skater${skaters.length !== 1 ? 's' : ''}, ${goalies.length} goalie${goalies.length !== 1 ? 's' : ''}`}
              </p>
              <Toolbar items={items} onRefresh={refreshAll} refreshing={pending.size > 0} savedAt={savedAt} />
            </div>

            {errors.map((e) => <p key={e} className="rounded-lg border border-rose-900 bg-rose-950/40 px-4 py-2 text-sm text-rose-400">{e}</p>)}

            {items.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-10 text-center">
                <div className="mb-3 text-4xl">📋</div>
                <p className="text-sm font-medium text-slate-300">Your watchlist is empty</p>
                <p className="mx-auto mt-2 max-w-md text-xs text-slate-500">
                  Pick a league and season above, search a player's name, and hit “+ Add”. Their season stats
                  show up here, ranked against everyone else you're tracking.
                </p>
              </div>
            ) : (
              <>
                <WatchlistTable title="Skaters" accent="text-white" rows={skaters} cols={SKATER_COLS} />
                <WatchlistTable title="Goalies" accent="text-white" rows={goalies} cols={GOALIE_COLS} />
              </>
            )}
          </>
        )}
      </main>

      {showModal && <CredentialsModal credentials={credentials} onSave={setCredentials} onClose={() => setShowModal(false)} />}
    </div>
  );
}
