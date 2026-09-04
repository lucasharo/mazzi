// @vitest-environment happy-dom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('../src/components/maps/UniversalMap', () => ({ UniversalMap: () => <div data-testid="meeting-map" /> }));
vi.mock('../src/domain/maps/meeting-point-address', () => ({ resolveMeetingPointAddress: async () => 'Rua GPS, 2' }));
vi.mock('../src/components/search/ConfirmableAddressAutocomplete', () => ({
  ConfirmableAddressAutocomplete: ({ id, placeholder, value, onChange, onConfirm }: any) => <div><input id={id} placeholder={placeholder} aria-label="Endereço do encontro" value={value} onChange={e => onChange(e.target.value)} /><button onClick={() => onConfirm({ latitude: -23.69, longitude: -46.67 }, value)}>Confirmar endereço</button></div>,
}));
import { InstantLessonWizard } from '../src/components/instant/InstantLessonWizard';
import { instantOptionClassName } from '../src/components/instant/instant-option-style';
afterEach(cleanup);
beforeEach(() => sessionStorage.clear());
function setup(overrides: Record<string, unknown> = {}) {
  const props = { onClose: vi.fn(), location: { lat: -23.69, lng: -46.67 }, locationLabel: 'Rua de teste, 1', currentUserId: 'student',
    onRequestLocation: vi.fn().mockResolvedValue({ lat: -23.7, lng: -46.6 }),
    onLoadPriceOptions: vi.fn().mockResolvedValue([{ maxPriceInCents: 9500, eligibleProviderCount: 1 }, { maxPriceInCents: null, eligibleProviderCount: 2 }]),
    onStart: vi.fn().mockResolvedValue({ id: 'request', status: 'SEARCHING' }), ...overrides };
  return { ...props, ...render(<InstantLessonWizard {...props} />) };
}
const next = () => fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
async function prices() { next(); next(); await screen.findByRole('radio', { name: /Até R/ }); }
describe('Aula Agora three-step wizard', () => {
  it('shares price styling and check indicator with transmission choices', async () => {
    setup(); next();
    const manual = screen.getByRole('radio', { name: 'Manual' });
    fireEvent.click(manual);
    expect((manual as HTMLInputElement).checked).toBe(true);
    expect(manual.closest('label')?.className).toContain(instantOptionClassName(true));
    expect(manual.closest('label')?.querySelector('.lucide-check')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Tanto faz' }).closest('label')?.className).toContain(instantOptionClassName(false));
    next();
    const price = await screen.findByRole('radio', { name: /Até R/ });
    fireEvent.click(price);
    expect(price.className).toContain(instantOptionClassName(true));
    expect(price.querySelector('.lucide-check')).toBeTruthy();
  });
  it('uses the location card with its label, placeholder and GPS action', () => {
    setup({ locationLabel: '', location: undefined });
    expect(screen.getByLabelText('Localização')).toBe(screen.getByPlaceholderText('Digite um endereço, bairro ou local'));
    expect(screen.getByRole('button', { name: 'Usar minha localização' }).closest('.mazzi-card')).toBeTruthy();
  });
  it('keeps focus borders inside the scrolling area without the step caption', () => {
    const { container } = setup();
    const content = container.querySelector('.overflow-y-auto');
    expect(content?.classList.contains('px-1')).toBe(true);
    expect(content?.classList.contains('pt-1')).toBe(true);
    expect(screen.queryByText(/Etapa \d de 3/)).toBeNull();
    next();
    expect(container.querySelector('fieldset')?.classList.contains('min-w-0')).toBe(true);
    expect(screen.queryByText(/Etapa \d de 3/)).toBeNull();
  });
  it('skips category and fetches B prices only at the last step', async () => {
    const p = setup();
    expect(screen.getByRole('heading', { name: 'Onde será a aula?' })).toBeTruthy();
    expect(p.onLoadPriceOptions).not.toHaveBeenCalled();
    next(); fireEvent.click(screen.getByRole('radio', { name: 'Automático' })); next();
    await screen.findByRole('radio', { name: /Até R/ });
    expect(p.onLoadPriceOptions).toHaveBeenCalledWith({ latitude: -23.69, longitude: -46.67, category: 'B', transmission: 'AUTOMATIC' });
    expect(screen.getByRole('list', { name: 'Etapas da Aula Agora' }).children.length).toBe(3);
    expect(screen.queryByText('Categoria A')).toBeNull();
  });
  it('preserves answers and lookup on back/forward', async () => {
    const p = setup(); await prices();
    fireEvent.click(screen.getByRole('radio', { name: /Até R/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect((screen.getByLabelText('Endereço do encontro') as HTMLInputElement).value).toBe('Rua de teste, 1');
    await prices();
    expect(screen.getByRole('radio', { name: /Até R/ }).getAttribute('aria-checked')).toBe('true');
    expect(p.onLoadPriceOptions).toHaveBeenCalledTimes(1);
  });
  it('requires confirmed coordinates after address edits', () => {
    setup(); fireEvent.change(screen.getByLabelText('Endereço do encontro'), { target: { value: 'Rua nova' } });
    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar endereço' }));
    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(false);
  });
  it('requires price consent, sends unlimited as null and blocks double submit', async () => {
    const p = setup({ onStart: vi.fn(() => new Promise(() => {})) }); await prices();
    const submit = screen.getByRole('button', { name: 'Encontrar profissional' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: /Sem limite/ }));
    fireEvent.click(submit); fireEvent.click(submit);
    expect(p.onStart).toHaveBeenCalledTimes(1);
    expect(p.onStart).toHaveBeenCalledWith(expect.objectContaining({ category: 'B', maxPriceInCents: null }));
  });
  it('restarts on reopening, keeping only the last confirmed address', async () => {
    const p = setup();
    fireEvent.change(screen.getByLabelText('Endereço do encontro'), { target: { value: 'Rua consultada, 42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar endereço' }));
    next(); fireEvent.click(screen.getByRole('radio', { name: 'Manual' })); next();
    await screen.findByRole('radio', { name: /Até R/ });
    fireEvent.click(screen.getByRole('radio', { name: /Até R/ }));
    p.unmount();
    const second = setup();
    expect(screen.getByRole('heading', { name: 'Onde será a aula?' })).toBeTruthy();
    expect((screen.getByLabelText('Endereço do encontro') as HTMLInputElement).value).toBe('Rua consultada, 42');
    expect(second.onLoadPriceOptions).not.toHaveBeenCalled();
    next();
    expect((screen.getByRole('radio', { name: 'Manual' }) as HTMLInputElement).checked).toBe(false);
    next(); await screen.findByRole('radio', { name: /Até R/ });
    expect((screen.getByRole('button', { name: 'Encontrar profissional' }) as HTMLButtonElement).disabled).toBe(true);
    expect(JSON.parse(sessionStorage.getItem('mazzi:instant-wizard:student')!)).toEqual({ version: 2, address: 'Rua consultada, 42', location: { lat: -23.69, lng: -46.67 } });
    second.unmount(); setup({ currentUserId: 'other' });
    expect((screen.getByLabelText('Endereço do encontro') as HTMLInputElement).value).toBe('Rua de teste, 1');
  });
  it('does not resume an old saved step or price from the previous version', () => {
    sessionStorage.setItem('mazzi:instant-wizard:student', JSON.stringify({ at: Date.now(), draft: { step: 2, address: 'Endereço antigo confirmado', location: { lat: -23.69, lng: -46.67 }, transmission: 'AUTOMATIC', maxPrice: 9500, priceChosen: true } }));
    setup();
    expect(screen.getByRole('heading', { name: 'Onde será a aula?' })).toBeTruthy();
    expect((screen.getByLabelText('Endereço do encontro') as HTMLInputElement).value).toBe('Endereço antigo confirmado');
  });
  it('keeps the last confirmed address when an unconfirmed edit is abandoned', () => {
    const p = setup();
    fireEvent.change(screen.getByLabelText('Endereço do encontro'), { target: { value: 'Texto não confirmado' } });
    p.unmount(); setup();
    expect((screen.getByLabelText('Endereço do encontro') as HTMLInputElement).value).toBe('Rua de teste, 1');
  });
  it('offers retry and never starts without candidates', async () => {
    setup({ onLoadPriceOptions: vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue([{ maxPriceInCents: null, eligibleProviderCount: 0 }]) });
    next(); next(); await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar valores' }));
    await screen.findByText(/Nenhum profissional disponível agora/);
    expect((screen.getByRole('button', { name: 'Encontrar profissional' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('updates address from GPS and uses the reference white background', async () => {
    const p = setup();
    expect(p.container.querySelector('[data-component="instant-lesson-wizard"]')?.classList.contains('bg-white')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Usar minha localização' }));
    await waitFor(() => expect((screen.getByLabelText('Endereço do encontro') as HTMLInputElement).value).toBe('Rua GPS, 2'));
  });
});
