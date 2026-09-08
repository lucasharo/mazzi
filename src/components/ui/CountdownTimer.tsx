import React from 'react';
import { Clock3 } from 'lucide-react';

export interface CountdownTimerProps {
  secondsRemaining: number;
  label?: string;
  className?: string;
  ariaLabel?: string;
}

export const formatCountdown = (totalSeconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

/** Shared visual language for every user-facing countdown in Student and PRO. */
export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  secondsRemaining,
  label = 'Este valor fica reservado por mais',
  className = '',
  ariaLabel,
}) => {
  const formattedTime = formatCountdown(secondsRemaining);

  return (
    <div
      role="timer"
      aria-live="polite"
      aria-atomic="true"
      aria-label={ariaLabel || `${label} ${formattedTime}`}
      className={`flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--mazzi-dark)] bg-[var(--mazzi-dark)] p-3 text-white ${className}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Clock3 className="h-4 w-4 shrink-0 text-[var(--mazzi-yellow)]" aria-hidden="true" />
        <span className="truncate text-xs font-semibold text-white/80">{label}</span>
      </div>
      <span className="shrink-0 font-mono text-sm font-extrabold tabular-nums text-[var(--mazzi-yellow)]">{formattedTime}</span>
    </div>
  );
};
