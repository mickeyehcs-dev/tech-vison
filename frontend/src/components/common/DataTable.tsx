import React from 'react';
import { LoadingState, EmptyState } from './EmptyState';
import { cn } from '../../utils/cn';

export interface Column<T> {
  header: string;
  accessor?: keyof T | ((row: T) => React.ReactNode);
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  className?: string;
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  loading = false,
  emptyTitle = 'No records found',
  emptyMessage = 'There are no items matching your criteria.',
  onRowClick,
  className
}: DataTableProps<T>) {
  if (loading) {
    return <LoadingState />;
  }

  if (!data || data.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <div className={cn('w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs', className)}>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
            {columns.map((col, idx) => (
              <th key={idx} className={cn('px-4 py-3.5 whitespace-nowrap', col.headerClassName)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white text-sm">
          {data.map((row, rowIdx) => (
            <tr
              key={row.id !== undefined ? String(row.id) : rowIdx}
              onClick={() => onRowClick && onRowClick(row)}
              className={cn(
                'transition-colors duration-150',
                onRowClick ? 'cursor-pointer hover:bg-slate-50' : 'hover:bg-slate-50/60'
              )}
            >
              {columns.map((col, colIdx) => {
                let cellValue: React.ReactNode = null;
                if (typeof col.accessor === 'function') {
                  cellValue = col.accessor(row);
                } else if (col.accessor) {
                  cellValue = (row as any)[col.accessor];
                }

                return (
                  <td
                    key={colIdx}
                    className={cn('px-4 py-3 text-slate-800 whitespace-nowrap font-medium', col.className)}
                  >
                    {cellValue}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
