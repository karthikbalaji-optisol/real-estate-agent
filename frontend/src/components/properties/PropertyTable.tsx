import type { Property } from '../../types/property';
import PropertyRow from './PropertyRow';

interface PropertyTableProps {
  properties: Property[];
}

const HEADERS = ['Location', 'BHK', 'Price', 'Plot Area', 'Facing', 'Date'];

export default function PropertyTable({ properties }: PropertyTableProps) {
  if (properties.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-slate-400">
        No properties found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            {HEADERS.map((h) => (
              <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {properties.map((p) => (
            <PropertyRow key={p.id} property={p} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
