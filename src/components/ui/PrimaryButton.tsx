import React from 'react';
import { Loader2 } from 'lucide-react';

export interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

/**
 * PrimaryButton — Botão Amarelo Padrão MAZZI
 * Idêntico ao botão "Aplicar Filtros".
 */
export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
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
    'inline-flex items-center justify-center font-bold rounded-2xl transition-all focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)] focus-visible:ring-2 focus-visible:ring-[var(--mazzi-focus-glow)] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98] select-none whitespace-nowrap cursor-pointer bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] hover:bg-[#f3bd28] active:bg-[#e0ab1d] shadow-xs';

  return (
    <button
      id={id || `pbtn-${Math.random().toString(36).substring(2, 8)}`}
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
