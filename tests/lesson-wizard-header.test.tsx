// @vitest-environment happy-dom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LessonWizardHeader } from '../src/components/ui/LessonWizardHeader';

afterEach(cleanup);
it('shows only applicable booking steps and marks the current one', () => {
  const onClose = vi.fn();
  render(<LessonWizardHeader steps={['Veículo', 'Horário', 'Confirmação']} current="Horário" title="Quando será sua aula?" onClose={onClose} />);
  expect(screen.getByRole('list', { name: 'Etapas da reserva' }).children.length).toBe(3);
  expect(screen.getByText('Horário').parentElement?.getAttribute('aria-current')).toBe('step');
  expect(screen.queryByText('Instrutor')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Fechar diálogo' }));
  expect(onClose).toHaveBeenCalledOnce();
});
