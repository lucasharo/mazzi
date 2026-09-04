import React, { useId, useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';
import { useAccessibleDialog } from './useAccessibleDialog';
import { useDialogHistory } from './Modal';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  showHeader?: boolean;
  children: React.ReactNode;
  id?: string;
  ariaLabel?: string;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  useHistory?: boolean;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  showHeader = false,
  children,
  id,
  ariaLabel,
  closeOnEscape = true,
  closeOnBackdrop = true,
  useHistory = false,
}) => {
  const generatedId = useId();
  const titleId = `${id || generatedId}-title`;
  const dialogRef = useAccessibleDialog<HTMLDivElement>({ isOpen, onClose, closeOnEscape });
  useDialogHistory({ isOpen: isOpen && useHistory, onClose, modalKey: id || title || 'bottom-sheet' });

  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);

  useEffect(() => {
    if (!isOpen) {
      setDragY(0);
      setIsDragging(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    startYRef.current = clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = clientY - startYRef.current;
    if (deltaY > 0) {
      setDragY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragY > 70) {
      onClose();
    }
    setDragY(0);
  };

  return (
    <div
      id={id || 'mazzi-bottom-sheet'}
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-300 ease-out"
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel || 'Painel'}
        tabIndex={-1}
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out, opacity 0.3s ease-out',
        }}
        className="w-full max-w-md bg-white rounded-t-3xl shadow-2xl border-t border-[var(--mazzi-border)] max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300 ease-out text-left select-none"
      >
        {/* Touch/Mouse Drag handle area for swipe-down-to-close */}
        <div
          className="w-full py-3 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleTouchStart}
          onMouseMove={handleTouchMove}
          onMouseUp={handleTouchEnd}
          onMouseLeave={handleTouchEnd}
        >
          <div className="w-12 h-1.5 bg-slate-300 hover:bg-slate-400 rounded-full transition-colors" />
        </div>

        {title && (
          showHeader ? (
            <div className="px-6 py-2 border-b border-[var(--mazzi-border)] flex items-center justify-between">
              <h3 id={titleId} className="font-extrabold text-[var(--mazzi-dark)] text-base">{title}</h3>
              <IconButton
                label="Fechar painel"
                onClick={onClose}
                className="rounded-full bg-[var(--mazzi-surface-soft)] text-slate-500 hover:text-[var(--mazzi-dark)] hover:bg-slate-200/80 transition-colors"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </IconButton>
            </div>
          ) : (
            <div className="sr-only">
              <h3 id={titleId}>{title}</h3>
              <IconButton label="Fechar painel" onClick={onClose} className="sr-only" />
            </div>
          )
        )}

        <div className="p-6 pt-1 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};
