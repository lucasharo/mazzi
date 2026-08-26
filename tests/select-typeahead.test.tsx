// @vitest-environment happy-dom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Select } from '../src/components/ui/Select';

describe('Select typeahead navigation', () => {
  it('selects an option from the first letters typed by the user', () => {
    const onChange = vi.fn();

    render(
      <Select
        label="Dia da semana"
        options={[
          { value: '', label: 'Selecione um dia...' },
          { value: 'MONDAY', label: 'Segunda-feira' },
          { value: 'TUESDAY', label: 'Terça-feira' },
          { value: 'SATURDAY', label: 'Sábado' },
        ]}
        onChange={onChange}
      />,
    );

    const selectButton = screen.getByRole('button', { name: 'Dia da semana' });
    fireEvent.keyDown(selectButton, { key: 's' });
    fireEvent.keyDown(selectButton, { key: 'e' });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ target: expect.objectContaining({ value: 'MONDAY' }) }));
    expect(screen.getByRole('option', { name: 'Segunda-feira' }).getAttribute('aria-selected')).toBe('true');
  });

  it('matches the beginning of a word inside a multi-word option', () => {
    const onChange = vi.fn();

    render(
      <Select
        options={[
          { value: 'ONE', label: 'Primeira opção' },
          { value: 'TWO', label: 'Bloqueio rápido' },
        ]}
        onChange={onChange}
      />,
    );

    fireEvent.keyDown(screen.getByRole('button', { name: 'Primeira opção' }), { key: 'r' });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ target: expect.objectContaining({ value: 'TWO' }) }));
  });
});
