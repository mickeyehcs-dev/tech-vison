import React from 'react';
import { cn } from '../../utils/cn';

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  subtitle?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  variant?: 'default' | 'emerald' | 'amber' | 'rose' | 'sky';
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  subtitle,
  trend,
  variant = 'default',
  className
}) => {
  const variantStyles = {
    default: {
      border: 'border-slate-200/90',
      iconBg: 'bg-slate-100 text-slate-700',
      glow: ''
    },
    emerald: {
      border: 'border-emerald-200 bg-emerald-50/40',
      iconBg: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
      glow: ''
    },
    amber: {
      border: 'border-amber-200 bg-amber-50/40',
      iconBg: 'bg-amber-100 text-amber-700 border border-amber-200',
      glow: ''
    },
    rose: {
      border: 'border-rose-200 bg-rose-50/40',
      iconBg: 'bg-rose-100 text-rose-700 border border-rose-200',
      glow: ''
    },
    sky: {
      border: 'border-sky-200 bg-sky-50/40',
      iconBg: 'bg-sky-100 text-sky-700 border border-sky-200',
      glow: ''
    }
  };

  const v = variantStyles[variant];

  return (
    <div
      className={cn(
        'relative bg-white rounded-2xl border p-5 shadow-xs hover:shadow-md transition-all duration-200',
        v.border,
        v.glow,
        className
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-black text-slate-900 mt-1 tracking-tight">{value}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
          {trend && (
            <p
              className={cn(
                'text-xs font-semibold mt-1.5 flex items-center gap-1',
                trend.isPositive ? 'text-emerald-600' : 'text-rose-600'
              )}
            >
              {trend.isPositive ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-xs', v.iconBg)}>
          {icon}
        </div>
      </div>
    </div>
  );
};
