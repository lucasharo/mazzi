import React from 'react';
import { Loader2 } from 'lucide-react';

export interface SecondaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

/**
 * SecondaryButton (WhiteButton) — Botão Branco Padrão MAZZI
 * Idêntico ao botão "Limpar".
 */
export const SecondaryButton: React.FC<SecondaryButtonProps> = ({
  children,
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

  const sizeStyles = {
    sm: 'px-3.5 py-1.5 text-xs gap-1.5 min-h-[40px]',
    md: 'px-5 py-3 text-sm gap-2 min-h-[48px]',
    lg: 'px-6 py-3.5 text-base gap-2.5 min-h-[52px]',
  };

  const baseStyles =
    'inline-flex items-center justify-center font-bold rounded-2xl transition-all focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)] focus-visible:ring-2 focus-visible:ring-[var(--mazzi-focus-glow)] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98] select-none whitespace-nowrap cursor-pointer border border-[var(--mazzi-border)] text-[var(--mazzi-dark)] bg-white hover:bg-slate-50 hover:border-slate-300 shadow-2xs';

  return (
    <button
      id={id || `sbtn-${Math.random().toString(36).substring(2, 8)}`}
      disabled={disabled || activeLoading}
      aria-busy={activeLoading}
      className={`${baseStyles} ${sizeStyles[size]} ${className}`}
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

export const WhiteButton = SecondaryButton;
