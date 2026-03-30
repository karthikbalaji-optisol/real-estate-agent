import { useCallback, useEffect, useState } from 'react';
import type { EmailAccount, EmailProvider } from '../types/property';
import { createEmail, deleteEmail, fetchEmails, toggleEmail } from '../api/propertyApi';
import Spinner from '../components/ui/Spinner';

const PROVIDERS: { value: EmailProvider; label: string; isDisabled: boolean }[] = [
  { value: 'google', label:   'Google (Gmail)', isDisabled: false },
  { value: 'outlook', label: 'Outlook / Hotmail', isDisabled: true },
  { value: 'yahoo', label: 'Yahoo Mail', isDisabled: true },
];

const providerLabel = (provider: string) =>
  PROVIDERS.find((p) => p.value === provider)?.label ?? provider;

export default function EmailManagerPage() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [provider, setProvider] = useState<EmailProvider>('google');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchEmails()
      .then(setAccounts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      await createEmail(email, password, provider);
      setEmail('');
      setPassword('');
      setProvider('google');
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await toggleEmail(id, !enabled);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this email account?')) return;
    try {
      await deleteEmail(id);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const validityBadge = (isValid: boolean | null) => {
    if (isValid === true) return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"><span className="text-emerald-500">&#10003;</span> Valid</span>;
    if (isValid === false) return <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700"><span className="text-red-500">&#10007;</span> Invalid</span>;
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700"><span>&#9203;</span> Pending</span>;
  };

  if (loading) return <Spinner className="mt-32" />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Email Manager</h1>
        <p className="text-sm text-slate-500">Add and manage monitored email accounts for property detection</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="w-44">
          <label className="mb-1 block text-xs font-medium text-slate-500">Email Provider</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as EmailProvider)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value} disabled={p.isDisabled}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs font-medium text-slate-500">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@gmail.com"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            required
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs font-medium text-slate-500">App Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="App password"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            required
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
        >
          {submitting ? 'Adding...' : 'Add Email'}
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-slate-500">Email</th>
              <th className="px-6 py-3 text-left font-medium text-slate-500">Provider</th>
              <th className="px-6 py-3 text-left font-medium text-slate-500">Status</th>
              <th className="px-6 py-3 text-left font-medium text-slate-500">Enabled</th>
              <th className="px-6 py-3 text-right font-medium text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {accounts.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">No email accounts configured</td></tr>
            ) : accounts.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-6 py-3 font-medium text-slate-800">{a.email}</td>
                <td className="px-6 py-3">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {providerLabel(a.provider)}
                  </span>
                </td>
                <td className="px-6 py-3">{validityBadge(a.isValid)}</td>
                <td className="px-6 py-3">
                  <button
                    onClick={() => handleToggle(a.id, a.enabled)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${a.enabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${a.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </td>
                <td className="px-6 py-3 text-right">
                  <button onClick={() => handleDelete(a.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
