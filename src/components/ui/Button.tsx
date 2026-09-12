import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getDefaultButtonActionIcon } from './ButtonActionIcon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'dangerSoft' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  contentClassName?: string;
  showDefaultIcon?: boolean;
}

export type ButtonBaseProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export const ButtonBase = React.forwardRef<HTMLButtonElement, ButtonBaseProps>(function ButtonBase(
  { type = 'button', className = '', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      data-component="button-base"
      className={`cursor-pointer touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)] disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none ${className}`}
      {...props}
    />
  );
});

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'sm',
  isLoading = false,
  loading = false,
  leftIcon,
  rightIcon,
  contentClassName = '',
  showDefaultIcon = true,
  className = '',
  disabled,
  id,
  onClick,
  ...props
}) => {
  const [autoLoading, setAutoLoading] = useState(false);
  const activeLoading = isLoading || loading;
  const effectiveLoading = activeLoading || autoLoading;
  const defaultIcon = showDefaultIcon && !leftIcon && !rightIcon ? getDefaultButtonActionIcon(children) : null;

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    if (!onClick) return;
    const result = onClick(event);
    if (!result || typeof (result as unknown as PromiseLike<unknown>).then !== 'function') return;

    setAutoLoading(true);
    void Promise.resolve(result).then(
      () => setAutoLoading(false),
      () => setAutoLoading(false),
    );
  };

  const baseStyles =
    'inline-flex items-center justify-center font-bold rounded-2xl transition-all touch-manipulation focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)] focus-visible:ring-2 focus-visible:ring-[var(--mazzi-focus-glow)] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98] select-none whitespace-nowrap cursor-pointer';

  const sizeStyles = {
    sm: 'px-3.5 py-2 text-xs gap-1.5 min-h-[44px]',
    md: 'px-4.5 py-2.5 text-sm gap-2 min-h-[44px]',
    lg: 'px-6 py-3.5 text-base gap-2.5 min-h-[52px]',
  };

  const variantStyles = {
    primary:
      'bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] hover:bg-[#f3bd28] active:bg-[#e0ab1d] shadow-xs font-bold',
    secondary:
      'bg-[var(--mazzi-dark)] text-white hover:bg-[#34353a] active:bg-black font-bold shadow-xs',
    outline:
      'border border-[var(--mazzi-dark)] bg-[var(--mazzi-dark)] text-white hover:bg-[#34353a] hover:border-[#34353a] active:bg-black font-bold shadow-xs',
    ghost:
      'text-[var(--mazzi-dark)] hover:text-slate-950 hover:bg-slate-100 font-semibold',
    dangerSoft:
      'border border-rose-200/80 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100 active:bg-rose-200 font-bold shadow-2xs !min-h-11',
    danger:
      'bg-[var(--mazzi-danger)] text-white hover:bg-[var(--mazzi-danger-hover)] active:bg-[var(--mazzi-danger-active)] font-bold shadow-xs',
  };

  return (
    <button
      id={id}
      data-component="button"
      disabled={disabled || effectiveLoading}
      aria-busy={effectiveLoading}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      onClick={handleClick}
      {...props}
    >
      {effectiveLoading ? (
        <>
          <span className="flex-shrink-0" aria-hidden="true">
          <Loader2 className="w-5 h-5 animate-spin text-current" aria-hidden="true" />
          </span>
          <span className={contentClassName || undefined}>{children}</span>
        </>
      ) : (
        <>
          {(leftIcon || defaultIcon) && <span className="flex-shrink-0">{leftIcon || defaultIcon}</span>}
          <span className={leftIcon || rightIcon || defaultIcon ? `min-w-0 ${contentClassName}` : contentClassName || undefined}>{children}</span>
          {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};

export type PrimaryButtonProps = Omit<ButtonProps, 'variant'>;
export const PrimaryButton: React.FC<PrimaryButtonProps> = (props) => <Button {...props} variant="primary" />;

export type SecondaryButtonProps = Omit<ButtonProps, 'variant'>;
export const SecondaryButton: React.FC<SecondaryButtonProps> = (props) => <Button {...props} variant="outline" />;
export const WhiteButton = SecondaryButton;
