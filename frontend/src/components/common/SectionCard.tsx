import React from 'react';
import { cn } from '../../utils/cn';

export interface SectionCardProps {
  title?: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  noPadding?: boolean;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
  noPadding = false
}) => {
  return (
    <div
      className={cn(
        'bg-white border border-slate-200/90 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden',
        className
      )}
    >
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6 border-b border-slate-100 bg-white">
          <div>
            {typeof title === 'string' ? (
              <h3 className="text-base font-bold text-slate-900">{title}</h3>
            ) : (
              title
            )}
            {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={cn(!noPadding && 'p-5 sm:p-6', bodyClassName)}>{children}</div>
    </div>
  );
};
