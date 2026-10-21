const BASE = '/api/instat';

const TRANSIENT_MSG =
  'InStat is temporarily unavailable — this is on InStat\'s servers, not the app. Wait a moment and try again.';

// True when the backend flagged the failure as a transient upstream outage,
// or the raw body carries the tell-tale gateway text.
function isTransient(body) {
  return !!body && (body.transient === true || /no healthy upstream/i.test(body.raw || ''));
}

function buildUrl(creds, params) {
  const qs = new URLSearchParams({ id: creds.id, key: creds.key, ...params });
  return `${BASE}?${qs.toString()}`;
}

async function apiFetch(creds, params) {
  const res = await fetch(buildUrl(creds, params));
  if (res.status === 401) {
    const body = await res.json();
    throw new Error(body.error || 'Invalid credentials');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (isTransient(body)) throw new Error(TRANSIENT_MSG);
    // Include InStat's raw response in the error so it's visible in the UI
    const detail = body.raw ? ` — InStat said: "${String(body.raw).slice(0, 300)}"` : '';
    throw new Error((body.error || `HTTP ${res.status}`) + detail);
  }
  return res.json();
}

export async function fetchTournaments(creds) {
  return apiFetch(creds, { tpl: '203', tournaments: '' });
}

export async function fetchSeasons(creds) {
  return apiFetch(creds, { tpl: '204', seasons: '' });
}

export async function fetchTournamentPlayers(creds, tournamentId, seasonId) {
  return apiFetch(creds, { tpl: '246', tournament_id: tournamentId, season_id: seasonId });
}

// Optional dateStart/dateEnd (YYYY-MM-DD) restrict the per-match feed to a date window.
export async function fetchPlayerStats(creds, playerId, tournamentId, seasonId, { dateStart, dateEnd } = {}) {
  const params = { tpl: '21', player_id: playerId, tournament_id: tournamentId, season_id: seasonId };
  if (dateStart) params.date_start = dateStart;
  if (dateEnd) params.date_end = dateEnd;
  return apiFetch(creds, params);
}

// Batch version — sends all player IDs to the backend in one request.
// The backend fires all InStat calls concurrently (no browser 6-conn limit).
// Returns { [playerId]: statsJson }
export async function fetchPlayerStatsBatch(creds, playerIds, tournamentId, seasonId) {
  const body = { id: creds.id, key: creds.key, player_ids: playerIds, tournament_id: tournamentId, season_id: seasonId };
  const res = await fetch('/api/instat/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 401) { const b = await res.json(); throw new Error(b.error || 'Invalid credentials'); }
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    if (isTransient(b)) throw new Error(TRANSIENT_MSG);
    throw new Error(b.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchPlayerInfo(creds, playerId) {
  return apiFetch(creds, { tpl: '215', player_id: playerId });
}

export async function fetchGoalieStats(creds, playerId, tournamentId, seasonId) {
  return apiFetch(creds, { tpl: '226', player_id: playerId, tournament_id: tournamentId, season_id: seasonId });
}

// tpl=226 returns season-aggregate stats for EVERY player in the league in one response
// (the player_id param does not narrow it), so one call replaces a per-player batch.
export async function fetchAggregateStats(creds, tournamentId, seasonId) {
  return apiFetch(creds, { tpl: '226', tournament_id: tournamentId, season_id: seasonId });
}

export async function fetchTeamStats(creds, tournamentId, seasonId) {
  return apiFetch(creds, { tpl: '357', tournament_id: tournamentId, season_id: seasonId });
}

// tpl=234  stat_teams_aggr — season-aggregate team stats (team-level equiv of tpl=226 for players).
// Returns all param_ids for every team in the tournament; useful for discovering available params.
export async function fetchTeamAggr(creds, tournamentId, seasonId) {
  return apiFetch(creds, { tpl: '234', tournament_id: tournamentId, season_id: seasonId });
}

// ─── Per-match feeds (Match Analysis) ─────────────────────────────────────────
export async function fetchMatchTeamStats(creds, matchId) {
  return apiFetch(creds, { tpl: '359', match_id: matchId });
}
export async function fetchMatchPlayerStats(creds, matchId) {
  return apiFetch(creds, { tpl: '358', match_id: matchId });
}
export async function fetchMatchEvents(creds, matchId) {
  return apiFetch(creds, { tpl: '13', match_id: matchId });
}
