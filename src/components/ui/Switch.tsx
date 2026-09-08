import React from 'react';
import { Loader2 } from 'lucide-react';
import { ButtonBase } from './Button';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

/** Compact, keyboard-accessible boolean control for operational settings. */
export const Switch: React.FC<SwitchProps> = ({
  checked,
  onCheckedChange,
  label,
  disabled = false,
  loading = false,
  className = '',
}) => (
  <ButtonBase
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    aria-busy={loading}
    disabled={disabled || loading}
    onClick={() => onCheckedChange(!checked)}
    className={`group inline-flex min-h-11 min-w-11 items-center justify-center rounded-2xl p-2 transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-[var(--mazzi-focus-glow)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
  >
    <span
      aria-hidden="true"
      className={`relative h-6 w-11 shrink-0 rounded-full shadow-inner transition-colors duration-200 ease-out ${checked ? 'bg-[var(--mazzi-yellow)]' : 'bg-slate-300'} ${!disabled && !loading ? 'group-hover:brightness-95' : ''}`}
    >
      <span className={`absolute left-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${checked ? 'translate-x-5' : 'translate-x-0'}`}>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-slate-500" aria-hidden="true" />}
      </span>
    </span>
  </ButtonBase>
);
