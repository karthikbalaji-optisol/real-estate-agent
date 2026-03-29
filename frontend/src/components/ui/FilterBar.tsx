interface FilterBarProps {
  locations: string[];
  selectedLocation: string;
  onLocationChange: (value: string) => void;
  selectedBhk: string;
  onBhkChange: (value: string) => void;
}

export default function FilterBar({
  locations,
  selectedLocation,
  onLocationChange,
  selectedBhk,
  onBhkChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={selectedLocation}
        onChange={(e) => onLocationChange(e.target.value)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
      >
        <option value="">All Locations</option>
        {locations.map((loc) => (
          <option key={loc} value={loc}>{loc}</option>
        ))}
      </select>

      <select
        value={selectedBhk}
        onChange={(e) => onBhkChange(e.target.value)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
      >
        <option value="">All BHK</option>
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>{n} BHK</option>
        ))}
      </select>
    </div>
  );
}
