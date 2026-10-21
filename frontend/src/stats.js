export const PRIORITY_STATS = [
  { label: 'Games Played',       keys: ['games_played', 'gp'] },
  { label: 'Goals',              keys: ['goals'] },
  { label: 'Assists',            keys: ['assists'] },
  { label: 'Points',             keys: ['points'] },
  { label: '+/-',                keys: ['plus_minus'] },
  { label: 'Avg Time on Ice',    keys: ['toi_avg'], format: 'mmss' },
  { label: 'Faceoffs Won %',     keys: ['faceoffs_won'] },
  { label: 'xG/GP',              keys: ['xg_pg'] },
  { label: 'Net xG',             keys: ['net_xg_onice'] },
  { label: 'Puck Battle Won %',  keys: ['challenges_won'] },
  { label: 'Accurate Pass %',    keys: ['accurate_passes'] },
  { label: 'Shots/GP',           keys: ['shots_pg'] },
  { label: 'Shots on Goal/GP',   keys: ['shots_on_goal_pg'] },
  { label: 'Hits/GP',            keys: ['hits_pg'] },
  { label: 'Corsi',              keys: ['corsi'] },
  { label: 'Giveaways/GP',       keys: ['giveaways_pg'] },
  { label: 'Takeaways/GP',       keys: ['takeaways_pg'] },
];

function normalizeParamName(raw) {
  return String(raw)
    .toLowerCase()
    .replace(/\+/g, 'plus')
    .replace(/-/g, 'minus')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export function normalizeStats(apiResponse) {
  if (!apiResponse) return {};
  try {
    const data = apiResponse.data ?? apiResponse;
    if (!data || typeof data !== 'object') return {};

    if (Array.isArray(data.match)) {
      const matches = data.match;

      const sums  = {};
      const rateS = {};
      const rateN = {};

      for (const match of matches) {
        const matchRows = Array.isArray(match.row)
          ? match.row
          : match.row ? [match.row] : [];

        const seenParamNames = new Set();

        for (const row of matchRows) {
          if (!row || typeof row !== 'object') continue;
          const rawName = String(row.param_name ?? '');
          const paramId = row.param_id != null ? String(row.param_id) : null;
          const value   = parseFloat(row.value);
          if (isNaN(value)) continue;

          if (rawName) {
            if (seenParamNames.has(rawName)) continue;
            seenParamNames.add(rawName);
          }

          const normName = normalizeParamName(rawName);
          const isRate   = rawName.includes('%');
          const keys = [...new Set([paramId, normName, rawName.toLowerCase()].filter(Boolean))];

          for (const k of keys) {
            if (isRate) {
              rateS[k] = (rateS[k] ?? 0) + value;
              rateN[k] = (rateN[k] ?? 0) + 1;
            } else {
              sums[k] = (sums[k] ?? 0) + value;
            }
          }
        }
      }

      const gp = matches.length;
      const out = {};
      for (const [k, v] of Object.entries(sums))  out[k] = String(Math.round(v * 100) / 100);
      for (const [k, v] of Object.entries(rateS)) out[k] = String(Math.round((v / rateN[k]) * 100) / 100);
      out['games_played'] = String(gp);
      out['gp']           = String(gp);

      // Avg TOI per game
      const toiPatterns = ['ice_time_s', 'seconds_on_ice', 'time_on_ice_s', 'ice_time', 'time_on_ice'];
      if (gp > 0) {
        for (const k of toiPatterns) {
          if (out[k] !== undefined) {
            out['toi_avg'] = String(Math.round(parseFloat(out[k]) / gp));
            break;
          }
        }
      }

      // Corsi For %
      const cf = parseFloat(out['corsiplus'] ?? '0');
      const ca = parseFloat(out['corsiminus'] ?? '0');
      if (cf + ca > 0) out['corsi_for_pct'] = String(Math.round(cf / (cf + ca) * 1000) / 10);

      // Net xG (on-ice)
      const xgf = parseFloat(out['xg_with_a_player_on'] ?? '0');
      const xga = parseFloat(out["opponent_s_xg_with_a_player_on"] ?? '0');
      if (xgf !== 0 || xga !== 0) out['net_xg_onice'] = String(Math.round((xgf - xga) * 100) / 100);

      // Per-game derived stats
      if (gp > 0) {
        const pgMap = {
          'xg_pg':              ['xg_with_a_player_on'],
          'shots_pg':           ['shots'],
          'shots_on_goal_pg':   ['shots on goal'],
          'hits_pg':            ['hits'],
          'giveaways_pg':       ['giveaways'],
          'takeaways_pg':       ['takeaways'],
        };
        for (const [dest, srcKeys] of Object.entries(pgMap)) {
          for (const k of srcKeys) {
            if (out[k] !== undefined) {
              out[dest] = String(Math.round(parseFloat(out[k]) / gp * 100) / 100);
              break;
            }
          }
        }
      }

      return out;
    }

    return {};
  } catch (e) {
    console.error('[IH] normalizeStats error:', e);
    return {};
  }
}

// Build a skater norm from a tpl=226 aggregate entry's row[] (each { param_id, param_name,
// value_sum, value_avg }). Produces the same keys PRIORITY_STATS expects, so League Leaders /
// Recruit Finder / percentiles work unchanged. Counting stats use value_sum; per-game and
// percentage stats use value_avg (InStat's season rate). Verified against the per-match path:
// counting/per-game values match exactly; true % stats become season rates (slightly different,
// and more accurate, than averaging per-game percentages).
const AGG_SUM = { goals: '2', assists: '191', points: '4', plus_minus: '5', net_xg_onice: '246', corsi: '40', games_played: '187', gp: '187' };
const AGG_AVG = { toi_avg: '17', xg_pg: '244', shots_pg: '8', shots_on_goal_pg: '9', hits_pg: '15', giveaways_pg: '48', takeaways_pg: '49' };

export function aggregateSkaterNorm(rows) {
  if (!Array.isArray(rows)) return {};
  const sum = {}, avg = {}, out = {};
  for (const r of rows) {
    const id = String(r.param_id);
    const s = parseFloat(r.value_sum), a = parseFloat(r.value_avg);
    if (!isNaN(s)) sum[id] = s;
    if (!isNaN(a)) avg[id] = a;
    // Generic name key so anything not explicitly mapped (e.g. faceoffs_won, challenges_won,
    // accurate_passes) still resolves: % params use the season average, others the total.
    const nn = normalizeParamName(String(r.param_name ?? ''));
    const isRate = String(r.param_name ?? '').includes('%');
    const v = isRate ? a : s;
    if (nn && !isNaN(v)) out[nn] = String(Math.round(v * 100) / 100);
  }
  const put = (key, map, id) => { if (map[id] !== undefined) out[key] = String(Math.round(map[id] * 100) / 100); };
  for (const [k, id] of Object.entries(AGG_SUM)) put(k, sum, id);
  for (const [k, id] of Object.entries(AGG_AVG)) put(k, avg, id);
  if (avg['17'] !== undefined) out.toi_avg = String(Math.round(avg['17'])); // whole seconds, matches per-match path
  return out;
}

// These aggregate goalie params are per-shot/per-game rates, so use value_avg; the rest use value_sum.
const GOALIE_AGG_USE_AVG = new Set(['176', '195', '233', '237', '251', '252', '253']);

// Build a full goalie norm from a tpl=226 aggregate entry's row[]. Produces BOTH the numeric
// param_id keys GOALIE_STATS uses (23, 231-233, 237, 250-253, 176, shot-type _pct) AND the name
// keys (goals_against, total_shots_goalkeeper, saves, accurate_passes, number_of_games_*), so the
// goalie loaders no longer need a separate per-goalie tpl=21 pull.
export function aggregateGoalieNorm(rows) {
  if (!Array.isArray(rows)) return {};
  const norm = {};
  for (const r of rows) {
    const id = String(r.param_id);
    const byId = GOALIE_AGG_USE_AVG.has(id) ? parseFloat(r.value_avg) : parseFloat(r.value_sum);
    if (!isNaN(byId)) norm[id] = String(Math.round(byId * 100) / 100);
    const nn = normalizeParamName(String(r.param_name ?? ''));
    const isRate = String(r.param_name ?? '').includes('%');
    const byName = isRate ? parseFloat(r.value_avg) : parseFloat(r.value_sum);
    if (nn && !isNaN(byName)) norm[nn] = String(Math.round(byName * 100) / 100);
  }
  // Shot-type percentages (% of total shots faced), same as the per-goalie path.
  const total = ['164', '165', '166', '167'].reduce((s, id) => s + (parseFloat(norm[id]) || 0), 0);
  if (total > 0) {
    for (const id of ['156', '157', '158', '164', '165', '166', '167', '172', '173', '175']) {
      const v = parseFloat(norm[id]);
      if (!isNaN(v)) norm[`${id}_pct`] = String(Math.round(v / total * 1000) / 10);
    }
  }
  if (norm['187'] !== undefined) { norm.games_played = norm['187']; norm.gp = norm['187']; }
  return norm;
}

export function findValue(normalized, keys) {
  // 1) Exact (case-insensitive) match always wins.
  for (const k of keys) {
    const lk = String(k).toLowerCase();
    if (lk in normalized) return normalized[lk];
  }
  // 2) Fuzzy substring match — ONLY for descriptive keys. Numeric param IDs ("232")
  //    and synthetic percentage keys ("156_pct") must be exact: fuzzy-matching short
  //    numeric ids cross-contaminates unrelated stats (e.g. every shot-type % row
  //    collapsing onto one param), so a genuinely-missing stat should read "—" instead.
  for (const k of keys) {
    const lk = String(k).toLowerCase();
    if (/^\d+$/.test(lk) || lk.endsWith('_pct') || lk.length < 3) continue;
    const match = Object.keys(normalized).find((nk) =>
      !/^\d+$/.test(nk) && nk.length >= 3 && (nk.includes(lk) || lk.includes(nk))
    );
    if (match) return normalized[match];
  }
  return null;
}

export function parseNum(v) {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
}

export function secondsToMmSs(v) {
  const n = parseNum(v);
  if (n === null) return '—';
  const total = Math.round(n);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatVal(v, format) {
  if (v == null || v === '') return '—';
  if (format === 'mmss') return secondsToMmSs(v);
  if (format === 'pct')  return `${v}%`;
  return String(v);
}

// ─── League percentile context ─────────────────────────────────────────────────
// Minimum league size before percentiles are meaningful.
export const MIN_DISTRIBUTION_N = 5;

// Build { [statLabel]: sortedAscNumericArray } from cached league entries ([{ player, raw }]).
// One-time cost per league (runs normalizeStats over every player), so memoize the result.
export function buildLeagueDistribution(entries, statDefs = PRIORITY_STATS) {
  const dist = {};
  for (const stat of statDefs) dist[stat.label] = [];
  if (!Array.isArray(entries)) return dist;

  for (const entry of entries) {
    const norm = entry?.norm ?? (entry?.raw ? normalizeStats(entry.raw) : null);
    if (!norm) continue;
    for (const stat of statDefs) {
      const n = parseNum(findValue(norm, stat.keys));
      if (n !== null) dist[stat.label].push(n);
    }
  }
  for (const label of Object.keys(dist)) dist[label].sort((a, b) => a - b);
  return dist;
}

// Percentile rank 0-100 (higher value → higher percentile). null when the sample is too small.
export function percentileRank(value, sortedAsc) {
  const n = parseNum(value);
  if (n === null || !Array.isArray(sortedAsc) || sortedAsc.length < MIN_DISTRIBUTION_N) return null;
  let below = 0, equal = 0;
  for (const v of sortedAsc) {
    if (v < n) below++;
    else if (v === n) equal++;
  }
  return Math.round(((below + 0.5 * equal) / sortedAsc.length) * 100);
}

// 1-based rank where 1 = highest value. null when the sample is too small.
export function rankOf(value, sortedAsc) {
  const n = parseNum(value);
  if (n === null || !Array.isArray(sortedAsc) || sortedAsc.length < MIN_DISTRIBUTION_N) return null;
  let greater = 0;
  for (const v of sortedAsc) if (v > n) greater++;
  return greater + 1;
}

// "94th", "3rd", "1st" — ordinal suffix for display.
export function ordinal(n) {
  if (n == null) return '';
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:  return `${n}st`;
    case 2:  return `${n}nd`;
    case 3:  return `${n}rd`;
    default: return `${n}th`;
  }
}
