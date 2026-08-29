import React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
  className
}) => {
  return (
    <div className={cn('relative flex items-center w-full max-w-xs', className)}>
      <div className="absolute left-3 text-slate-400 pointer-events-none flex items-center">
        <Search className="w-4 h-4" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 placeholder:text-slate-400 shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2.5 text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded cursor-pointer"
          title="Clear"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
