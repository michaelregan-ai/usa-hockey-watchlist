import { GRADES, setGrade } from '../watchlist.js';

// Coach's A–D grade. Colors step down the same blue scale as the stat heatmap so an "A"
// reads like a top stat, without borrowing brand red.
export const GRADE_STYLE = {
  A: { background: 'rgb(31,111,235)', color: '#fff' },
  B: { background: 'rgb(42,79,150)',  color: '#fff' },
  C: { background: 'rgb(51,74,123)',  color: '#fff' },
  D: { background: 'rgb(59,69,96)',   color: '#fff' },
};

// Sort value: A highest, ungraded lowest (null sorts last like a missing stat).
export const gradeRank = (g) => (GRADES.includes(g) ? 4 - GRADES.indexOf(g) : null);

export default function GradePicker({ id, grade, size = 'sm' }) {
  const style = GRADE_STYLE[grade] ?? { background: 'transparent', color: '#7587a8' };
  const dims = size === 'lg' ? 'h-9 w-12 text-lg' : 'h-7 w-11 text-sm';
  return (
    <select
      value={grade || ''}
      onChange={(e) => setGrade(id, e.target.value)}
      onClick={(e) => e.stopPropagation()}
      title="Your grade for this player"
      aria-label="Grade"
      className={`${dims} cursor-pointer appearance-none rounded-md border border-slate-700 text-center font-display font-semibold focus:border-brand-500 focus:outline-none`}
      style={style}
    >
      <option value="">—</option>
      {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
    </select>
  );
}
