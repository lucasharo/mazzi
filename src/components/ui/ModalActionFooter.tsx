import React from 'react';

export interface ModalActionFooterProps {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right' | 'between';
}

/**
 * MAZZI Official Modal Action Footer
 * Sticky white bottom footer bar with elevated floating action buttons and safe-area padding.
 */
export const ModalActionFooter: React.FC<ModalActionFooterProps> = ({
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
      className={`shrink-0 bg-white border-t border-[var(--mazzi-border)]/60 shadow-[0_-4px_16px_rgba(0,0,0,0.05)] px-8 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] -mx-6 flex items-center ${alignStyles[align]} gap-3 sticky bottom-0 z-[60] transition-all ${className}`}
    >
      {children}
    </div>
  );
};
