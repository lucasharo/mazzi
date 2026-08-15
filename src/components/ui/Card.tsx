import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'flat' | 'outline' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  id,
  ...props
}) => {
  const generatedId = id || `card-${Math.random().toString(36).substring(2, 8)}`;

  const paddingStyles = {
    none: 'p-0',
    sm: 'p-3.5',
    md: 'p-5',
    lg: 'p-6',
  };

  const variantStyles = {
    default: 'bg-white border border-slate-200/80 shadow-sm rounded-2xl',
    flat: 'bg-slate-50 border border-slate-100 rounded-2xl',
    outline: 'bg-white border-2 border-slate-200 rounded-2xl',
    interactive:
      'bg-white border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 transition-all rounded-2xl cursor-pointer active:scale-[0.99]',
  };

  return (
    <div
      id={generatedId}
      className={`${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
