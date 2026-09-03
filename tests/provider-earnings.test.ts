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

const root = process.cwd();

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
  it('uses the canonical five-slot navigation with Perfil and Gestão, keeping Agenda inside Gestão', () => {
    const selected: string[] = [];
    render(React.createElement(ProviderBottomNav, { activeTab: 'dashboard', onTabChange: (tab) => selected.push(tab) }));

    expect(screen.getByRole('button', { name: 'Ganhos' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Gestão' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Perfil' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Agenda' })).toBeNull();
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

  it('requires the original Stripe PaymentIntent as the source for Brazilian transfers', () => {
    const migration = fs.readFileSync(
      path.join(root, 'supabase/migrations/20260903024757_stripe_brazil_payout_source_transaction_cast.sql'),
      'utf8',
    );
    const processor = fs.readFileSync(
      path.join(root, 'supabase/functions/process-automatic-stripe-payouts/index.ts'),
      'utf8',
    );

    expect(migration).toContain("payment.external_transaction_id ~ '^pi_[A-Za-z0-9]+$'");
    expect(migration).toContain('stripe_payment_intent_id TEXT');
    expect(processor).toContain('latest_charge');
    expect(processor).toContain('source_transaction: sourceTransaction');
    expect(processor).toContain('STRIPE_SOURCE_TRANSACTION_NOT_FOUND');
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

  it('renders the earnings line without point markers', () => {
    const source = fs.readFileSync(path.join(root, 'src/apps/provider/components/ProviderEarningsTab.tsx'), 'utf8');
    expect(source).not.toContain('<circle cx={getX');
  });

  it('uses unique semantic keys for the y-axis labels when max equals the midpoint', () => {
    const source = fs.readFileSync(path.join(root, 'src/apps/provider/components/ProviderEarningsTab.tsx'), 'utf8');
    expect(source).toContain("{ id: 'top', value: max }");
    expect(source).toContain("{ id: 'middle', value: Math.round(max / 2) }");
    expect(source).toContain("{ id: 'bottom', value: 0 }");
    expect(source).not.toContain('[max, Math.round(max / 2), 0].map((value) => <span key={value}>');
  });

  it('marks the management tabs that require action with a pending indicator', () => {
    const tabs = fs.readFileSync(path.join(root, 'src/components/ui/Tabs.tsx'), 'utf8');
    const management = fs.readFileSync(path.join(root, 'src/apps/provider/components/ProviderManagementTab.tsx'), 'utf8');
    expect(tabs).toContain('hasPending?: boolean;');
    expect(tabs).toContain('tab.hasPending');
    expect(tabs).toContain('h-3 w-3 rounded-full bg-rose-500');
    expect(tabs).not.toContain('ring-2 ring-white');
    expect(management).toContain("hasPending: hasPendingOfferings");
    expect(management).toContain("hasPending: hasPendingPayoutSetup");
    expect(management).toContain("hasPending: hasPendingSchedule");
    expect(management).toContain("hasPending: hasPendingVehicles");
  });
});
