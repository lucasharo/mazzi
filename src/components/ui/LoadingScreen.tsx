import React from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingScreenProps {
  label?: string;
  fullscreen?: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  label,
  fullscreen = true,
}) => {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label || 'Carregando interface'}
      className={`flex flex-col items-center justify-center p-6 text-center ${
        fullscreen ? 'min-h-[100dvh] w-full bg-[var(--mazzi-bg)]' : 'py-12 w-full'
      }`}
    >
      <div className="relative flex items-center justify-center">
        {/* Amber soft pulse backdrop */}
        <div className="absolute h-16 w-16 rounded-3xl bg-[var(--mazzi-yellow-soft)] animate-ping opacity-30" />
        
        {/* Main icon container */}
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white border border-[var(--mazzi-border)] shadow-xs">
          <Loader2 className="h-7 w-7 text-amber-500 animate-spin" aria-hidden="true" />
        </div>
      </div>

      {label && (
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </p>
      )}
    </div>
  );
};
