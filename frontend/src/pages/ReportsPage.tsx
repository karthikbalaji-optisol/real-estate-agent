import { useCallback, useEffect, useState } from 'react';
import type { Report } from '../types/property';
import { downloadReport, fetchReports, generateReport, fetchReport } from '../api/propertyApi';
import Spinner from '../components/ui/Spinner';

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [loadingReport, setLoadingReport] = useState<boolean>(false);

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

  const handleView = async (reportId: string) => {
    setLoadingReport(true);
    setError(null);
    try {
      const report = await fetchReport(reportId);
      setSelectedReport(report);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingReport(false);
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
                <td className={`px-6 py-3 font-medium ${loadingReport ? 'text-slate-400 cursor-wait' : 'text-slate-800 hover:text-indigo-800 cursor-pointer'}`} onClick={() => !loadingReport && handleView(r.id)}>{r.name}</td>
                <td className="px-6 py-3">
                  <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">{r.type}</span>
                </td>
                <td className="px-6 py-3 text-slate-500">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="px-6 py-3 text-right space-x-3">
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

      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-800">{selectedReport.name}</h2>
              <button onClick={() => setSelectedReport(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-slate-50">
              <pre className="whitespace-pre-wrap rounded bg-white p-4 text-sm text-slate-700 shadow-sm border border-slate-200 font-mono">
                {selectedReport.content || 'No content available'}
              </pre>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                onClick={() => setSelectedReport(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
              <button
                onClick={() => downloadReport(selectedReport.id)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
