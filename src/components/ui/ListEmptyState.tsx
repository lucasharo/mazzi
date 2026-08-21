import React from 'react';
import { Inbox } from 'lucide-react';

export interface ListEmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  id?: string;
}

/** Canonical empty-list presentation from Design System section 17. */
export const ListEmptyState: React.FC<ListEmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  id,
}) => (
  <div
    id={id || 'mazzi-list-empty-state'}
    className="mazzi-list-empty-state my-4 flex max-w-md flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center"
  >
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 shadow-xs">
      {icon || <Inbox className="h-7 w-7" aria-hidden="true" />}
    </div>
    <h3 className="mb-1 text-base font-bold leading-tight tracking-[-0.01em] text-slate-900">{title}</h3>
    <p className="mb-5 max-w-xs text-xs font-normal leading-relaxed text-slate-500">{description}</p>
    {action}
  </div>
);
