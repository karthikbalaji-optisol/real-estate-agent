import { useParams, Link } from 'react-router-dom';
import DetailField from '../components/ui/DetailField';
import Spinner from '../components/ui/Spinner';
import Badge from '../components/ui/Badge';
import { usePropertyDetail } from '../hooks/useProperties';

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: property, loading, error } = usePropertyDetail(id!);

  if (loading) return <Spinner className="mt-32" />;
  if (error) return <p className="mt-8 text-center text-red-500">{error}</p>;
  if (!property) return <p className="mt-8 text-center text-slate-400">Property not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/properties"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          &larr; Back
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">
          {property.location ?? 'Property'} {property.bhk != null && <Badge variant="info">{property.bhk} BHK</Badge>}
        </h1>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailField label="Price" value={property.price} />
          <DetailField label="BHK" value={property.bhk != null ? `${property.bhk} BHK` : null} />
          <DetailField label="Bathrooms" value={property.bathrooms} />
          <DetailField label="Plot Area" value={property.plotArea} />
          <DetailField label="Built-up Area" value={property.builtUpArea} />
          <DetailField label="Facing" value={property.facing} />
          <DetailField label="Floors" value={property.floors} />
          <DetailField label="Location" value={property.location} />
          <DetailField label="Source Email" value={property.sourceEmail} />
          <DetailField label="Added On" value={new Date(property.createdAt).toLocaleString()} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-500">Source URL</h2>
        <a
          href={property.url}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-sm text-indigo-600 hover:text-indigo-800"
        >
          {property.url}
        </a>
      </div>
    </div>
  );
}
