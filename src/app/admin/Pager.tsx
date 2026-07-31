'use client';

/** Rows per page in the admin tables. */
export const PAGE_SIZE = 12;

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

/** The slice of rows for a page, clamped so an out-of-range page shows the last one. */
export function pageSlice<T>(rows: T[], page: number): T[] {
  const last = pageCount(rows.length);
  const current = Math.min(Math.max(1, page), last);
  const start = (current - 1) * PAGE_SIZE;
  return rows.slice(start, start + PAGE_SIZE);
}

export default function Pager({
  page,
  total,
  onPage,
  noun,
}: {
  page: number;
  total: number;
  onPage: (page: number) => void;
  noun: string;
}) {
  const last = pageCount(total);
  // Nothing to page through — say how many there are and stop.
  if (last <= 1) {
    return (
      <p className="pager-summary">
        {total} {total === 1 ? noun : `${noun}s`}
      </p>
    );
  }

  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="pager">
      <span className="pager-summary">
        {from}–{to} of {total} {total === 1 ? noun : `${noun}s`}
      </span>
      <div className="pager-controls">
        <button
          type="button"
          className="table-btn"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          ← Prev
        </button>
        <span className="pager-page">
          {page} / {last}
        </span>
        <button
          type="button"
          className="table-btn"
          disabled={page >= last}
          onClick={() => onPage(page + 1)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
