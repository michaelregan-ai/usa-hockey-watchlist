import { useState } from 'react';
import { addNote, deleteNote, today } from '../watchlist.js';

// "2026-12-03" → "12/3" (adds the year only when it isn't this year).
export function shortDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return y === new Date().getFullYear() ? `${m}/${d}` : `${m}/${d}/${String(y).slice(2)}`;
}

// Compact toggle showing the latest note — sits in the table's Note column / on a card.
export function NotesToggle({ notes = [], open, onToggle }) {
  const latest = notes[0];
  return (
    <button onClick={onToggle}
      className={`flex w-full max-w-64 items-center gap-2 rounded-md border px-2 py-1 text-left text-xs transition ${
        open ? 'border-brand-600 bg-brand-600/10 text-white' : 'border-slate-800 text-slate-300 hover:border-slate-600'
      }`}>
      <span className="shrink-0">📝</span>
      {latest
        ? <span className="truncate"><span className="text-slate-500">{shortDate(latest.date)}</span> {latest.text}</span>
        : <span className="text-slate-500">Add a note</span>}
      {notes.length > 1 && (
        <span className="ml-auto shrink-0 rounded-full bg-slate-800 px-1.5 text-[10px] text-slate-300">{notes.length}</span>
      )}
      <span className="shrink-0 text-slate-500">{open ? '▲' : '▼'}</span>
    </button>
  );
}

// Expanded log: add a dated note, read the full history, delete entries.
export function NotesPanel({ playerId, notes = [] }) {
  const [text, setText] = useState('');
  const [date, setDate] = useState(today());

  function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    addNote(playerId, text, date);
    setText('');
  }

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value || today())}
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100 focus:border-brand-500 focus:outline-none sm:w-40" />
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e); }}
          placeholder="e.g. vs Chicago — strong gap control, quick first pass"
          className="min-h-[2.75rem] flex-1 resize-y rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-brand-500 focus:outline-none" />
        <button type="submit" disabled={!text.trim()}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-40">
          Add note
        </button>
      </form>

      {notes.length === 0
        ? <p className="text-xs text-slate-500">No notes yet.</p>
        : (
          <ul className="space-y-1.5">
            {notes.map((n) => (
              <li key={n.id} className="group flex items-start gap-3 rounded-lg bg-slate-900/60 px-3 py-2">
                <span className="w-12 shrink-0 font-display text-sm font-semibold text-brand-400">{shortDate(n.date)}</span>
                <p className="flex-1 whitespace-pre-wrap text-sm text-slate-100">{n.text}</p>
                <button onClick={() => { if (confirm('Delete this note?')) deleteNote(playerId, n.id); }} title="Delete note"
                  className="shrink-0 text-xs text-slate-600 transition hover:text-rose-400">✕</button>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
