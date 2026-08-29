import React from 'react';
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
        fullscreen ? 'min-h-[100dvh] w-full bg-[#f9c93d]' : 'w-full py-12'
      }`}
    >
      <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-[1.75rem] shadow-[0_14px_32px_rgba(32,33,38,.14)]">
        <picture>
          <source media="(prefers-reduced-motion: reduce)" srcSet="/brand/mazzi-logo.png" />
          <img
            src="/brand/mazzi-road-motion.gif"
            alt=""
            width="112"
            height="112"
            decoding="async"
            fetchPriority="high"
            aria-hidden="true"
            className="h-28 w-28 object-cover"
          />
        </picture>
      </div>

      {label && (
        <p className={`mt-4 text-xs font-semibold uppercase tracking-wider ${fullscreen ? 'text-black/65' : 'text-slate-500'}`}>
          {label}
        </p>
      )}
    </div>
  );
};
