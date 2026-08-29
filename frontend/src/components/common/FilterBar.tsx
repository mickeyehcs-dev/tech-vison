import React from 'react';
import { cn } from '../../utils/cn';

export interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

export interface FilterBarProps {
  options: FilterOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  options,
  selectedValue,
  onSelect,
  className
}) => {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 border border-slate-200 rounded-xl', className)}>
      {options.map((opt) => {
        const isActive = opt.value === selectedValue;
        return (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 cursor-pointer',
              isActive
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/90'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            )}
          >
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span
                className={cn(
                  'px-1.5 py-0.2 rounded-full text-[10px] font-bold',
                  isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
