import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260912194414_stripe_connect_balance_payout_reconciliation.sql'), 'utf8');
const processor = fs.readFileSync(path.join(root, 'supabase/functions/process-automatic-stripe-payouts/index.ts'), 'utf8');
const webhook = fs.readFileSync(path.join(root, 'supabase/functions/stripe-webhook/index.ts'), 'utf8');

describe('Stripe Connect payout reconciliation contract', () => {
  it('persists available_on separately from arrival_date', () => {
    expect(migration).toContain('stripe_available_on TIMESTAMPTZ');
    expect(migration).toContain('stripe_arrival_date=COALESCE');
  });
  it('converts Unix available_on to ISO timestamptz', () => expect(processor).toContain('new Date(Number(balanceTransaction.available_on) * 1000).toISOString()'));
  it('queries the connected account ledger', () => expect(processor).toContain('"Stripe-Account": account'));
  it('matches the transfer by BalanceTransaction.source', () => expect(processor).toContain('item?.source === transferId'));
  it('keeps Transfer success when available_on lookup fails', () => {
    expect(processor).toContain('const available = await persistAvailableOn');
    expect(processor).toContain('return { success: true, transferId: stripePayload.id, available }');
  });
  it('retries legacy transfers without creating a new transfer', () => {
    expect(migration).toContain('claim_stripe_transfer_reconciliation');
    expect(processor).toContain('operation: "available_on_reconciliation"');
  });
  it('uses a stable idempotency key for Transfer creation', () => expect(processor).toContain('"Idempotency-Key": String(payout.idempotency_key)'));
  it('never creates a Stripe bank payout manually', () => {
    expect(processor).not.toContain('/v1/payouts');
    expect(webhook).not.toContain('/v1/payouts');
  });
  it('accepts all connected-account payout lifecycle events', () => {
    expect(webhook).toContain('eventType.startsWith("payout.")');
    expect(webhook).toContain('event.account');
  });
  it('reconciles payout transactions using the payout filter', () => expect(webhook).toContain('payout: stripePayoutId'));
  it('does not use amount or date heuristics', () => {
    expect(webhook).not.toContain('amount ===');
    expect(webhook).not.toContain('arrival_date ===');
  });
  it('records Stripe failure code and message separately', () => {
    expect(migration).toContain('stripe_failure_code');
    expect(migration).toContain('stripe_failure_message');
  });
  it('records paid time independently from MAZZI release time', () => {
    expect(migration).toContain('stripe_paid_at');
    expect(migration).toContain('released_at=COALESCE(released_at,NOW())');
  });
  it('does not regress a paid payout on an older event', () => expect(migration).toContain("IF v_was_paid AND v_status<>'PAID'"));
  it('prevents one po from being linked to two MAZZI payouts', () => {
    expect(migration).toContain('STRIPE_PAYOUT_ALREADY_LINKED');
    expect(migration).toContain('uq_payouts_external_payout_id');
  });
  it('rejects a Connected Account mismatch', () => {
    expect(migration).toContain('STRIPE_PAYOUT_ACCOUNT_MISMATCH');
    expect(webhook).toContain('connectedAccount');
  });
  it('keeps the zero and non-zero safety period rule untouched', () => {
    const source = fs.readFileSync(path.join(root, 'supabase/migrations/20260901040159_disputes_and_automatic_payouts.sql'), 'utf8');
    expect(source).toContain('get_payout_safety_period_hours');
    expect(source).toContain('make_interval(hours => public.get_payout_safety_period_hours())');
  });
  it('exposes the three distinct dates to the provider surface', () => {
    expect(migration).toContain("'stripe_available_on'");
    expect(migration).toContain("'stripe_arrival_date'");
    expect(migration).toContain("'scheduled_release_at'");
  });
  it('covers legacy transfer rows with no external payout id', () => expect(migration).toContain('external_payout_id IS NULL'));
});
