import { useState, useRef, useMemo } from 'react';
import { fetchTournamentPlayers } from '../api.js';
import {
  extractPlayerList, playerDisplayName, getPlayerId, isGoalie, isNoName, getTournamentId, getSeasonId, tournamentName, seasonName,
} from '../playerUtils.js';
import { useWatchlist, add, toWatchEntry } from '../watchlist.js';
import PlayerBio from './PlayerBio.jsx';

const selectCls = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50';

// League + season picker, then a name search over that league's skaters and goalies.
export default function AddPlayer({ credentials, tournaments, seasons, loadingContext }) {
  const [tournamentId, setTournamentId] = useState('');
  const [seasonId, setSeasonId]         = useState('');
  const [leagueFilter, setLeagueFilter] = useState('');
  const [players, setPlayers]           = useState(null); // null | [{ player, isGoalie }]
  const [query, setQuery]               = useState('');
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const loadIdRef = useRef(0);
  const watched = new Set(useWatchlist().map((i) => i.id));

  const leagueOptions = useMemo(() => {
    const f = leagueFilter.trim().toLowerCase();
    return f ? tournaments.filter((t) => tournamentName(t).toLowerCase().includes(f)) : tournaments;
  }, [tournaments, leagueFilter]);

  async function loadPlayers(tid, sid) {
    const loadId = ++loadIdRef.current;
    setPlayers(null); setError(''); setQuery('');
    if (!tid || !sid) return;
    setLoading(true);
    try {
      // Search the full roster (tpl=246), not just players with season-aggregate stats —
      // players with few/no games tracked yet are still worth watching.
      const listData = await fetchTournamentPlayers(credentials, tid, sid);
      if (loadId !== loadIdRef.current) return;
      const all = extractPlayerList(listData)
        .filter((p) => !isNoName(p))
        .map((p) => ({ player: p, isGoalie: isGoalie(p) }))
        .sort((a, b) => playerDisplayName(a.player).localeCompare(playerDisplayName(b.player)));
      if (all.length === 0) setError('No players found for this league/season.');
      setPlayers(all);
    } catch (e) {
      if (loadId === loadIdRef.current) setError(e.message);
    } finally {
      if (loadId === loadIdRef.current) setLoading(false);
    }
  }

  function handleTournamentChange(e) { setTournamentId(e.target.value); setSeasonId(''); loadPlayers('', ''); }
  function handleSeasonChange(e)     { setSeasonId(e.target.value); loadPlayers(tournamentId, e.target.value); }

  const q = query.trim().toLowerCase();
  const matches = players && q.length >= 2
    ? players.filter(({ player }) => {
        const hay = `${playerDisplayName(player)} ${player.team_name ?? ''}`.toLowerCase();
        return q.split(/\s+/).every((w) => hay.includes(w));
      }).slice(0, 25)
    : [];

  function addPlayer(player, isGoalie) {
    const t = tournaments.find((x) => String(getTournamentId(x)) === String(tournamentId));
    const s = seasons.find((x) => String(getSeasonId(x)) === String(seasonId));
    add(toWatchEntry(player, {
      tournamentId, seasonId, isGoalie,
      leagueName: t ? tournamentName(t) : '', seasonName: s ? seasonName(s) : '',
    }));
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <h2 className="mb-3 font-display text-lg font-semibold uppercase tracking-wide text-white">Add players</h2>
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-48 flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-400">League / Tournament</label>
          <input
            value={leagueFilter} onChange={(e) => setLeagueFilter(e.target.value)}
            placeholder="Filter leagues (e.g. USHL, NTDP, U18)…"
            className="mb-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-brand-500 focus:outline-none"
          />
          <select value={tournamentId} onChange={handleTournamentChange} disabled={loadingContext} className={selectCls}>
            <option value="">— Select league ({leagueOptions.length}) —</option>
            {leagueOptions.map((t) => <option key={getTournamentId(t)} value={getTournamentId(t)}>{tournamentName(t)}</option>)}
          </select>
        </div>
        <div className="min-w-40 flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-400">Season</label>
          <select value={seasonId} onChange={handleSeasonChange}
            disabled={!tournamentId || loadingContext || seasons.length === 0} className={selectCls}>
            <option value="">{!tournamentId ? 'Select league first' : '— Select season —'}</option>
            {seasons.map((s) => <option key={getSeasonId(s)} value={getSeasonId(s)}>{seasonName(s)}</option>)}
          </select>
        </div>
        <div className="min-w-56 flex-[1.5]">
          <label className="mb-1 block text-xs font-medium text-slate-400">Player name</label>
          <input
            value={query} onChange={(e) => setQuery(e.target.value)} disabled={!players || players.length === 0}
            placeholder={loading ? 'Loading players…' : players ? `Search ${players.length} players…` : 'Pick a league & season first'}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
          />
        </div>
      </div>

      {error && <p className="mt-3 rounded-lg border border-rose-900 bg-rose-950/40 px-4 py-2 text-sm text-rose-400">{error}</p>}

      {q.length >= 2 && players && (
        <div className="mt-3 max-h-80 divide-y divide-slate-800 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950">
          {matches.length === 0 && <p className="px-4 py-3 text-xs text-slate-500">No players match “{query}”.</p>}
          {matches.map(({ player, isGoalie }) => {
            const pid = String(getPlayerId(player));
            const on = watched.has(pid);
            return (
              <div key={pid} className="flex items-center justify-between gap-3 px-4 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-100">
                    {playerDisplayName(player)}
                    {isGoalie && <span className="ml-2 rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-white">G</span>}
                  </p>
                  <p className="truncate text-xs text-slate-500">{player.team_name || '—'}</p>
                  <PlayerBio player={player} isGoalie={isGoalie} variant="inline" />
                </div>
                <button
                  onClick={() => addPlayer(player, isGoalie)} disabled={on}
                  className="shrink-0 rounded-md bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-500 disabled:cursor-default disabled:bg-slate-800 disabled:text-slate-500 transition"
                >
                  {on ? '✓ On watchlist' : '+ Add'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
