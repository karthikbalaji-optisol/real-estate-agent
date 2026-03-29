import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import StatCard from '../components/ui/StatCard';
import Spinner from '../components/ui/Spinner';
import { useSocket, type SocketMessage } from '../hooks/useSocket';
import { fetchProperties } from '../api/propertyApi';
import type { PaginatedResponse } from '../types/property';
import { useEffect } from 'react';

export default function DashboardPage() {
  const [stats, setStats] = useState<{ total: number; locations: number; bhkTypes: Set<number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveCount, setLiveCount] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    fetchProperties({ page: 1, limit: 1000 })
      .then((res: PaginatedResponse) => {
        const locations = new Set(res.data.map(p => p.location).filter(Boolean));
        const bhks = new Set(res.data.map(p => p.bhk).filter((b): b is number => b != null));
        setStats({ total: res.total, locations: locations.size, bhkTypes: bhks });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSocketMessage = useCallback((msg: SocketMessage) => {
    if (msg.type === 'property_created' || msg.type === 'property_updated') {
      setLiveCount((c) => c + 1);
      load();
    }
  }, [load]);

  const { connected } = useSocket(handleSocketMessage);

  if (loading) return <Spinner className="mt-32" />;
  if (error) return <p className="mt-8 text-center text-red-500">{error}</p>;
  if (!stats) return null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${connected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              {connected ? 'Live' : 'Offline'}
            </span>
            {liveCount > 0 && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                +{liveCount} new
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">Overview of the Real Estate Intelligence Platform</p>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Total Properties" value={stats.total} icon={<HomeIcon />} />
        <StatCard title="Locations" value={stats.locations} icon={<MapIcon />} />
        <StatCard title="BHK Types" value={stats.bhkTypes.size} icon={<LayersIcon />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Link to="/emails" className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
          <EmailIcon />
          <h3 className="mt-3 font-semibold text-slate-800 group-hover:text-indigo-600">Email Manager</h3>
          <p className="text-sm text-slate-500">Configure monitored email accounts</p>
        </Link>
        <Link to="/trigger" className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
          <TriggerIcon />
          <h3 className="mt-3 font-semibold text-slate-800 group-hover:text-indigo-600">Manual Trigger</h3>
          <p className="text-sm text-slate-500">Instant scanning for a new mail for fetching the Properties</p>
        </Link>
        <Link to="/reports" className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
          <ReportIcon />
          <h3 className="mt-3 font-semibold text-slate-800 group-hover:text-indigo-600">Reports</h3>
          <p className="text-sm text-slate-500">Generate and download property reports</p>
        </Link>
      </div>
    </div>
  );
}

function HomeIcon() {
  return (
    <svg className="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg className="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg className="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0 4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0-5.571 3-5.571-3" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg className="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
    </svg>
  );
}

function TriggerIcon() {
  return (
    <svg className="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg className="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}
