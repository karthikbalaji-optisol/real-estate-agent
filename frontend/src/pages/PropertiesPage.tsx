import { useState, useCallback } from 'react';
import FilterBar from '../components/ui/FilterBar';
import Pagination from '../components/ui/Pagination';
import Spinner from '../components/ui/Spinner';
import PropertyTable from '../components/properties/PropertyTable';
import { usePropertyList } from '../hooks/useProperties';
import { useSocket, type SocketMessage } from '../hooks/useSocket';

export default function PropertiesPage() {
  const [page, setPage] = useState(1);
  const [location, setLocation] = useState('');
  const [bhk, setBhk] = useState('');

  const filters = {
    page,
    limit: 20,
    location: location || undefined,
    bhk: bhk ? Number(bhk) : undefined,
  };
  const { data, loading, error, reload } = usePropertyList(filters);

  const handleSocketMessage = useCallback((msg: SocketMessage) => {
    if (msg.type === 'property_created' || msg.type === 'property_updated') {
      reload();
    }
  }, [reload]);

  useSocket(handleSocketMessage);

  const handleLocationChange = (v: string) => { setLocation(v); setPage(1); };
  const handleBhkChange = (v: string) => { setBhk(v); setPage(1); };

  const locations = data ? [...new Set(data.data.map(p => p.location).filter(Boolean) as string[])] : [];
  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Properties</h1>
          <p className="text-sm text-slate-500">
            {data ? `${data.total} total properties` : 'Loading...'}
          </p>
        </div>
        <FilterBar
          locations={locations}
          selectedLocation={location}
          onLocationChange={handleLocationChange}
          selectedBhk={bhk}
          onBhkChange={handleBhkChange}
        />
      </div>

      {loading && <Spinner className="mt-16" />}
      {error && <p className="mt-8 text-center text-red-500">{error}</p>}

      {data && !loading && (
        <>
          <PropertyTable properties={data.data} />
          <div className="flex justify-center">
            <Pagination page={data.page} pages={totalPages} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
