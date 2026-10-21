export default function CredentialsBadge({ hasCredentials, onOpen }) {
  return (
    <button
      onClick={onOpen}
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        hasCredentials
          ? 'border-emerald-700 bg-emerald-950 text-emerald-400 hover:border-emerald-500'
          : 'border-amber-700 bg-amber-950 text-amber-400 hover:border-amber-500'
      }`}
    >
      <span>{hasCredentials ? '✓' : '⚠'}</span>
      <span>{hasCredentials ? 'Credentials Set' : 'No Credentials'}</span>
      <span className="ml-1 text-slate-400">⚙️</span>
    </button>
  );
}
