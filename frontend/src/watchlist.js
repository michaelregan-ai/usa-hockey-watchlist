// Coach's personal watchlist. Stored in localStorage as a tiny pub/sub store so every
// component stays in sync via useSyncExternalStore. Each entry remembers the league/season
// it was added from, so stats can be pulled from that league's season-aggregate feed.

import { useSyncExternalStore } from 'react';
import { getPlayerId, playerDisplayName } from './playerUtils.js';

const KEY = 'usah_watchlist_v1';
let items = load();
const listeners = new Set();

function load() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function commit(next) {
  items = next;
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* quota/private mode — in-memory still works */ }
  listeners.forEach((l) => l());
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function getAll() { return items; }
export function has(id) { const s = String(id); return items.some((i) => i.id === s); }

// Re-adding a player from a different league/season replaces the old context (keeps the note).
export function add(entry) {
  const id = String(entry?.id ?? '');
  if (!id) return;
  const prev = items.find((i) => i.id === id);
  const rest = items.filter((i) => i.id !== id);
  commit([{ ...entry, id, note: prev?.note ?? '', addedAt: prev?.addedAt ?? Date.now() }, ...rest]);
}
export function remove(id) { const s = String(id); commit(items.filter((i) => i.id !== s)); }
export function setNote(id, note) { const s = String(id); commit(items.map((i) => (i.id === s ? { ...i, note } : i))); }
export function clearAll() { commit([]); }

export function importWatchlist(incoming) {
  if (!Array.isArray(incoming)) return { ok: false, error: 'That file is not a valid watchlist.' };
  const existing = new Set(items.map((i) => i.id));
  const toAdd = incoming.filter((e) => e && e.id != null && !existing.has(String(e.id)))
    .map((e) => ({ ...e, id: String(e.id), tournamentId: String(e.tournamentId ?? ''), seasonId: String(e.seasonId ?? '') }));
  commit([...items, ...toAdd]);
  return { ok: true, added: toAdd.length, skipped: incoming.length - toAdd.length };
}

export function toWatchEntry(player, meta = {}) {
  return {
    id: String(getPlayerId(player) ?? ''),
    name: playerDisplayName(player),
    team: player?.team_name || player?.team || '',
    leagueName: meta.leagueName || '',
    seasonName: meta.seasonName || '',
    tournamentId: String(meta.tournamentId ?? ''),
    seasonId: String(meta.seasonId ?? ''),
    isGoalie: !!meta.isGoalie,
    height: player?.height, weight: player?.weight, hand_name: player?.hand_name,
    birthday: player?.birthday, country1_name: player?.country1_name,
    position1_name: player?.position1_name, club_number: player?.club_number, photo: player?.photo,
  };
}

export function useWatchlist() {
  return useSyncExternalStore(subscribe, getAll, getAll);
}
