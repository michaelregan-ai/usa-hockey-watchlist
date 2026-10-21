// Persistent player/goalie stats cache.
//
// Three layers, fastest first:
//   1. in-memory Map  — instant, lives for the page session
//   2. IndexedDB       — survives reloads AND browser restarts, large quota, works offline
//   3. (nothing)       — a cold cache just means we re-fetch from InStat
//
// All reads/writes are async (IndexedDB is async). Every IndexedDB call is wrapped
// so that if the browser blocks it (private mode, disabled storage) the app still
// works using the in-memory layer alone.

const DB_NAME = 'usah_cache';
const DB_VERSION = 1;
const STORE = 'stats';

const mem = new Map();

function memKey(kind, tournamentId, seasonId) {
  return `${kind}:${tournamentId}_${seasonId}`;
}

// ─── IndexedDB plumbing ────────────────────────────────────────────────────────
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch((e) => { dbPromise = null; throw e; });
  return dbPromise;
}

function idbGet(key) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  }));
}

function idbSet(key, value) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

function idbDelete(key) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

// ─── Generic cache API ──────────────────────────────────────────────────────────
// Returns { data, savedAt } or null. `savedAt` is an epoch-ms timestamp.
async function readCache(kind, tournamentId, seasonId) {
  const k = memKey(kind, tournamentId, seasonId);
  if (mem.has(k)) return mem.get(k);
  try {
    const record = await idbGet(k);
    if (record && Array.isArray(record.data)) {
      const entry = { data: record.data, savedAt: record.savedAt ?? null };
      mem.set(k, entry);
      return entry;
    }
  } catch { /* IndexedDB blocked — fall through to null */ }
  return null;
}

async function writeCache(kind, tournamentId, seasonId, data) {
  const k = memKey(kind, tournamentId, seasonId);
  const entry = { data, savedAt: Date.now() };
  mem.set(k, entry);
  try { await idbSet(k, entry); } catch { /* storage full/blocked — mem cache still works */ }
  return entry;
}

async function dropCache(kind, tournamentId, seasonId) {
  const k = memKey(kind, tournamentId, seasonId);
  mem.delete(k);
  try { await idbDelete(k); } catch { /* ignore */ }
}

// ─── Public API (per dataset kind) ────────────────────────────────────────────
// Skater cache is v2: entries changed from { player, raw } (per-match tpl=21) to
// { player, norm } (season-aggregate tpl=226), so pre-refactor data is abandoned.
export const readPlayerCache  = (t, s)    => readCache('players_v2', t, s);
export const writePlayerCache = (t, s, d) => writeCache('players_v2', t, s, d);
export const dropPlayerCache  = (t, s)    => dropCache('players_v2', t, s);

// Goalie caches carry a version suffix so that data cached before the tpl=226 timeout
// fix (which stored empty advanced stats when the slow feed timed out) is abandoned and
// re-fetched cleanly. Bump this if the goalie cache shape/quality changes again.
const GOALIE_KIND     = 'goalies_v3';
const GOALIE_AGG_KIND = 'goalieAgg_v2';

export const readGoalieCache  = (t, s)    => readCache(GOALIE_KIND, t, s);
export const writeGoalieCache = (t, s, d) => writeCache(GOALIE_KIND, t, s, d);
export const dropGoalieCache  = (t, s)    => dropCache(GOALIE_KIND, t, s);

// Aggregated goalie stats (tpl=226) for a whole league, keyed { [playerId]: norm226 }.
// One tpl=226 call is league-wide and slow (~20s for big leagues), so caching it lets
// every goalie in that league render instantly on the comparison page after the first.
export async function readGoalieAgg(tournamentId, seasonId) {
  const k = memKey(GOALIE_AGG_KIND, tournamentId, seasonId);
  if (mem.has(k)) return mem.get(k);
  try {
    const record = await idbGet(k);
    if (record && record.map && typeof record.map === 'object') {
      const entry = { map: record.map, savedAt: record.savedAt ?? null };
      mem.set(k, entry);
      return entry;
    }
  } catch { /* IndexedDB blocked — fall through to null */ }
  return null;
}

export async function writeGoalieAgg(tournamentId, seasonId, map) {
  const k = memKey(GOALIE_AGG_KIND, tournamentId, seasonId);
  const entry = { map, savedAt: Date.now() };
  mem.set(k, entry);
  try { await idbSet(k, entry); } catch { /* storage full/blocked — mem cache still works */ }
  return entry;
}

// Wipe ALL cached stats (the IndexedDB store + in-memory layer) so the next load
// re-fetches from InStat. Deliberately touches only this cache DB — the watchlist and
// credentials live in localStorage and are left completely untouched.
export async function clearStatCaches() {
  mem.clear();
  dbPromise = null;
  if (typeof indexedDB === 'undefined') return;
  await new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}
