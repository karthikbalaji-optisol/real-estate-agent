import { useCallback, useEffect, useState } from 'react';
import type { Report } from '../types/property';
import { downloadReport, fetchReports, generateReport } from '../api/propertyApi';
import Spinner from '../components/ui/Spinner';

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchReports()
      .then(setReports)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await generateReport();
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <Spinner className="mt-32" />;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500">Generate and download property reports</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
        >
          {generating ? 'Generating...' : 'Generate Report'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-slate-500">Name</th>
              <th className="px-6 py-3 text-left font-medium text-slate-500">Type</th>
              <th className="px-6 py-3 text-left font-medium text-slate-500">Created</th>
              <th className="px-6 py-3 text-right font-medium text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reports.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400">No reports generated yet</td></tr>
            ) : reports.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-6 py-3 font-medium text-slate-800">{r.name}</td>
                <td className="px-6 py-3">
                  <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">{r.type}</span>
                </td>
                <td className="px-6 py-3 text-slate-500">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="px-6 py-3 text-right">
                  <button
                    onClick={() => downloadReport(r.id)}
                    className="text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                  >
                    Download
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
