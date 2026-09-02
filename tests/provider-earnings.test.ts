// @vitest-environment happy-dom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ProviderBottomNav } from '../src/apps/provider/components/ProviderBottomNav';
import { ProviderEarningsTab } from '../src/apps/provider/components/ProviderEarningsTab';
import { buildProviderEarningsInsights } from '../src/domain/provider-earnings';
import { dbService } from '../src/lib/db-service';

afterEach(cleanup);

const reviews = (students: number) => ({
  review_count: students,
  distinct_students_count: students,
  rating_overall: 4.5,
  dimensions: {
    didactics: 4.8,
    punctuality: 4.1,
    safety: 4.7,
    vehicle: 4.5,
    cordiality: 4.6,
  },
});

const earningsSummary = {
  period: { from: '2026-08-03T03:00:00.000Z', to: '2026-09-02T03:00:00.000Z', timezone: 'America/Sao_Paulo' as const },
  current: { net_earned_cents: 10000, received_cents: 5000, to_receive_cents: 3000, blocked_cents: 2000, failed_cents: 0, lessons_completed: 2, average_ticket_cents: 5000 },
  previous: { net_earned_cents: 5000, received_cents: 5000, to_receive_cents: 0, blocked_cents: 0, failed_cents: 0, lessons_completed: 1, average_ticket_cents: 5000 },
  series: [{ date: '2026-09-01', net_earned_cents: 10000, lessons_completed: 2 }],
  upcoming_payouts: [{ date: '2026-09-03', amount_in_cents: 3000, payout_count: 1 }],
  upcoming_total_cents: 3000,
  reviews: reviews(30),
  generated_at: '2026-09-02T12:00:00.000Z',
};

describe('PRO Ganhos — navigation and deterministic insights', () => {
  it('shows Ganhos and Perfil in the main navigation', () => {
    const selected: string[] = [];
    render(React.createElement(ProviderBottomNav, { activeTab: 'dashboard', onTabChange: (tab) => selected.push(tab) }));

    expect(screen.getByRole('button', { name: 'Ganhos' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Perfil' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ganhos' }));
    expect(selected).toEqual(['earnings']);
  });

  it('does not unlock insights with 29 students, but unlocks at exactly 30', () => {
    expect(buildProviderEarningsInsights(reviews(29)).isUnlocked).toBe(false);
    expect(buildProviderEarningsInsights(reviews(29)).progress).toBe(29);

    const unlocked = buildProviderEarningsInsights(reviews(30));
    expect(unlocked.isUnlocked).toBe(true);
    expect(unlocked.strongest).toEqual(['Didática']);
    expect(unlocked.weakest).toEqual(['Pontualidade']);
  });

  it('ignores null dimensions and resolves ties in a stable order', () => {
    const result = buildProviderEarningsInsights({
      ...reviews(35),
      dimensions: { didactics: null, punctuality: 4.5, safety: 4.5, vehicle: null, cordiality: 4.5 },
    });
    expect(result.strongest).toEqual(['Pontualidade', 'Segurança', 'Cordialidade']);
    expect(result.weakest).toEqual([]);
  });

  it('keeps the dedicated financial contract centered on payouts and explicit payout states', () => {
    const migration = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260902020000_provider_earnings_performance.sql'), 'utf8');
    expect(migration).toContain('get_provider_earnings_summary');
    expect(migration).toContain('public.payouts');
    expect(migration).toContain("payout_status IN ('PENDING', 'AVAILABLE', 'PROCESSING')");
    expect(migration).toContain("payout_status = 'BLOCKED'");
    expect(migration).toContain("payout_status = 'FAILED'");
    expect(migration).toContain("COUNT(DISTINCT r.student_id)");
    expect(migration).not.toContain('payments.amount_in_cents');
  });

  it('uses 30 days by default, exposes the period controls and does not render zero while loading', async () => {
    const getSummary = vi.spyOn(dbService, 'getProviderEarningsSummary').mockResolvedValue(earningsSummary);
    render(React.createElement(ProviderEarningsTab));

    expect(screen.queryByText('R$ 0,00')).toBeNull();
    await screen.findByText('Ganhos líquidos');
    expect(getSummary).toHaveBeenCalledWith(30);
    expect(screen.getByRole('button', { name: '7 dias' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '14 dias' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '30 dias' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '7 dias' }));
    await waitFor(() => expect(getSummary).toHaveBeenLastCalledWith(7));
  });
});
