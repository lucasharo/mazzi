import React, { useId } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';
import { useAccessibleDialog } from './useAccessibleDialog';
import { ModalActionFooter } from './ModalActionFooter';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  id?: string;
  ariaLabel?: string;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  id,
  ariaLabel,
  closeOnEscape = true,
  closeOnBackdrop = true,
}) => {
  const generatedId = useId();
  const titleId = `${id || generatedId}-title`;
  const dialogRef = useAccessibleDialog<HTMLDivElement>({ isOpen, onClose, closeOnEscape });

  if (!isOpen) return null;

  const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  };

  return (
    <div
      id={id || 'mazzi-modal'}
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel || 'Janela de diálogo'}
        tabIndex={-1}
        className={`relative w-full ${sizeStyles[size]} mb-4 bg-white rounded-3xl shadow-xl border border-[var(--mazzi-border)] overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150 text-left`}
      >
        {title && (
          <div className="px-6 py-4 border-b border-[var(--mazzi-border)] flex items-center justify-between">
            <h3 id={titleId} className="font-extrabold text-[var(--mazzi-dark)] text-base">{title}</h3>
            <IconButton
              label="Fechar diálogo"
              onClick={onClose}
              data-dialog-autofocus="true"
              className="rounded-full bg-[var(--mazzi-surface-soft)] text-slate-500 hover:text-[var(--mazzi-dark)] hover:bg-slate-200/80 transition-colors"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </IconButton>
          </div>
        )}

        <div className={`mazzi-modal-content p-6 overflow-y-auto flex-1 min-h-0 ${footer ? 'pb-0' : ''}`}>{children}</div>

        {footer && <ModalActionFooter align="right">{footer}</ModalActionFooter>}
      </div>
    </div>
  );
};
