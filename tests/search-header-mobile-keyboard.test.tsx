// @vitest-environment happy-dom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchHeader } from '../src/components/search/SearchHeader';
import { activeGeocodingProvider } from '../src/domain/maps/geocoding-provider';

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

  it('shows the reverse-geocoded address after using the current-location button', async () => {
    const reverseGeocode = vi.spyOn(activeGeocodingProvider, 'reverseGeocode').mockResolvedValue({
      formattedAddress: 'Rua Augusta, 100 - São Paulo - SP',
      neighborhood: 'Consolação',
      city: 'São Paulo',
      state: 'SP',
      latitude: -23.55,
      longitude: -46.65,
    });

    render(
      <SearchHeader
        searchRequest={{ category: 'B', page: 1 }}
        currentLocation={{ lat: -23.55, lng: -46.65 }}
        onUpdateSearch={() => undefined}
        onPerformSearch={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Usar minha localização atual' }));

    await waitFor(() => expect((screen.getByRole('combobox', { name: 'Buscar endereço ou local' }) as HTMLInputElement).value).toBe('Rua Augusta, 100 - São Paulo - SP'));
    expect(reverseGeocode).toHaveBeenCalledWith(-23.55, -46.65);
    reverseGeocode.mockRestore();
  });
});
