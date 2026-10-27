import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { cx } from './ui';

/** Page numbers with ellipses: 1 … 4 5 [6] 7 8 … 20 */
function pageWindow(page, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, page, page - 1, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (page >= total - 2) [total - 1, total - 2, total - 3].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(`gap-${p}`);
    out.push(p);
  });
  return out;
}

export default function Pagination({ pagination, onPageChange, limit, onLimitChange, limits = [5, 10, 20, 50] }) {
  if (!pagination) return null;
  const { page, total_pages: totalPages, total_records: total, has_next_page: hasNext, has_previous_page: hasPrev } = pagination;
  const from = total === 0 ? 0 : (page - 1) * pagination.limit + 1;
  const to = Math.min(page * pagination.limit, total);

  const navBtn =
    'grid size-9 place-items-center rounded-lg border border-white/10 text-slate-300 transition-colors hover:border-white/20 hover:bg-white/[0.06] disabled:pointer-events-none disabled:opacity-30';

  return (
    <div className="flex flex-col gap-3 border-t border-white/[0.06] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex items-center gap-3 text-sm text-slate-400">
        <span>
          Showing <span className="font-medium text-slate-200 tabular-nums">{from}</span>–
          <span className="font-medium text-slate-200 tabular-nums">{to}</span> of{' '}
          <span className="font-medium text-slate-200 tabular-nums">{total}</span>
        </span>
        <select
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          className="h-8 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-xs text-slate-200 outline-none focus:border-indigo-400/70"
          aria-label="Rows per page"
        >
          {limits.map((l) => (
            <option key={l} value={l}>
              {l} / page
            </option>
          ))}
        </select>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          <button type="button" className={navBtn} disabled={!hasPrev} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
            <ChevronLeft className="size-4" />
          </button>
          {pageWindow(page, totalPages).map((p) =>
            typeof p === 'string' ? (
              <span key={p} className="px-1 text-slate-600">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={cx(
                  'relative grid h-9 min-w-9 place-items-center rounded-lg px-2 text-sm font-medium tabular-nums transition-colors',
                  p === page ? 'text-white' : 'text-slate-400 hover:bg-white/[0.06] hover:text-white',
                )}
                aria-current={p === page ? 'page' : undefined}
              >
                {p === page && (
                  <motion.span
                    layoutId="page-pill"
                    className="absolute inset-0 rounded-lg bg-gradient-to-r from-indigo-500/80 to-violet-500/80"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative">{p}</span>
              </button>
            ),
          )}
          <button type="button" className={navBtn} disabled={!hasNext} onClick={() => onPageChange(page + 1)} aria-label="Next page">
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
