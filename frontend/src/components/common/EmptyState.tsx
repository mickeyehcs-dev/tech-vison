import React from 'react';
import { PackageOpen, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../utils/cn';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  message,
  actionText,
  onAction,
  className
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50',
        className
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-4 shadow-xs">
        {icon || <PackageOpen className="w-7 h-7" />}
      </div>
      <h4 className="text-base font-bold text-slate-900 mb-1.5">{title}</h4>
      {message && <p className="text-xs text-slate-500 max-w-sm mb-5 leading-relaxed">{message}</p>}
      {actionText && onAction && (
        <Button size="sm" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
};

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading data...',
  className
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-10 text-center text-slate-500 gap-3',
        className
      )}
    >
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      <p className="text-xs font-semibold text-slate-600">{message}</p>
    </div>
  );
};

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Failed to load content',
  message = 'An unexpected error occurred while communicating with the server.',
  onRetry,
  className
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 sm:p-10 text-center rounded-2xl border border-rose-200 bg-rose-50/50',
        className
      )}
    >
      <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h4 className="text-sm font-bold text-rose-900 mb-1">{title}</h4>
      <p className="text-xs text-slate-600 max-w-sm mb-4">{message}</p>
      {onRetry && (
        <Button
          size="sm"
          variant="outline"
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          onClick={onRetry}
        >
          Try Again
        </Button>
      )}
    </div>
  );
};
