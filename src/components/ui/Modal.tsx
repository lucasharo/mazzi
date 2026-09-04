import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';
import { useAccessibleDialog } from './useAccessibleDialog';
import { ModalActionFooter } from './ModalActionFooter';
import { EnvironmentBadge } from './EnvironmentBadge';
import { WizardActionFooter } from './WizardActionFooter';

export interface ModalProps {
  className?: string;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  headerAction?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  id?: string;
  ariaLabel?: string;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  useHistory?: boolean;
  portal?: boolean;
  layer?: 'base' | 'nested';
  /** Render the dialog as an app screen instead of a centered overlay. */
  presentation?: 'modal' | 'page' | 'fullscreen';
  footerClassName?: string;
  footerVariant?: 'default' | 'wizard';
  /** Allows a screen inside the modal to fill the available viewport height. */
  fillContent?: boolean;
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

    const currentModalKey = window.history.state?.mazziModal;
    if (currentModalKey === modalKey) {
      // The component can remount while the modal history entry is still
      // current. Reclaim that entry instead of allowing the close effect to
      // navigate back and remove the URL while the modal is open.
      historyEntryRef.current = true;
    } else {
      // Keep the address bar unchanged. The history entry is internal and
      // still lets the mobile back button close the modal first.
      window.history.pushState(
        { ...(window.history.state || {}), mazziModal: modalKey },
        '',
        window.location.href,
      );
      historyEntryRef.current = true;
    }

    const handlePopState = (event: PopStateEvent) => {
      if (!historyEntryRef.current) return;
      // A nested modal may have been closed by the back button and returned
      // to this modal's history entry. Only the topmost dialog should close.
      if (event.state?.mazziModal === modalKey) return;
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
  className = '',
  isOpen,
  onClose,
  title,
  children,
  footer,
  headerAction,
  size = 'md',
  id,
  ariaLabel,
  closeOnEscape = true,
  closeOnBackdrop = true,
  useHistory = true,
  portal = false,
  layer = 'base',
  // Modals in the apps are full-screen app surfaces by default. A centered
  // dialog remains available for exceptional cases via presentation="modal".
  presentation = 'page',
  footerClassName = '',
  footerVariant = 'default',
  fillContent = false,
}) => {
  const generatedId = useId();
  const titleId = `${id || generatedId}-title`;
  // Keep the URL identity stable if a modal changes its title while open.
  const modalKeyRef = useRef(id || title || 'dialog');
  const modalKey = modalKeyRef.current;
  const dialogRef = useAccessibleDialog<HTMLDivElement>({ isOpen, onClose, closeOnEscape, nested: layer === 'nested' });
  useDialogHistory({ isOpen: isOpen && useHistory, onClose, modalKey });

  if (!isOpen) return null;

  const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  };

  const modalContent = (
    <div
      id={id || 'mazzi-modal'}
      className={`fixed inset-0 ${layer === 'nested' ? 'z-[100]' : 'z-[80]'} flex ${presentation === 'modal' ? 'items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs' : 'items-stretch justify-stretch bg-[var(--mazzi-bg)]'} animate-in fade-in duration-150 ${className}`}
      onClick={(e) => {
        if (presentation === 'modal' && closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel || 'Janela de diálogo'}
        tabIndex={-1}
        className={`relative w-full ${presentation === 'page' || presentation === 'fullscreen'
          ? `h-full max-w-none rounded-none border-0 ${presentation === 'fullscreen' ? 'bg-transparent' : 'bg-[var(--mazzi-bg)]'} shadow-none`
          : `${sizeStyles[size]} mb-8 max-h-[90vh] rounded-3xl border border-[var(--mazzi-border)] bg-white shadow-xl`}
          } overflow-clip flex flex-col animate-in ${presentation === 'modal' ? 'zoom-in-95' : presentation === 'page' ? 'slide-in-from-bottom-2' : ''} duration-150 text-left`}
      >
        {title && (
          <div className={`${presentation === 'modal' ? 'bg-white' : 'bg-[var(--mazzi-bg)]'} px-6 py-4 border-b border-[var(--mazzi-border)] flex items-center justify-between`}>
            <div className="flex min-w-0 items-center gap-2">
              {headerAction}
              <h3 id={titleId} className="font-extrabold text-[var(--mazzi-dark)] text-base">{title}</h3>
            </div>
            <div className="flex items-center gap-2">
              <EnvironmentBadge />
              <IconButton
                label="Fechar diálogo"
                onClick={onClose}
                data-dialog-autofocus="true"
                className="rounded-full bg-[var(--mazzi-surface-soft)] text-slate-500 hover:text-[var(--mazzi-dark)] hover:bg-slate-200/80 transition-colors"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </IconButton>
            </div>
          </div>
        )}

        <div className={`mazzi-modal-content ${presentation === 'modal' ? 'p-6' : presentation === 'page' ? 'p-4 sm:p-6' : 'p-0'} ${fillContent ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'} flex-1 min-h-0`}>
          {presentation === 'page' ? <div className={`mx-auto w-full ${footerVariant === 'wizard' ? 'max-w-[480px]' : 'max-w-2xl'} ${fillContent ? 'flex h-full min-h-0 flex-col' : ''}`}>{children}</div> : children}
        </div>

        {footer && (footerVariant === 'wizard'
          ? <div className="shrink-0 bg-white px-4 pb-4 sm:px-6 sm:pb-6"><div className="mx-auto w-full max-w-[480px]"><WizardActionFooter>{footer}</WizardActionFooter></div></div>
          : <ModalActionFooter align="right" className={presentation === 'fullscreen' ? `!mx-0 ${footerClassName}` : footerClassName}>{footer}</ModalActionFooter>)}
      </div>
    </div>
  );

  return portal && typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
