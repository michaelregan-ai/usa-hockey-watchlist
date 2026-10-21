// Loads a whole league/season worth of players with season-aggregate (tpl=226) stats.
// Cache-aware (IndexedDB via playerCache), so the same data powers League Leaders,
// Recruit Finder, Goalie tabs, and comparison-table percentiles without re-fetching.

import { fetchTournamentPlayers, fetchAggregateStats } from './api.js';
import {
  readPlayerCache, writePlayerCache, dropPlayerCache,
  readGoalieCache, writeGoalieCache, dropGoalieCache,
} from './playerCache.js';
import { extractPlayerList, getPlayerId, isGoalie, isNoName } from './playerUtils.js';
import { aggregateSkaterNorm, aggregateGoalieNorm } from './stats.js';

// Aggregated goalie stats (tpl=226) use averages for some params, totals for the rest.
const USE_AVG_IDS = new Set(['176', '195', '233', '237', '251', '252', '253']);

// Flatten one goalie's tpl=226 row[] into a param_id → value map, adding shot-type percentages.
export function buildNorm226(rows226) {
  const norm226 = {};
  for (const row of rows226) {
    const id  = String(row.param_id);
    const raw = USE_AVG_IDS.has(id) ? parseFloat(row.value_avg) : parseFloat(row.value_sum);
    if (!isNaN(raw)) norm226[id] = String(Math.round(raw * 100) / 100);
  }
  const totalShots = ['164', '165', '166', '167'].reduce((s, id) => s + (parseFloat(norm226[id]) || 0), 0);
  if (totalShots > 0) {
    for (const id of ['156', '157', '158', '164', '165', '166', '167', '172', '173', '175']) {
      const val = parseFloat(norm226[id]);
      if (!isNaN(val)) norm226[`${id}_pct`] = String(Math.round(val / totalShots * 1000) / 10);
    }
  }
  return norm226;
}

// Resolves to { data: [{ player, norm }], savedAt, fromCache } or null if cancelled.
//   onProgress?.({ done, total, data })  — data so far (for progress UIs)
//   force        — bypass and refresh the cache
//   shouldCancel — return true to abort (e.g. the user changed selection)
//
// Two calls per league instead of a ~400-player batch loop: the player list (tpl=246, for
// bio + the skater/goalie filter) and one season-aggregate stats dump (tpl=226, every player),
// joined by player_id. Far faster and well under the 10 req/s rate limit.
export async function loadLeagueSkaters(credentials, tournamentId, seasonId, opts = {}) {
  const { onProgress, force = false, shouldCancel } = opts;

  if (force) {
    await dropPlayerCache(tournamentId, seasonId);
  } else {
    const hit = await readPlayerCache(tournamentId, seasonId);
    if (hit) {
      onProgress?.({ done: hit.data.length, total: hit.data.length, data: hit.data });
      return { ...hit, fromCache: true };
    }
  }

  onProgress?.({ done: 0, total: 0, data: [] });
  const [listData, aggData] = await Promise.all([
    fetchTournamentPlayers(credentials, tournamentId, seasonId),
    fetchAggregateStats(credentials, tournamentId, seasonId),
  ]);
  if (shouldCancel?.()) return null;

  const players = extractPlayerList(listData).filter(p => !isGoalie(p) && !isNoName(p));

  const rowsByPid = {};
  for (const e of (aggData?.data?.data ?? [])) {
    const pid = String(e.player_id ?? e.id ?? '');
    if (!pid) continue;
    rowsByPid[pid] = Array.isArray(e.row) ? e.row : e.row ? [e.row] : [];
  }

  const data = [];
  for (const p of players) {
    const rows = rowsByPid[String(getPlayerId(p))];
    if (rows) data.push({ player: p, norm: aggregateSkaterNorm(rows) });
  }
  onProgress?.({ done: data.length, total: players.length, data: [...data] });

  const saved = await writePlayerCache(tournamentId, seasonId, data);
  return { ...saved, fromCache: false };
}

// Same contract as loadLeagueSkaters, but for goalies. Entries are { player, norm } where norm
// is the full aggregate goalie stat map. Two calls per league (player list + one tpl=226 dump),
// no per-goalie tpl=21 batch.
export async function loadLeagueGoalies(credentials, tournamentId, seasonId, opts = {}) {
  const { onProgress, force = false, shouldCancel } = opts;

  if (force) {
    await dropGoalieCache(tournamentId, seasonId);
  } else {
    const hit = await readGoalieCache(tournamentId, seasonId);
    if (hit) {
      onProgress?.({ done: hit.data.length, total: hit.data.length, data: hit.data });
      return { ...hit, fromCache: true };
    }
  }

  onProgress?.({ done: 0, total: 0, data: [] });
  const [listData, aggData] = await Promise.all([
    fetchTournamentPlayers(credentials, tournamentId, seasonId),
    fetchAggregateStats(credentials, tournamentId, seasonId),
  ]);
  if (shouldCancel?.()) return null;

  const goalies = extractPlayerList(listData).filter(p => isGoalie(p) && !isNoName(p));

  const rowsByPid = {};
  for (const e of (aggData?.data?.data ?? [])) {
    const pid = String(e.player_id ?? e.id ?? '');
    if (!pid) continue;
    rowsByPid[pid] = Array.isArray(e.row) ? e.row : e.row ? [e.row] : [];
  }

  const data = [];
  for (const p of goalies) {
    const rows = rowsByPid[String(getPlayerId(p))];
    if (rows) data.push({ player: p, norm: aggregateGoalieNorm(rows) });
  }
  onProgress?.({ done: data.length, total: goalies.length, data: [...data] });

  const saved = await writeGoalieCache(tournamentId, seasonId, data);
  return { ...saved, fromCache: false };
}
