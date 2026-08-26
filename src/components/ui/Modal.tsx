import React, { useEffect, useId, useRef } from 'react';
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

export function useDialogHistory({
  isOpen,
  onClose,
  modalKey,
}: {
  isOpen: boolean;
  onClose: () => void;
  modalKey: string;
}) {
  const historyEntryRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return undefined;

    const currentUrl = new URL(window.location.href);
    const currentModalKey = window.history.state?.mazziModal;
    if (currentModalKey === modalKey) {
      // The component can remount while the modal history entry is still
      // current. Reclaim that entry instead of allowing the close effect to
      // navigate back and remove the URL while the modal is open.
      historyEntryRef.current = true;
    } else {
      if (currentUrl.hash) {
        const hashContent = currentUrl.hash.slice(1);
        const separatorIndex = hashContent.indexOf('?');
        const hashPath = separatorIndex >= 0 ? hashContent.slice(0, separatorIndex) : hashContent;
        const hashParams = new URLSearchParams(separatorIndex >= 0 ? hashContent.slice(separatorIndex + 1) : '');
        hashParams.set('mazzi_modal', modalKey);
        currentUrl.search = '';
        currentUrl.hash = `${hashPath}?${hashParams.toString()}`;
      } else {
        currentUrl.searchParams.set('mazzi_modal', modalKey);
      }
      window.history.pushState(
        { ...(window.history.state || {}), mazziModal: modalKey },
        '',
        currentUrl.toString(),
      );
      historyEntryRef.current = true;
    }

    const handlePopState = () => {
      if (!historyEntryRef.current) return;
      historyEntryRef.current = false;
      onCloseRef.current();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isOpen, modalKey]);

  useEffect(() => {
    if (isOpen || !historyEntryRef.current || typeof window === 'undefined') return;
    historyEntryRef.current = false;
    window.history.back();
  }, [isOpen]);
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
  // Keep the URL identity stable if a modal changes its title while open.
  const modalKeyRef = useRef(id || title || 'dialog');
  const modalKey = modalKeyRef.current;
  const dialogRef = useAccessibleDialog<HTMLDivElement>({ isOpen, onClose, closeOnEscape });
  useDialogHistory({ isOpen, onClose, modalKey });

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
        className={`relative w-full ${sizeStyles[size]} mb-8 bg-white rounded-3xl shadow-xl border border-[var(--mazzi-border)] overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150 text-left`}
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

        <div className="mazzi-modal-content p-6 overflow-y-auto flex-1 min-h-0">{children}</div>

        {footer && <ModalActionFooter align="right">{footer}</ModalActionFooter>}
      </div>
    </div>
  );
};
