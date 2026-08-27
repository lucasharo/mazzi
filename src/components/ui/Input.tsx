import { ButtonBase } from './Button';
import React, { useId, useState } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  rightAction?: React.ReactNode;
  inputRef?: React.Ref<HTMLInputElement>;
}

export const Input: React.FC<InputProps> = ({
  label,
  helperText,
  error,
  leftIcon,
  rightIcon,
  rightAction,
  inputRef,
  className = '',
  id,
  disabled,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ...props
}) => {
  const reactId = useId().replace(/:/g, '');
  const generatedId = id || `input-${reactId}`;
  const messageId = `${generatedId}-${error ? 'error' : 'description'}`;
  const describedBy = [ariaDescribedBy, error || helperText ? messageId : undefined].filter(Boolean).join(' ') || undefined;

  return (
    <div className="w-full space-y-1.5 text-left">
      {label && (
        <label
          htmlFor={generatedId}
          className="mazzi-field-label block"
        >
          {label}
        </label>
      )}
      <div className="relative rounded-xl shadow-xs">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            {leftIcon}
          </div>
        )}
        <input
          ref={inputRef}
          id={generatedId}
          disabled={disabled}
          aria-invalid={error ? true : Boolean(ariaInvalid)}
          aria-describedby={describedBy}
          className={`w-full min-h-11 rounded-xl border bg-white px-3.5 py-2.5 text-sm text-[var(--mazzi-text)] placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2 read-only:bg-slate-50 read-only:text-slate-500 read-only:cursor-not-allowed read-only:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${
            leftIcon ? 'pl-10' : ''
          } ${rightAction ? 'pr-11' : rightIcon || error ? 'pr-10' : ''} ${
            error
              ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-200'
              : 'border-[var(--mazzi-border)] focus:border-[var(--mazzi-yellow)] focus:ring-[var(--mazzi-focus-glow)]'
          } ${className}`}
          {...props}
        />
        {rightAction ? (
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
            {rightAction}
          </div>
        ) : error ? (
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-rose-500">
            <AlertCircle className="w-4 h-4" />
          </div>
        ) : (
          rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
              {rightIcon}
            </div>
          )
        )}
      </div>
      {error ? (
        <p id={messageId} role="alert" className="text-xs text-rose-600 flex items-center gap-1 font-medium">
          {error}
        </p>
      ) : (
        helperText && <p id={messageId} className="text-xs text-slate-500">{helperText}</p>
      )}
    </div>
  );
};

export interface PasswordInputProps extends Omit<InputProps, 'type' | 'rightAction' | 'rightIcon'> {
  showToggle?: boolean;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  showToggle = true,
  disabled,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Input
      type={showPassword ? 'text' : 'password'}
      disabled={disabled}
      rightAction={
        showToggle ? (
          <ButtonBase
            type="button"
            disabled={disabled}
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--mazzi-dark)] cursor-pointer disabled:opacity-50"
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Eye className="w-4 h-4" aria-hidden="true" />
            )}
          </ButtonBase>
        ) : undefined
      }
      {...props}
    />
  );
};
