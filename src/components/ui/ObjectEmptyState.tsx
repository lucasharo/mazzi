import React from 'react';
import { Inbox } from 'lucide-react';

export interface ObjectEmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  id?: string;
}

/** Global empty state for a single object/widget, distinct from list empty states. */
export const ObjectEmptyState: React.FC<ObjectEmptyStateProps> = ({
  title,
  description,
  action,
  icon,
  id,
}) => (
  <div
    id={id || 'mazzi-object-empty-state'}
    className="mazzi-object-empty-state rounded-2xl bg-[var(--mazzi-dark)] px-6 py-7 text-center text-white"
  >
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
      {icon || <Inbox className="h-6 w-6" aria-hidden="true" />}
    </div>
    <h3 className="mt-4 text-base font-bold leading-tight tracking-[-0.01em]">{title}</h3>
    <p className="mx-auto mt-1 max-w-xs text-xs font-normal leading-relaxed text-slate-300">{description}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>
);
