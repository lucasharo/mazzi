// @vitest-environment happy-dom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Provider } from '../src/types';

const fake = vi.hoisted(() => ({
  setView: vi.fn(),
  remove: vi.fn(),
  marker: vi.fn(),
  failTiles: false,
  events: {} as Record<string, () => void>,
}));
vi.mock('../src/components/maps/MazziMap', () => ({ PROVIDER_COORDINATES: {} }));
vi.mock('leaflet', () => ({ default: {
  map: () => ({
    setView: fake.setView, remove: fake.remove, fitBounds: vi.fn(),
    on: (names: string, callback: () => void) => names.split(' ').forEach(name => { fake.events[name] = callback; }),
  }),
  tileLayer: () => { if (fake.failTiles) throw new Error('TEST_LAYER_FAILURE'); return { addTo: vi.fn() }; },
  layerGroup: () => ({ addTo() { return this; }, clearLayers: vi.fn() }),
  divIcon: vi.fn(),
  marker: (coords: unknown) => { fake.marker(coords); return { addTo() { return this; }, bindPopup() { return this; }, openPopup() { return this; }, on: vi.fn() }; },
  latLngBounds: vi.fn(),
} }));
import { LeafletMap } from '../src/components/maps/LeafletMap';

const provider = { id: 'tracking', name: 'Instrutor', categories: ['B'], latitude: -23.67, longitude: -46.67, ratingAverage: 0, startingPriceInCents: 10000 } as Provider;
const view = (selected: Provider) => <LeafletMap providers={[selected]} selectedProvider={selected} followSelectedProvider providerMarker="vehicle" zoom={17} />;

describe('professional map following', () => {
  beforeEach(() => { fake.setView.mockClear(); fake.remove.mockClear(); fake.marker.mockClear(); fake.failTiles = false; fake.events = {}; });
  afterEach(cleanup);

  it.each(['dragstart', 'zoomstart'])('preserves manual view after %s, then recenters on the latest GPS position', (event) => {
    const { rerender } = render(view(provider));
    expect(fake.setView).toHaveBeenLastCalledWith([-23.67, -46.67], 17, { animate: false });
    fake.events[event]();
    fake.setView.mockClear();
    const updated = { ...provider, latitude: -23.68 };
    rerender(view(updated));
    expect(fake.setView).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao profissional' }));
    expect(fake.setView).toHaveBeenLastCalledWith([-23.68, -46.67], 17, { animate: false });
    rerender(view({ ...updated, latitude: -23.69 }));
    expect(fake.setView).toHaveBeenLastCalledWith([-23.69, -46.67], 17, { animate: false });
  });

  it('does not show the tracking control on other maps', () => {
    render(<LeafletMap />);
    expect(screen.queryByRole('button', { name: 'Voltar ao profissional' })).toBeNull();
  });

  it.each([{ lat: undefined, lng: undefined }, { lat: NaN, lng: Infinity }, { lat: 91, lng: 181 }])('never forwards invalid coordinates to Leaflet: %o', (invalid) => {
    render(<LeafletMap meetingPoint={{ ...invalid, title: 'Invalid' } as any} userLocation={invalid as any} searchedLocation={invalid as any} />);
    expect(fake.setView).toHaveBeenCalledWith([-23.5615, -46.6914], 13, { animate: false });
    expect(fake.marker).not.toHaveBeenCalled();
  });

  it('uses the confirmed meeting point and cleans up on unmount', () => {
    const page = render(<LeafletMap meetingPoint={{ lat: -23.69, lng: -46.67, title: 'Encontro' }} />);
    expect(fake.setView).toHaveBeenCalledWith([-23.69, -46.67], 13, { animate: false });
    expect(fake.marker).toHaveBeenCalledWith([-23.69, -46.67]);
    page.unmount();
    expect(fake.remove).toHaveBeenCalledTimes(1);
  });

  it('removes a partially initialized map when a layer throws', () => {
    fake.failTiles = true;
    expect(() => render(<LeafletMap />)).toThrow('TEST_LAYER_FAILURE');
    expect(fake.remove).toHaveBeenCalled();
    fake.failTiles = false;
    expect(() => render(<LeafletMap />)).not.toThrow();
  });
});
