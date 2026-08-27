import React from 'react';
import { Skeleton } from './Skeleton';

export type ContentSkeletonMode = 'list' | 'object' | 'dashboard' | 'split' | 'analytics' | 'form';

export interface ContentSkeletonProps {
  mode?: ContentSkeletonMode;
  count?: number;
  label?: string;
}

/** Loading state for the refreshed content region, keeping page chrome interactive. */
export const ContentSkeleton: React.FC<ContentSkeletonProps> = ({
  mode = 'list',
  count = 3,
  label = 'Atualizando conteúdo',
}) => {
  if (mode === 'dashboard') {
    return (
      <div aria-busy="true" aria-label={label} className="space-y-6">
        <div className="space-y-2">
          <Skeleton variant="text" className="h-6 w-56" />
          <Skeleton variant="text" className="w-80 max-w-full" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} variant="card" className="h-48" />)}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton variant="card" className="h-56" />
          <Skeleton variant="card" className="h-56" />
        </div>
      </div>
    );
  }

  if (mode === 'split') {
    return (
      <div aria-busy="true" aria-label={label} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3">
          <Skeleton variant="rectangular" className="h-10 w-full" />
          <Skeleton variant="rectangular" className="h-10 w-full" />
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} variant="card" className="h-24" />)}
        </div>
        <Skeleton variant="card" className="h-[420px] lg:col-span-2" />
      </div>
    );
  }

  if (mode === 'analytics') {
    return (
      <div aria-busy="true" aria-label={label} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} variant="card" className="h-32" />)}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton variant="card" className="h-72" />
          <Skeleton variant="card" className="h-72" />
        </div>
      </div>
    );
  }

  if (mode === 'form') {
    return (
      <div aria-busy="true" aria-label={label} className="max-w-3xl space-y-5">
        <Skeleton variant="text" className="h-7 w-48" />
        <div className="space-y-5 rounded-3xl border border-[var(--mazzi-border)] bg-white p-5 shadow-xs">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton variant="text" className="h-3 w-28" />
              <Skeleton variant="rectangular" className="h-11 w-full" />
            </div>
          ))}
          <Skeleton variant="rectangular" className="h-11 w-40" />
        </div>
      </div>
    );
  }

  if (mode === 'object') {
    return (
      <div aria-busy="true" aria-label={label} className="space-y-4 rounded-3xl border border-[var(--mazzi-border)] bg-white p-5 shadow-xs">
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
    );
  }

  return (
    <div aria-busy="true" aria-label={label} className="space-y-3">
      {Array.from({ length: count }, (_, index) => (
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
      ))}
    </div>
  );
};
