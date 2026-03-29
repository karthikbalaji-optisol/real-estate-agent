interface DetailFieldProps {
  label: string;
  value: React.ReactNode;
}

export default function DetailField({ label, value }: DetailFieldProps) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
      <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-slate-800">{value ?? '—'}</span>
    </div>
  );
}
