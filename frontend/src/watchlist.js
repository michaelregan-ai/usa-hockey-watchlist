// Coach's personal watchlist. Stored in localStorage as a tiny pub/sub store so every
// component stays in sync via useSyncExternalStore. Each entry remembers the league/season
// it was added from, so stats can be pulled from that league's season-aggregate feed.

import { useSyncExternalStore } from 'react';
import { getPlayerId, playerDisplayName } from './playerUtils.js';

const KEY = 'usah_watchlist_v1';

function load() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(arr) ? arr.map(migrate) : [];
  } catch { return []; }
}

// Local calendar date (not UTC) so an evening note isn't stamped with tomorrow's date.
const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => localDate(new Date());
const newNoteId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Notes are a dated log: [{ id, date: 'YYYY-MM-DD', text }], newest first.
// Older entries carried a single `note` string — fold it into the log, dated when the player was added.
function migrate(e) {
  if (Array.isArray(e.notes)) return e;
  const { note, ...rest } = e;
  const date = e.addedAt ? localDate(new Date(e.addedAt)) : today();
  return { ...rest, notes: note ? [{ id: newNoteId(), date, text: note }] : [] };
}

// After the helpers above: load() → migrate() uses the const date helpers.
let items = load();
const listeners = new Set();

function commit(next) {
  items = next;
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* quota/private mode — in-memory still works */ }
  listeners.forEach((l) => l());
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function getAll() { return items; }
export function has(id) { const s = String(id); return items.some((i) => i.id === s); }

// Re-adding a player from a different league/season replaces the old context (keeps notes and grade).
export function add(entry) {
  const id = String(entry?.id ?? '');
  if (!id) return;
  const prev = items.find((i) => i.id === id);
  const rest = items.filter((i) => i.id !== id);
  commit([{ ...entry, id, notes: prev?.notes ?? [], grade: prev?.grade ?? '', addedAt: prev?.addedAt ?? Date.now() }, ...rest]);
}
export function remove(id) { const s = String(id); commit(items.filter((i) => i.id !== s)); }
function updateNotes(id, fn) { const s = String(id); commit(items.map((i) => (i.id === s ? { ...i, notes: fn(i.notes ?? []) } : i))); }
export function addNote(id, text, date = today()) {
  const t = text.trim();
  if (!t) return;
  updateNotes(id, (ns) => [{ id: newNoteId(), date, text: t }, ...ns].sort((a, b) => b.date.localeCompare(a.date)));
}
export function deleteNote(id, noteId) { updateNotes(id, (ns) => ns.filter((n) => n.id !== noteId)); }
export const GRADES = ['A', 'B', 'C', 'D'];
export function setGrade(id, grade) {
  const s = String(id);
  commit(items.map((i) => (i.id === s ? { ...i, grade: GRADES.includes(grade) ? grade : '' } : i)));
}
export function clearAll() { commit([]); }

export function importWatchlist(incoming) {
  if (!Array.isArray(incoming)) return { ok: false, error: 'That file is not a valid watchlist.' };
  const existing = new Set(items.map((i) => i.id));
  const toAdd = incoming.filter((e) => e && e.id != null && !existing.has(String(e.id)))
    .map((e) => migrate({ ...e, id: String(e.id), tournamentId: String(e.tournamentId ?? ''), seasonId: String(e.seasonId ?? '') }));
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
