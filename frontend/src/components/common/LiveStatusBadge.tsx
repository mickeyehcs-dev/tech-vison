import React from 'react';
import { cn } from '../../utils/cn';
import { Radio } from 'lucide-react';

export interface LiveStatusBadgeProps {
  isLive?: boolean;
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

export const LiveStatusBadge: React.FC<LiveStatusBadgeProps> = ({
  isLive = false,
  className,
  showIcon = true,
  size = 'sm'
}) => {
  if (isLive) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 font-bold tracking-wider uppercase rounded-full border transition-all',
          'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-xs',
          size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
          className
        )}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
        </span>
        {showIcon && <Radio className="w-3 h-3 text-emerald-600 shrink-0" />}
        <span>LIVE</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-semibold tracking-wider uppercase rounded-full border transition-all',
        'bg-slate-100 text-slate-500 border-slate-200',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        className
      )}
    >
      <span className="inline-flex rounded-full h-1.5 w-1.5 bg-slate-400"></span>
      <span>OFFLINE</span>
    </span>
  );
};
