import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface PaginationProps {
  page: number;
  totalPages: number;
  total?: number;
  limit?: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  className
}) => {
  if (totalPages <= 1 && (!total || total <= (limit || 10))) return null;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-4 pt-4 text-xs text-slate-500',
        className
      )}
    >
      <div>
        {total !== undefined && limit !== undefined ? (
          <span>
            Showing <span className="font-semibold text-slate-900">{(page - 1) * limit + 1}</span> to{' '}
            <span className="font-semibold text-slate-900">{Math.min(page * limit, total)}</span> of{' '}
            <span className="font-semibold text-slate-900">{total}</span> records
          </span>
        ) : (
          <span>
            Page <span className="font-semibold text-slate-900">{page}</span> of{' '}
            <span className="font-semibold text-slate-900">{totalPages}</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="flex items-center justify-center p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-xs cursor-pointer"
          title="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1 px-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let p = i + 1;
            if (totalPages > 5) {
              if (page > 3 && page < totalPages - 2) {
                p = page - 2 + i;
              } else if (page >= totalPages - 2) {
                p = totalPages - 4 + i;
              }
            }

            const isActive = p === page;

            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={cn(
                  'min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center cursor-pointer',
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-xs'
                )}
              >
                {p}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="flex items-center justify-center p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-xs cursor-pointer"
          title="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
