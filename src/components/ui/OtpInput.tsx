import React from 'react';
import { AlertCircle } from 'lucide-react';
import { AUTH_OTP_LENGTH, AUTH_OTP_CLEAN_REGEX } from '../../lib/auth-constants';

export interface OtpInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  disabled?: boolean;
  error?: string | null;
  label?: string;
  hint?: string;
  autoFocus?: boolean;
  length?: number;
}

export const OtpInput: React.FC<OtpInputProps> = ({
  id = 'mazzi-otp-input',
  value,
  onChange,
  onEnter,
  disabled = false,
  error,
  label = `Código de ${AUTH_OTP_LENGTH} dígitos`,
  hint,
  autoFocus = true,
  length = AUTH_OTP_LENGTH,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(AUTH_OTP_CLEAN_REGEX, '').slice(0, length);
    onChange(digits);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onEnter && value.length === length && !disabled) {
      e.preventDefault();
      onEnter();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const digits = pasted.replace(AUTH_OTP_CLEAN_REGEX, '').slice(0, length);
    onChange(digits);
  };

  const placeholderText = '0'.repeat(length);

  return (
    <div className="w-full flex flex-col gap-1.5 text-left">
      {label && (
        <label
          htmlFor={id}
          className="text-xs font-semibold uppercase tracking-wider text-slate-700 block"
        >
          {label}
        </label>
      )}

      <div className="relative w-full">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={length}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder={placeholderText}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={`w-full min-h-[56px] text-center font-mono text-xl sm:text-2xl tracking-[0.3em] sm:tracking-[0.4em] font-bold rounded-2xl border px-3 py-2 transition-all outline-none bg-white text-slate-900 shadow-2xs placeholder:text-slate-300 placeholder:tracking-[0.3em] ${
            error
              ? 'border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-100'
              : 'border-[var(--mazzi-border)] focus:border-[var(--mazzi-yellow)] focus:ring-4 focus:ring-[var(--mazzi-focus-glow)]'
          } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
        />
      </div>

      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-slate-500 mt-0.5">
          {hint}
        </p>
      )}

      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 mt-0.5"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};
