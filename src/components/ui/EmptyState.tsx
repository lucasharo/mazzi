import React from 'react';
import { Inbox, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  id?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  id,
}) => {
  return (
    <div
      id={id || 'mazzi-empty-state'}
      className="p-8 my-4 rounded-3xl border border-dashed border-slate-300 bg-slate-50/50 flex flex-col items-center justify-center text-center max-w-md mx-auto"
    >
      <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4 shadow-xs">
        {icon || <Inbox className="w-7 h-7" />}
      </div>
      <h3 className="text-base font-bold text-slate-900 mb-1">{title}</h3>
      <p className="text-xs text-slate-500 leading-relaxed max-w-xs mb-5">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  id?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Ocorreu um erro',
  message,
  onRetry,
  id,
}) => {
  return (
    <div
      id={id || 'mazzi-error-state'}
      className="p-6 my-4 rounded-3xl border border-rose-200 bg-rose-50/60 flex flex-col items-center justify-center text-center max-w-md mx-auto text-left"
    >
      <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-bold text-rose-950 mb-1">{title}</h3>
      <p className="text-xs text-rose-800/80 leading-relaxed mb-4 text-center">
        {message}
      </p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Tentar Novamente
        </Button>
      )}
    </div>
  );
};
