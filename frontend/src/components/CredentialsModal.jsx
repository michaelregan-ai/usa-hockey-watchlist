import { useState } from 'react';

export default function CredentialsModal({ credentials, onSave, onClose }) {
  const [id, setId] = useState(credentials?.id ?? '');
  const [key, setKey] = useState(credentials?.key ?? '');
  const [error, setError] = useState('');

  function handleSave() {
    if (!id.trim() || !key.trim()) {
      setError('Both API ID and API Key are required.');
      return;
    }
    onSave({ id: id.trim(), key: key.trim() });
    onClose();
  }

  function handleClear() {
    setId('');
    setKey('');
    onSave(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <h2 className="mb-1 text-lg font-semibold text-slate-100">InStat API Credentials</h2>
        <p className="mb-5 text-sm text-slate-400">
          Credentials are stored in your browser's localStorage only — never sent anywhere except
          the InStat API.
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">API ID</label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="Your InStat API ID"
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-ice-500 focus:outline-none focus:ring-1 focus:ring-ice-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">API Key</label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Your InStat API Key"
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-ice-500 focus:outline-none focus:ring-1 focus:ring-ice-500"
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSave}
            className="flex-1 rounded-lg bg-ice-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ice-500"
          >
            Save Credentials
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
          >
            Cancel
          </button>
          {credentials && (
            <button
              onClick={handleClear}
              className="rounded-lg border border-rose-800 px-4 py-2 text-sm text-rose-400 transition hover:border-rose-600 hover:text-rose-300"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
