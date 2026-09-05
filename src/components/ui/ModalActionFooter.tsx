import React from 'react';

export interface ModalActionFooterProps {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right' | 'between';
}

/**
 * MAZZI Official Modal Action Footer
 * Sticky modal footer using the same opaque surface as the lesson wizard.
 */
export const ModalActionFooter: React.FC<ModalActionFooterProps> = ({
  children,
  className = '',
  align = 'right',
}) => {
  const actionChildren = React.Children.toArray(children).flatMap((child) => {
    if (React.isValidElement(child) && child.type === React.Fragment) {
      return React.Children.toArray(child.props.children);
    }
    return [child];
  });

  const alignStyles = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    between: 'justify-between',
  };

  return (
    <div
      className={`shrink-0 bg-[var(--mazzi-modal-footer-bg)] border-t border-[var(--mazzi-border)]/60 px-8 py-4 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.75rem))] -mx-6 flex items-center ${alignStyles[align]} gap-3 sticky bottom-0 z-[60] transition-all ${className}`}
    >
      {actionChildren.map((child, index) => {
        if (!React.isValidElement(child)) return child;
        const childClassName = [
          (child.props as { className?: string }).className,
          'min-w-0 flex-1 basis-0',
        ].filter(Boolean).join(' ');
        return React.cloneElement(child, {
          key: child.key ?? index,
          className: childClassName,
        } as Partial<unknown>);
      })}
    </div>
  );
};
