interface PaginationProps {
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, pages, onPageChange }: PaginationProps) {
  if (pages <= 1) return null;

  const range: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(pages, page + 2);
  for (let i = start; i <= end; i++) range.push(i);

  return (
    <nav className="flex items-center gap-1">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Previous
      </button>

      {start > 1 && (
        <>
          <button onClick={() => onPageChange(1)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">1</button>
          {start > 2 && <span className="px-2 text-slate-400">...</span>}
        </>
      )}

      {range.map((n) => (
        <button
          key={n}
          onClick={() => onPageChange(n)}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            n === page
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {n}
        </button>
      ))}

      {end < pages && (
        <>
          {end < pages - 1 && <span className="px-2 text-slate-400">...</span>}
          <button onClick={() => onPageChange(pages)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">{pages}</button>
        </>
      )}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pages}
        className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Next
      </button>
    </nav>
  );
}
