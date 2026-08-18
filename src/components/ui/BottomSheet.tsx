import React, { useId } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';
import { useAccessibleDialog } from './useAccessibleDialog';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  id?: string;
  ariaLabel?: string;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  id,
  ariaLabel,
  closeOnEscape = true,
  closeOnBackdrop = true,
}) => {
  const generatedId = useId();
  const titleId = `${id || generatedId}-title`;
  const dialogRef = useAccessibleDialog<HTMLDivElement>({ isOpen, onClose, closeOnEscape });

  if (!isOpen) return null;

  return (
    <div
      id={id || 'mazzi-bottom-sheet'}
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} aria-label={title ? undefined : ariaLabel || 'Painel'} tabIndex={-1} className="w-full max-w-md bg-white rounded-t-3xl shadow-2xl border-t border-[var(--mazzi-border)] max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-250 text-left">
        {/* Drag handle */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-1" />

        {title && (
          <div className="px-6 py-3 border-b border-[var(--mazzi-border)] flex items-center justify-between">
            <h3 id={titleId} className="font-extrabold text-[var(--mazzi-dark)] text-base">{title}</h3>
            <IconButton
              label="Fechar painel"
              onClick={onClose}
              data-dialog-autofocus="true"
              className="rounded-full bg-[var(--mazzi-surface-soft)] text-slate-500 hover:text-[var(--mazzi-dark)] hover:bg-slate-200/80 border border-[var(--mazzi-border)] transition-colors"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </IconButton>
          </div>
        )}

        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};
