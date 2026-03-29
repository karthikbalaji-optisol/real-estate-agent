import { useCallback, useEffect, useState } from 'react';
import {
  fetchTriggerDetail,
  fetchTriggers,
  triggerManualCheck,
} from '../api/propertyApi';
import type { ManualTrigger } from '../types/property';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  running: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

const LEVEL_STYLES: Record<string, string> = {
  info: 'text-slate-600',
  warn: 'text-amber-600',
  error: 'text-red-600',
};

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function duration(start: string, end: string | null): string {
  if (!end) return 'running...';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function ManualTriggerPage() {
  const [triggers, setTriggers] = useState<ManualTrigger[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detailMap, setDetailMap] = useState<Record<string, ManualTrigger>>({});
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTriggers = useCallback(async () => {
    try {
      const list = await fetchTriggers();
      setTriggers(list);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadTriggers();
  }, [loadTriggers]);

  const handleTrigger = async () => {
    setTriggering(true);
    setError(null);
    try {
      const created = await triggerManualCheck();
      setExpanded(created.requestId);
      await loadTriggers();
      pollUntilDone(created.requestId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTriggering(false);
    }
  };

  const pollUntilDone = (requestId: string) => {
    const interval = setInterval(async () => {
      try {
        const detail = await fetchTriggerDetail(requestId);
        setDetailMap((prev) => ({ ...prev, [requestId]: detail }));
        setTriggers((prev) =>
          prev.map((t) =>
            t.requestId === requestId ? { ...t, ...detail } : t,
          ),
        );
        if (detail.status === 'completed' || detail.status === 'failed') {
          clearInterval(interval);
        }
      } catch {
        clearInterval(interval);
      }
    }, 2000);
  };

  const toggleExpand = async (requestId: string) => {
    if (expanded === requestId) {
      setExpanded(null);
      return;
    }
    setExpanded(requestId);

    if (!detailMap[requestId]?.logs) {
      try {
        const detail = await fetchTriggerDetail(requestId);
        setDetailMap((prev) => ({ ...prev, [requestId]: detail }));
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manual Trigger</h1>
          <p className="text-sm text-slate-500">
            This Manual Trigger will check all enabled email accounts
          </p>
        </div>
        <button
          onClick={handleTrigger}
          disabled={triggering}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
        >
          {triggering ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Triggering...
            </>
          ) : (
            'Check Emails Now'
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {triggers.length === 0 && (
        <p className="text-sm text-slate-500">No triggers yet. Click the button above to start.</p>
      )}

      <div className="space-y-3">
        {triggers.map((t) => {
          const isOpen = expanded === t.requestId;
          const detail = detailMap[t.requestId];
          const logs = detail?.logs ?? [];

          return (
            <div
              key={t.requestId}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              {/* Accordion header */}
              <button
                onClick={() => toggleExpand(t.requestId)}
                className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50"
              >
                <div className="flex items-center gap-4">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[t.status] ?? 'bg-slate-100 text-slate-700'}`}
                  >
                    {t.status}
                  </span>
                  <span className="text-sm font-mono text-slate-500">
                    {t.requestId.slice(0, 8)}...
                  </span>
                  <span className="text-sm text-slate-700">
                    {formatTime(t.startedAt)}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden gap-4 text-xs text-slate-500 sm:flex">
                    <span>{t.accountsChecked} accounts</span>
                    <span>{t.emailsFound} emails</span>
                    <span>{t.urlsExtracted} URLs</span>
                    <span>{duration(t.startedAt, t.endedAt)}</span>
                  </div>
                  <svg
                    className={`h-5 w-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </button>

              {/* Accordion body — logs */}
              {isOpen && (
                <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                  {/* Summary stats for mobile */}
                  <div className="mb-3 flex gap-4 text-xs text-slate-500 sm:hidden">
                    <span>{t.accountsChecked} accounts</span>
                    <span>{t.emailsFound} emails</span>
                    <span>{t.urlsExtracted} URLs</span>
                    <span>{duration(t.startedAt, t.endedAt)}</span>
                  </div>

                  <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                    <span>Started: {formatTime(t.startedAt)}</span>
                    <span>Ended: {formatTime(t.endedAt)}</span>
                  </div>

                  {logs.length === 0 && (
                    <p className="py-2 text-sm text-slate-400">Loading logs...</p>
                  )}

                  {logs.length > 0 && (
                    <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-slate-100">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-slate-600 w-40">
                              Time
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-slate-600 w-16">
                              Level
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-slate-600">
                              Message
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {logs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-50">
                              <td className="px-3 py-1.5 font-mono text-slate-400 whitespace-nowrap">
                                {new Date(log.createdAt).toLocaleTimeString()}
                              </td>
                              <td
                                className={`px-3 py-1.5 font-medium uppercase ${LEVEL_STYLES[log.level] ?? 'text-slate-600'}`}
                              >
                                {log.level}
                              </td>
                              <td className="px-3 py-1.5 text-slate-700">
                                {log.message}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
