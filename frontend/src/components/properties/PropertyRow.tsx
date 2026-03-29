import { Link } from 'react-router-dom';
import Badge from '../ui/Badge';
import type { Property } from '../../types/property';

interface PropertyRowProps {
  property: Property;
}

export default function PropertyRow({ property }: PropertyRowProps) {
  return (
    <tr className="border-b border-slate-100 transition-colors hover:bg-slate-50">
      <td className="px-4 py-3">
        <Link to={`/properties/${property.id}`} className="font-medium text-indigo-600 hover:text-indigo-800">
          {property.location ?? '—'}
        </Link>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {property.bhk != null ? <Badge variant="info">{property.bhk} BHK</Badge> : '—'}
      </td>
      <td className="px-4 py-3 text-sm font-medium text-slate-800">{property.price ?? '—'}</td>
      <td className="px-4 py-3 text-sm text-slate-600">{property.plotArea ?? '—'}</td>
      <td className="px-4 py-3 text-sm text-slate-600">{property.facing ?? '—'}</td>
      <td className="px-4 py-3 text-sm text-slate-400">
        {new Date(property.createdAt).toLocaleDateString()}
      </td>
    </tr>
  );
}
