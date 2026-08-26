// @vitest-environment happy-dom
import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VehicleCatalogPicker, VehicleCatalogSelection } from '../src/components/vehicles/VehicleCatalogPicker';

const formDefaults: VehicleCatalogSelection = { brand: '', model: '', year: '' };

describe('VehicleCatalogPicker autocomplete', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('filters and selects FIPE suggestions using the same form fields', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      let data = [{ code: 'BMW', name: 'BMW' }];
      if (url.includes('/models')) data = [{ code: '116', name: '116iA 1.6 TB 16V 136cv 5p' }];
      if (url.includes('/years')) data = [{ code: '2024-1', name: '2024 Gasolina' }];
      return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
    }));

    function Harness() {
      const [form, setForm] = useState(formDefaults);
      return <VehicleCatalogPicker vehicleType="CAR" {...form} onChange={setForm} />;
    }

    render(<Harness />);
    const brandInput = screen.getByLabelText('Marca *');
    fireEvent.focus(brandInput);
    fireEvent.change(brandInput, { target: { value: 'bm' } });

    await screen.findByRole('option', { name: 'BMW' });
    fireEvent.click(screen.getByRole('option', { name: 'BMW' }));

    const modelInput = screen.getByLabelText('Modelo *');
    fireEvent.focus(modelInput);
    fireEvent.change(modelInput, { target: { value: '116' } });

    await screen.findByRole('option', { name: '116iA 1.6 TB 16V 136cv 5p' });
    expect((modelInput as HTMLInputElement).value).toBe('116');

    const yearInput = screen.getByLabelText('Ano *');
    expect((yearInput as HTMLInputElement).value).toBe('');
    fireEvent.change(yearInput, { target: { value: '2024abc' } });
    expect((yearInput as HTMLInputElement).value).toBe('2024');
  });
});
