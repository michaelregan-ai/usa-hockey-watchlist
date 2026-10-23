import { useState, Fragment } from 'react';
import { PRIORITY_STATS, findValue, formatVal, parseNum } from '../stats.js';
import { GOALIE_STATS } from '../goalieStats.js';
import { remove } from '../watchlist.js';
import { getBio } from '../playerUtils.js';
import { NotesToggle, NotesPanel } from './Notes.jsx';
import GradePicker, { gradeRank } from './GradePicker.jsx';
import PlayerBio from './PlayerBio.jsx';

// ─── Column definitions (same stat keys as the comparison pages) ──────────────

const pick = (defs, list) => list.map(([label, short, lower]) => {
  const d = defs.find((s) => s.label === label);
  return d && { ...d, short, lowerIsBetter: lower ?? d.lowerIsBetter ?? false };
}).filter(Boolean);

export const SKATER_COLS = pick(PRIORITY_STATS, [
  ['Games Played', 'GP'], ['Goals', 'G'], ['Assists', 'A'], ['Points', 'P'], ['+/-', '+/-'],
  ['Avg Time on Ice', 'TOI'], ['xG/GP', 'xG/GP'], ['Net xG', 'Net xG'], ['Shots/GP', 'Sh/GP'],
  ['Shots on Goal/GP', 'SOG/GP'], ['Corsi', 'CORSI'], ['Faceoffs Won %', 'FO%'],
  ['Puck Battle Won %', 'PB%'], ['Accurate Pass %', 'Pass%'], ['Hits/GP', 'Hits/GP'],
  ['Takeaways/GP', 'TA/GP'], ['Giveaways/GP', 'GA/GP', true],
]);

// Sort key for the coach's grade column (not a stat, so it lives outside cols).
export const GRADE_KEY = 'Grade';

// Stats shown on phone cards, by short label.
const CARD_STATS = { Skaters: ['GP', 'G', 'A', 'P', 'xG/GP'], Goalies: ['GP', 'W', 'SV%', 'GA', 'xGA'] };

export const GOALIE_COLS = pick(GOALIE_STATS, [
  ['Games Played', 'GP'], ['Games Started', 'GS'], ['Games Won', 'W'], ['Games Lost', 'L'],
  ['Goals Against', 'GA'], ['Shots Faced', 'SA'], ['Saves', 'SV'], ['Save %', 'SV%'],
  ['Accurate Pass %', 'Pass%'], ['xG Conceded', 'xGA'], ['xG/Shot Taken', 'xG/Sh'],
  ['xG/Goal Conceded', 'xG/GA'], ['xG/Shot Saved', 'xG/SV'], ['Scoring Chances Against', 'SCA'],
  ['Scoring Chances Saved', 'SC SV'], ['Scoring Chances Saved %', 'SC SV%'], ['Breakaway Save %', 'BA SV%'],
  ['Shots - With Traffic %', 'Traffic%'], ['Shots - Clear View %', 'Clear%'], ['Shots - With Deke %', 'Deke%'],
  ['Shots <2m %', '<2m%'], ['Shots 2-4m %', '2-4m%'], ['Shots 4-10m %', '4-10m%'], ['Shots 10+m %', '10m+%'],
  ['Uncontrolled Rebounds %', 'UncReb%'], ['Controlled Rebounds %', 'CtrlReb%'], ['Shots Frozen %', 'Frozen%'],
  ['Goals Against Avg Dist', 'GA Dist'],
]);

// ─── Heatmap (identical to Team Rankings) ─────────────────────────────────────

// Grey-navy (worst) → mid blue → bright blue (best). Every stop keeps white text readable
// and stays clear of brand red, which is reserved for actions.
const HEAT_STOPS = [[59, 69, 96], [42, 79, 150], [31, 111, 235]];
function heatmapBg(pct) {
  const seg = pct <= 0.5 ? 0 : 1;
  const t = seg === 0 ? pct / 0.5 : (pct - 0.5) / 0.5;
  const [a, b] = [HEAT_STOPS[seg], HEAT_STOPS[seg + 1]];
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function cellStyle(value, allValues, lowerIsBetter) {
  const nums = allValues.map((v) => parseNum(v)).filter((n) => n !== null);
  if (nums.length < 2) return null;
  const n = parseNum(value);
  if (n === null) return null;
  const min = Math.min(...nums), max = Math.max(...nums);
  if (max === min) return { background: heatmapBg(0.5), color: '#fff' };
  let pct = (n - min) / (max - min);
  if (lowerIsBetter) pct = 1 - pct;
  return { background: heatmapBg(pct), color: '#fff', fontWeight: 500 };
}

function InStatLink({ id }) {
  return (
    <a href={`https://app.hudl.com/instat/hockey/players/${id}`} target="_blank" rel="noopener noreferrer"
       title="Open player on InStat" className="inline-flex shrink-0 items-center">
      <img src="/instat-logo.png" alt="InStat" className="h-4 w-4 rounded" />
    </a>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

// Saved column order (list of stat labels) per table, kept in this browser.
const orderKey = (title) => `usah_col_order_${title.toLowerCase()}`;
function loadOrder(title) {
  try { const o = JSON.parse(localStorage.getItem(orderKey(title))); return Array.isArray(o) ? o : null; } catch { return null; }
}
function saveOrder(title, order) {
  try { if (order) localStorage.setItem(orderKey(title), JSON.stringify(order)); else localStorage.removeItem(orderKey(title)); } catch { /* private mode */ }
}

// rows: [{ entry, norm | null }]
export default function WatchlistTable({ title, accent, rows, cols: allCols }) {
  const [order, setOrder]       = useState(() => loadOrder(title));
  const [dragLabel, setDragLabel] = useState(null);
  const [overLabel, setOverLabel] = useState(null);

  // Saved order first (skipping stats that no longer exist), then any new stats at the end.
  const byLabel = Object.fromEntries(allCols.map((c) => [c.label, c]));
  const cols = order
    ? [...order.filter((l) => byLabel[l]).map((l) => byLabel[l]), ...allCols.filter((c) => !order.includes(c.label))]
    : allCols;

  function moveColumn(from, to) {
    if (!from || from === to) return;
    const labels = cols.map((c) => c.label).filter((l) => l !== from);
    labels.splice(labels.indexOf(to), 0, from);
    setOrder(labels); saveOrder(title, labels);
  }
  function resetOrder() { setOrder(null); saveOrder(title, null); }

  const [sortKey, setSortKey] = useState(cols.find((c) => c.short === 'P' || c.short === 'SV%')?.label ?? cols[0].label);
  const [sortAsc, setSortAsc] = useState(false);
  const [openNotes, setOpenNotes] = useState(null); // player id whose note log is expanded
  const toggleNotes = (id) => setOpenNotes((cur) => (cur === id ? null : id));

  if (rows.length === 0) return null;

  function handleSort(label) {
    if (sortKey === label) setSortAsc((a) => !a);
    else { setSortKey(label); setSortAsc(false); }
  }

  const sortCol = cols.find((c) => c.label === sortKey);
  const val = (r, c) => (r.norm ? findValue(r.norm, c.keys) : null);
  const sortVal = (r) => (sortKey === GRADE_KEY ? gradeRank(r.entry.grade) : parseNum(val(r, sortCol)));
  const sorted = [...rows].sort((a, b) => {
    const va = sortVal(a), vb = sortVal(b);
    if (va === null && vb === null) return a.entry.name.localeCompare(b.entry.name);
    if (va === null) return 1;
    if (vb === null) return -1;
    return sortAsc ? va - vb : vb - va;
  });

  const colVals = {};
  for (const c of cols) colVals[c.label] = rows.map((r) => val(r, c));

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5" style={{ background: '#06204a' }}>
        <h3 className={`font-display text-lg font-semibold uppercase tracking-wide ${accent}`}>{title}</h3>
        <div className="flex items-center gap-3">
          {order && (
            <button onClick={resetOrder} className="text-xs text-slate-500 transition hover:text-brand-400">
              Reset column order
            </button>
          )}
          <span className="text-xs text-slate-500">{rows.length}</span>
        </div>
      </div>
      <PlayerCards title={title} rows={sorted} cols={cols} colVals={colVals} val={val}
        sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} openNotes={openNotes} onToggleNotes={toggleNotes} />
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-xs tabular-nums">
          <thead>
            <tr className="border-b border-slate-800" style={{ background: '#06204a' }}>
              <th className="sticky left-0 z-20 w-8 px-3 py-2.5 text-left font-display text-sm font-semibold uppercase tracking-wider text-slate-500" style={{ background: '#06204a' }}>#</th>
              <th className="sticky left-8 z-20 min-w-56 border-r border-slate-800 px-3 py-2.5 text-left font-display text-sm font-semibold uppercase tracking-wider text-slate-400" style={{ background: '#06204a' }}>Player</th>
              <th onClick={() => handleSort(GRADE_KEY)} title="Your A–D grade"
                  className="cursor-pointer select-none whitespace-nowrap border-r border-slate-800 px-2 py-2.5 text-center font-display text-sm font-semibold uppercase tracking-wider"
                  style={{ color: sortKey === GRADE_KEY ? '#ec5a6e' : '#b3c0d6' }}>
                Grade&nbsp;{sortKey === GRADE_KEY ? (sortAsc ? '▲' : '▼') : <span style={{ color: '#4f6189' }}>↕</span>}
              </th>
              {cols.map((c) => {
                const active = sortKey === c.label;
                return (
                  <th key={c.label} onClick={() => handleSort(c.label)}
                      draggable
                      onDragStart={(e) => { setDragLabel(c.label); e.dataTransfer.effectAllowed = 'move'; }}
                      onDragOver={(e) => { e.preventDefault(); if (overLabel !== c.label) setOverLabel(c.label); }}
                      onDrop={(e) => { e.preventDefault(); moveColumn(dragLabel, c.label); }}
                      onDragEnd={() => { setDragLabel(null); setOverLabel(null); }}
                      className="group relative cursor-grab select-none whitespace-nowrap px-2 py-2.5 text-right font-display text-sm font-semibold uppercase tracking-wider transition-colors active:cursor-grabbing"
                      style={{
                        color: active ? '#ec5a6e' : '#b3c0d6',
                        opacity: dragLabel === c.label ? 0.4 : 1,
                        boxShadow: overLabel === c.label && dragLabel && dragLabel !== c.label ? 'inset 2px 0 0 #ec5a6e' : undefined,
                      }}>
                    {c.short}&nbsp;{active ? (sortAsc ? '▲' : '▼') : <span style={{ color: '#4f6189' }}>↕</span>}
                    <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-slate-700 px-2 py-1 text-xs font-normal normal-case tracking-normal text-slate-100 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                      {c.label}
                    </span>
                  </th>
                );
              })}
              <th className="px-3 py-2.5 text-left font-display text-sm font-semibold uppercase tracking-wider text-slate-500">Notes</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ entry: e, norm, loading }, i) => (
              <Fragment key={e.id}>
              <tr className="border-b border-slate-900 transition-all hover:brightness-110"
                  style={{ background: i % 2 === 0 ? '#05193a' : '#081e44' }}>
                <td className="sticky left-0 z-10 px-3 py-2 font-bold text-slate-600" style={{ background: 'inherit' }}>{i + 1}</td>
                <td className="sticky left-8 z-10 border-r border-slate-800 px-3 py-2" style={{ background: 'inherit' }}>
                  <div className="flex items-center gap-2">
                    <a href={`https://app.hudl.com/instat/hockey/players/${e.id}`} target="_blank" rel="noopener noreferrer"
                       className="truncate font-display text-base font-semibold text-white hover:text-brand-400 hover:underline">{e.name}</a>
                    <InStatLink id={e.id} />
                  </div>
                  <p className="max-w-64 truncate text-[11px] text-slate-500">
                    {[e.team, e.leagueName, e.seasonName].filter(Boolean).join(' · ')}
                  </p>
                  <PlayerBio player={e} isGoalie={e.isGoalie} variant="inline" />
                </td>
                <td className="border-r border-slate-800 px-2 py-2 text-center"><GradePicker id={e.id} grade={e.grade} /></td>
                {cols.map((c) => {
                  const v = val({ norm }, c);
                  const style = cellStyle(v, colVals[c.label], c.lowerIsBetter);
                  return (
                    <td key={c.label} className="whitespace-nowrap px-2 py-2 text-right font-display text-sm" style={style ?? { color: v != null ? '#f1f5f9' : '#7587a8' }}>
                      {loading ? '…' : v != null ? formatVal(v, c.format) : '—'}
                    </td>
                  );
                })}
                <td className="px-3 py-2"><NotesToggle notes={e.notes} open={openNotes === e.id} onToggle={() => toggleNotes(e.id)} /></td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => remove(e.id)} title="Remove from watchlist"
                    className="rounded-md border border-slate-800 px-2 py-1 text-xs text-slate-500 transition hover:border-rose-700 hover:text-rose-400">
                    ✕
                  </button>
                </td>
              </tr>
              {openNotes === e.id && (
                <tr className="border-b border-slate-800" style={{ background: '#0a2350' }}>
                  <td colSpan={cols.length + 5} className="px-4 py-3">
                    <div className="sticky left-4 max-w-3xl">
                      <p className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-white">Notes · {e.name}</p>
                      <NotesPanel playerId={e.id} notes={e.notes} />
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="hidden border-t border-slate-800 px-4 py-2 text-xs text-slate-600 md:block" style={{ background: '#06204a' }}>
        Click any column to sort · Drag headers to reorder · Bright blue = best · Grey = worst among players on your watchlist · Click a name to open InStat
      </div>
    </div>
  );
}

// ─── Phone cards ──────────────────────────────────────────────────────────────

function PlayerCards({ title, rows, cols, colVals, val, sortKey, sortAsc, onSort, openNotes, onToggleNotes }) {
  const keyCols = (CARD_STATS[title] ?? []).map((sh) => cols.find((c) => c.short === sh)).filter(Boolean);
  return (
    <div className="md:hidden">
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2" style={{ background: '#06204a' }}>
        <label className="text-xs text-slate-500">Sort by</label>
        <select value={sortKey} onChange={(e) => onSort(e.target.value)}
          className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:outline-none">
          <option value={GRADE_KEY}>My grade</option>
          {cols.map((c) => <option key={c.label} value={c.label}>{c.label}</option>)}
        </select>
        <button onClick={() => onSort(sortKey)} title="Flip sort direction"
          className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300">{sortAsc ? '▲ Low' : '▼ High'}</button>
      </div>
      <ul className="divide-y divide-slate-800">
        {rows.map(({ entry: e, norm, loading }, i) => {
          const b = getBio(e) ?? {};
          const meta = [b.position, b.birthYear && `'${b.birthYear.slice(2)}`, e.team].filter(Boolean).join(' · ');
          return (
            <li key={e.id} className="px-4 py-3" style={{ background: i % 2 === 0 ? '#05193a' : '#081e44' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <a href={`https://app.hudl.com/instat/hockey/players/${e.id}`} target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-2 font-display text-lg font-semibold leading-tight text-white">
                    <span className="truncate">{e.name}</span>
                    <img src="/instat-logo.png" alt="InStat" className="h-4 w-4 shrink-0 rounded" />
                  </a>
                  <p className="truncate text-xs text-slate-400">{meta || '—'}</p>
                  <p className="truncate text-[11px] text-slate-500">{[e.leagueName, e.seasonName].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <GradePicker id={e.id} grade={e.grade} size="lg" />
                  <button onClick={() => remove(e.id)} title="Remove from watchlist"
                    className="rounded-md border border-slate-800 px-2.5 py-1.5 text-xs text-slate-500 hover:text-rose-400">✕</button>
                </div>
              </div>
              <div className="mt-2.5 grid gap-1.5 tabular-nums" style={{ gridTemplateColumns: `repeat(${keyCols.length}, minmax(0, 1fr))` }}>
                {keyCols.map((c) => {
                  const v = val({ norm }, c);
                  const style = cellStyle(v, colVals[c.label], c.lowerIsBetter);
                  return (
                    <div key={c.label} className="rounded-md px-1 py-1.5 text-center" style={style ?? { background: '#0c2550', color: v != null ? '#f1f5f9' : '#7587a8' }}>
                      <div className="font-display text-[11px] uppercase tracking-wide opacity-75">{c.short}</div>
                      <div className="font-display text-lg font-semibold leading-tight">{loading ? '…' : v != null ? formatVal(v, c.format) : '—'}</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2.5">
                <NotesToggle notes={e.notes} open={openNotes === e.id} onToggle={() => onToggleNotes(e.id)} />
                {openNotes === e.id && <div className="mt-2"><NotesPanel playerId={e.id} notes={e.notes} /></div>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
