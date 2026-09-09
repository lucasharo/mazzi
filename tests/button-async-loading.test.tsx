// @vitest-environment happy-dom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Button } from '../src/components/ui/Button';

describe('Button async action feedback', () => {
  afterEach(() => cleanup());

  it('shows the spinner only on the button whose async action was clicked', async () => {
    let resolveAction!: () => void;
    const action = vi.fn(() => new Promise<void>((resolve) => { resolveAction = resolve; }));

    render(
      <div>
        <Button onClick={action}>Enviar Documento</Button>
        <Button onClick={() => undefined}>Outro botão</Button>
      </div>,
    );

    const uploadButton = screen.getByRole('button', { name: 'Enviar Documento' });
    const otherButton = screen.getByRole('button', { name: 'Outro botão' });

    fireEvent.click(uploadButton);

    expect(action).toHaveBeenCalledTimes(1);
    expect(uploadButton).toHaveProperty('disabled', true);
    expect(uploadButton.getAttribute('aria-busy')).toBe('true');
    expect(otherButton).toHaveProperty('disabled', false);
    expect(otherButton.getAttribute('aria-busy')).toBe('false');

    resolveAction();
    await waitFor(() => {
      expect(uploadButton).toHaveProperty('disabled', false);
      expect(uploadButton.getAttribute('aria-busy')).toBe('false');
    });
  });
});
