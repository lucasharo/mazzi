// @vitest-environment happy-dom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SearchHeader } from '../src/components/search/SearchHeader';

describe('SearchHeader mobile keyboard behavior', () => {
  afterEach(cleanup);

  it('pins the search field only while a mobile keyboard reduces the visual viewport', () => {
    const viewport = new EventTarget() as VisualViewport;
    Object.defineProperty(viewport, 'height', { configurable: true, value: 500 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: true }),
    });

    const { container } = render(
      <SearchHeader
        searchRequest={{ category: 'B', page: 1 }}
        onUpdateSearch={() => undefined}
        onPerformSearch={() => undefined}
      />,
    );
    const input = screen.getByRole('combobox', { name: 'Buscar endereço ou local' });

    fireEvent.focus(input);
    act(() => viewport.dispatchEvent(new Event('resize')));
    expect(container.querySelector('form')?.dataset.keyboardPinned).toBe('true');

    Object.defineProperty(viewport, 'height', { configurable: true, value: 800 });
    act(() => viewport.dispatchEvent(new Event('resize')));
    expect(container.querySelector('form')?.dataset.keyboardPinned).toBeUndefined();
  });
});
