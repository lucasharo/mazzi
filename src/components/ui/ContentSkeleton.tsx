import React from 'react';
import { Skeleton } from './Skeleton';

export interface ContentSkeletonProps {
  mode?: 'list' | 'object';
  count?: number;
  label?: string;
}

/** Loading state for the refreshed content region, keeping page chrome interactive. */
export const ContentSkeleton: React.FC<ContentSkeletonProps> = ({
  mode = 'list',
  count = 3,
  label = 'Atualizando conteúdo',
}) => (
  <div aria-busy="true" aria-label={label} className="space-y-3">
    {mode === 'object' ? (
      <div className="space-y-4 rounded-3xl border border-[var(--mazzi-border)] bg-white p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <Skeleton variant="circular" className="h-12 w-12 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton variant="text" className="w-2/3" />
            <Skeleton variant="text" className="w-1/2" />
          </div>
        </div>
        <Skeleton variant="rectangular" className="h-24 w-full" />
        <div className="flex gap-2">
          <Skeleton variant="rectangular" className="h-11 w-28" />
          <Skeleton variant="rectangular" className="h-11 w-32" />
        </div>
      </div>
    ) : (
      Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-3xl border border-[var(--mazzi-border)] bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <Skeleton variant="circular" className="h-11 w-11 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton variant="text" className="w-2/3" />
              <Skeleton variant="text" className="w-1/2" />
            </div>
            <Skeleton variant="rectangular" className="h-6 w-16" />
          </div>
          <Skeleton variant="text" className="mt-5 w-full" />
          <Skeleton variant="text" className="mt-2 w-4/5" />
        </div>
      ))
    )}
  </div>
);
