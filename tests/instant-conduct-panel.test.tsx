// @vitest-environment happy-dom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const service = vi.hoisted(() => ({ list: vi.fn(), review: vi.fn(), appeal: vi.fn() }));
vi.mock('../src/lib/instant-conduct-service', () => ({ instantConductService: service }));
import { InstantConductPanel } from '../src/components/instant/InstantConductPanel';
const item = { id: 'case-1', booking_id: 'booking-1', instructor_id: 'instructor-1', instructor_name: 'Instrutor', kind: 'CANCELLATION', occurred_at: new Date().toISOString(), decision: 'PENDING', suspension_until: null };
describe('Aula Agora disciplinary review', () => {
  beforeEach(() => { vi.clearAllMocks(); service.list.mockResolvedValue([item]); service.review.mockResolvedValue(undefined); service.appeal.mockResolvedValue(undefined); });
  afterEach(cleanup);
  it('does not present an unreviewed cancellation as punishment', async () => {
    render(<InstantConductPanel />);
    await screen.findByText('Aguardando análise');
    expect(screen.queryByText('Advertência registrada')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Confirmar injustificado' })).toBeNull();
  });
  it('allows the instructor to appeal only through the appeal RPC', async () => {
    render(<InstantConductPanel />);
    await screen.findByText('Aguardando análise');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Emergência médica comprovada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar para análise' }));
    await waitFor(() => expect(service.appeal).toHaveBeenCalledWith('case-1', 'Emergência médica comprovada'));
    expect(service.review).not.toHaveBeenCalled();
  });
  it('requires a justification before administrative exemption', async () => {
    render(<InstantConductPanel admin />);
    await screen.findByText('Aguardando análise');
    const button = screen.getByRole('button', { name: 'Isentar penalidade' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Falha comprovada da plataforma' } });
    fireEvent.click(button);
    await waitFor(() => expect(service.review).toHaveBeenCalledWith('case-1', 'EXEMPT', 'Falha comprovada da plataforma'));
  });
  it('shows the suspension deadline returned by the server', async () => {
    service.list.mockResolvedValue([{ ...item, decision: 'UNJUSTIFIED', suspension_until: new Date(Date.now()+86400000).toISOString() }]);
    render(<InstantConductPanel />);
    await screen.findByText(/Aula Agora suspensa até/);
  });
});
