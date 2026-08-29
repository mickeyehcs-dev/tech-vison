import React from 'react';
import { RiskLevel } from '../../types';
import { getRiskColor } from '../../utils/risk';
import { cn } from '../../utils/cn';

export interface RiskBadgeProps {
  level: RiskLevel;
  className?: string;
  showScore?: boolean;
  score?: number;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ level, score, showScore, className }) => {
  const styles = getRiskColor(level);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border',
        styles.badge,
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', styles.text.replace('text-', 'bg-'))} />
      <span>{level} RISK</span>
      {showScore && score !== undefined && (
        <span className="opacity-80 font-normal">({score.toFixed(1)})</span>
      )}
    </span>
  );
};
