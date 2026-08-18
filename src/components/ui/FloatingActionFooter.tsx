import React from 'react';

export interface FloatingActionFooterProps {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right' | 'between';
}

export const FloatingActionFooter: React.FC<FloatingActionFooterProps> = ({
  children,
  className = '',
  align = 'right',
}) => {
  const alignStyles = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    between: 'justify-between',
  };

  return (
    <div
      className={`w-full bg-transparent px-4 py-3 sm:px-6 sm:py-4 flex flex-col sm:flex-row items-center ${alignStyles[align]} gap-3 pb-[max(16px,env(safe-area-inset-bottom))] transition-all ${className}`}
    >
      {children}
    </div>
  );
};
