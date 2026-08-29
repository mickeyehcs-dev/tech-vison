import React from 'react';
import { DeliveryStatus } from '../../types';
import { getStatusColor } from '../../utils/risk';
import { cn } from '../../utils/cn';

export interface StatusBadgeProps {
  status: DeliveryStatus;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const styles = getStatusColor(status);
  const label = status.replace('_', ' ');

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider border',
        styles.bg,
        styles.text,
        styles.border,
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', styles.text.replace('text-', 'bg-'))} />
      {label}
    </span>
  );
};
