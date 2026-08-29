import React from 'react';
import { SensorStatus } from '../../types';
import { getSensorStatusColor } from '../../utils/risk';
import { cn } from '../../utils/cn';

export interface SensorStatusBadgeProps {
  status: SensorStatus;
  className?: string;
}

export const SensorStatusBadge: React.FC<SensorStatusBadgeProps> = ({ status, className }) => {
  const styles = getSensorStatusColor(status);

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
      {status}
    </span>
  );
};
