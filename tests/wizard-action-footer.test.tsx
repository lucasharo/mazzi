// @vitest-environment happy-dom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Modal } from '../src/components/ui/Modal';

afterEach(cleanup);
it('keeps wizard actions outside the scrollable content', () => {
  const { container } = render(<Modal isOpen onClose={vi.fn()} useHistory={false} footerVariant="wizard" footer={<button>Continuar</button>}>
    <p>Conteúdo da etapa</p>
  </Modal>);
  const body = container.querySelector('.mazzi-modal-content');
  const footer = container.querySelector('[data-component="wizard-action-footer"]');
  expect(body?.contains(screen.getByText('Conteúdo da etapa'))).toBe(true);
  expect(body?.contains(footer)).toBe(false);
  expect(footer?.contains(screen.getByRole('button', { name: 'Continuar' }))).toBe(true);
  expect(footer?.classList.contains('shrink-0')).toBe(true);
  expect(footer?.className).not.toContain('shadow');
});
