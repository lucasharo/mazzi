import { RefObject, useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

let bodyScrollLockCount = 0;
let previousBodyOverflow = '';
const openDialogs: HTMLElement[] = [];

function lockBodyScroll() {
  if (bodyScrollLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  bodyScrollLockCount += 1;
}

function unlockBodyScroll() {
  bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
  if (bodyScrollLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow;
  }
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true',
  );
}

export interface AccessibleDialogOptions {
  isOpen: boolean;
  onClose: () => void;
  closeOnEscape?: boolean;
  nested?: boolean;
}

export function useAccessibleDialog<T extends HTMLElement>({
  isOpen,
  onClose,
  closeOnEscape = true,
  nested = false,
}: AccessibleDialogOptions): RefObject<T | null> {
  const dialogRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const overlay = dialog.parentElement;
    const siblingState = overlay?.parentElement
      ? Array.from(overlay.parentElement.children)
          .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== overlay)
          .map((element) => ({
            element,
            inert: element.inert,
            ariaHidden: element.getAttribute('aria-hidden'),
          }))
      : [];

    siblingState.forEach(({ element }) => {
      // A nested portal sits above an already open dialog. Making the entire
      // app root inert here forces browsers to blur the focused field and can
      // reset the parent's internal scroll position. The nested backdrop and
      // top-dialog focus trap already prevent interaction with the parent.
      if (!nested) element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    });
    lockBodyScroll();
    openDialogs.push(dialog);

    const focusInitialElement = () => {
      const preferred = dialog.querySelector<HTMLElement>('[data-dialog-autofocus="true"]');
      const firstFocusable = getFocusableElements(dialog)[0];
      (preferred || firstFocusable || dialog).focus({ preventScroll: true });
    };
    const animationFrame = window.requestAnimationFrame(focusInitialElement);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== dialog) return;
      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements(dialog);
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey && (activeElement === first || !dialog.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener('keydown', handleKeyDown, true);
      const dialogIndex = openDialogs.lastIndexOf(dialog);
      if (dialogIndex >= 0) openDialogs.splice(dialogIndex, 1);
      siblingState.forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', ariaHidden);
      });
      unlockBodyScroll();
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, [closeOnEscape, isOpen, nested]);

  return dialogRef;
}
