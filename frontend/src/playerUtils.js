function findLargestArray(node, depth = 0, arrays = []) {
  if (depth > 5) return arrays;
  if (Array.isArray(node)) {
    arrays.push(node);
    node.forEach((item) => findLargestArray(item, depth + 1, arrays));
  } else if (node && typeof node === 'object') {
    Object.values(node).forEach((v) => findLargestArray(v, depth + 1, arrays));
  }
  return arrays;
}

export function extractPlayerList(data) {
  if (Array.isArray(data?.data?.[0]?.players)) return data.data[0].players;
  if (Array.isArray(data?.data?.players))       return data.data.players;
  if (Array.isArray(data?.players))             return data.players;
  if (Array.isArray(data?.data) && data.data.length > 0 && data.data[0]?.player_id != null)
    return data.data;
  if (Array.isArray(data)) return data;
  const all = findLargestArray(data);
  if (all.length === 0) return [];
  return all.reduce((a, b) => (b.length > a.length ? b : a), []);
}

export function playerDisplayName(p) {
  if (!p) return '—';
  const full = `${p.first_name ?? p.firstname ?? p.firstName ?? ''} ${p.last_name ?? p.lastname ?? p.lastName ?? ''}`.trim();
  return (
    p.name ||
    p.player_name ||
    p.full_name ||
    p.fullname ||
    p.player_login ||
    p.login ||
    (full || null) ||
    `#${p.player_id ?? p.playerId ?? p.id ?? p.player ?? '?'}`
  );
}

export function isNoName(p) {
  const name = playerDisplayName(p).toLowerCase().replace(/\s+/g, ' ').trim();
  return name === 'noname noname' || name === 'noname' || name === 'no name' || name === '—';
}

export function isGoalie(p) {
  const pos = String(
    p?.position1_name ?? p?.position_name ?? p?.position ?? p?.pos ?? p?.role ?? ''
  ).trim().toLowerCase();
  const posId = String(p?.position_id ?? p?.position1_id ?? '');
  return (
    posId === '1' ||
    pos === 'g' ||
    pos === 'gk' ||
    pos.includes('goali') ||
    pos.includes('keeper') ||
    pos.includes('tender') ||
    pos.includes('вратар')
  );
}

export function getPlayerId(p) {
  return p.player_id ?? p.playerId ?? p.id ?? p.player ?? null;
}

export function getTournamentId(t) {
  return t.id ?? t.tournament_id ?? t.tournamentId ?? null;
}

export function getSeasonId(s) {
  return s.season_id ?? s.seasonId ?? s.id ?? null;
}

export function tournamentName(t) {
  return t.name || t.tournament_name || t.title || `ID ${getTournamentId(t)}`;
}

export function seasonName(s) {
  return s.name || s.season_name || s.title || `ID ${getSeasonId(s)}`;
}

// Compact "time since" for cache-freshness labels: "just now", "5m ago", "3h ago", "2d ago".
export function timeAgo(epochMs) {
  if (!epochMs) return '';
  const s = Math.max(0, Math.round((Date.now() - epochMs) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

// Extract display-ready bio from a player object (tpl=246 / tpl=215 both carry these fields).
// Heights/weights are metric in the feed; we show imperial + metric for a NA recruiting audience.
export function getBio(player) {
  if (!player) return null;
  const cm = parseInt(player.height, 10);
  const kg = parseInt(player.weight, 10);
  let height = '';
  if (cm > 0) { const inch = Math.round(cm / 2.54); height = `${Math.floor(inch / 12)}'${inch % 12}" (${cm} cm)`; }
  const weight = kg > 0 ? `${Math.round(kg * 2.2046)} lb (${kg} kg)` : '';

  const birthday = player.birthday || '';
  let age = '', birthYear = '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthday);
  if (m) {
    birthYear = m[1];
    const b = new Date(`${birthday}`.slice(0, 10));
    const now = new Date();
    let a = now.getFullYear() - b.getFullYear();
    if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) a--;
    if (a >= 0 && a < 100) age = String(a);
  }

  const hand = player.hand_name && !['—', ''].includes(player.hand_name) ? player.hand_name : '';
  return {
    photo: player.photo || '',
    position: (player.position1_name || '').trim(),
    number: player.club_number || player.number || '',
    height, weight, birthday, age, birthYear, hand,
    nationality: player.country1_name || '',
  };
}
