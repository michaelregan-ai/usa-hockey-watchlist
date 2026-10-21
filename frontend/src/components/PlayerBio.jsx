import { getBio } from '../playerUtils.js';

// Compact bio block: photo + position/number, height/weight, shoots-or-catches / age / nationality.
// All fields are optional — anything missing is simply omitted.
export default function PlayerBio({ player, isGoalie = false, align = 'center', variant = 'full' }) {
  const b = getBio(player);
  if (!b) return null;

  const hand = b.hand ? `${isGoalie ? 'Catches' : 'Shoots'} ${b.hand.charAt(0).toUpperCase()}` : '';

  // Dense single line for list rows: 6'5" · 218 lb · Shoots L · 21y · Canada (no photo).
  if (variant === 'inline') {
    const short = (s) => (s || '').replace(/\s*\(.*/, '');
    const parts = [short(b.height), short(b.weight), hand, b.age ? `${b.age}y` : '', b.nationality].filter(Boolean);
    if (parts.length === 0) return null;
    return <p className="truncate text-[11px] text-slate-500">{parts.join(' · ')}</p>;
  }
  const posLine = [b.position, b.number ? `#${b.number}` : ''].filter(Boolean).join(' · ');
  const sizeLine = [b.height, b.weight].filter(Boolean).join(' · ');
  const bioLine = [hand, b.age ? `Age ${b.age}${b.birthYear ? ` ('${b.birthYear.slice(2)})` : ''}` : '', b.nationality].filter(Boolean).join(' · ');

  if (!b.photo && !posLine && !sizeLine && !bioLine) return null;

  const alignItems = align === 'left' ? 'items-start text-left' : 'items-center text-center';

  return (
    <div className={`mt-1 flex flex-col gap-0.5 text-[11px] leading-tight text-slate-500 ${alignItems}`}>
      {b.photo && (
        <img
          src={b.photo}
          alt=""
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
          className="mb-1 h-12 w-12 rounded-full bg-slate-800 object-cover ring-1 ring-slate-700"
        />
      )}
      {posLine && <span className="text-slate-400">{posLine}</span>}
      {sizeLine && <span>{sizeLine}</span>}
      {bioLine && <span>{bioLine}</span>}
    </div>
  );
}
