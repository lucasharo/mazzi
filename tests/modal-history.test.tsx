// @vitest-environment happy-dom

import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BottomSheet } from '../src/components/ui/BottomSheet';
import { Modal } from '../src/components/ui/Modal';

describe('modal mobile back behavior', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState({}, '', '/');
  });

  it('closes an open modal when the browser back event is received', () => {
    const onClose = vi.fn();
    render(<Modal isOpen onClose={onClose} title="Detalhes">Conteúdo</Modal>);

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes an open bottom sheet when the browser back event is received', () => {
    const onClose = vi.fn();
    render(<BottomSheet isOpen onClose={onClose} title="Opções">Conteúdo</BottomSheet>);

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
