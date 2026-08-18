import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  loading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  id,
  ...props
}) => {
  const activeLoading = isLoading || loading;

  const baseStyles =
    'inline-flex items-center justify-center font-bold rounded-2xl transition-all focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)] focus-visible:ring-2 focus-visible:ring-[var(--mazzi-focus-glow)] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98] select-none whitespace-nowrap cursor-pointer';

  const sizeStyles = {
    sm: 'px-3.5 py-1.5 text-xs gap-1.5 min-h-[38px] sm:min-h-[36px]',
    md: 'px-4.5 py-2.5 text-sm gap-2 min-h-[44px]',
    lg: 'px-6 py-3.5 text-base gap-2.5 min-h-[52px]',
  };

  const variantStyles = {
    primary:
      'bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] hover:bg-[#f3bd28] active:bg-[#e0ab1d] shadow-xs font-bold',
    secondary:
      'bg-[var(--mazzi-dark)] text-white hover:bg-[#34353a] active:bg-black font-bold shadow-xs',
    outline:
      'border border-[var(--mazzi-border)] text-[var(--mazzi-dark)] bg-white hover:bg-slate-50 hover:border-slate-300 font-bold shadow-2xs',
    ghost:
      'text-[var(--mazzi-dark)] hover:text-slate-950 hover:bg-slate-100 font-semibold',
    danger:
      'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 font-bold shadow-xs',
  };

  return (
    <button
      id={id || `btn-${Math.random().toString(36).substring(2, 8)}`}
      disabled={disabled || activeLoading}
      aria-busy={activeLoading}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {activeLoading ? (
        <span className="inline-flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-current" aria-hidden="true" />
        </span>
      ) : (
        <>
          {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};

export { PrimaryButton } from './PrimaryButton';
export { SecondaryButton, WhiteButton } from './SecondaryButton';
