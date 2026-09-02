import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260831021313_stripe_webhook_server_confirmation.sql'),
  'utf8',
);
const webhook = readFileSync(
  resolve(process.cwd(), 'supabase/functions/stripe-webhook/index.ts'),
  'utf8',
);

describe('Stripe webhook confirmation recovery', () => {
  it('keeps Stripe confirmation restricted to the service role', () => {
    expect(migration).toContain("v_is_service_role BOOLEAN := COALESCE(auth.jwt() ->> 'role', '') = 'service_role'");
    expect(migration).toContain("v_is_service_role AND v_payment.gateway_provider = 'stripe'");
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.confirm_booking_payment(UUID, VARCHAR, TIMESTAMPTZ) FROM PUBLIC, anon;');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.confirm_booking_payment(UUID, VARCHAR, TIMESTAMPTZ) TO authenticated, service_role;');
  });

  it('reprocesses recorded webhook events that previously failed', () => {
    expect(webhook).toContain('if (["PROCESSED", "IGNORED"].includes(existingEvent.status))');
    expect(webhook).toContain('webhookEvent = existingEvent;');
    expect(webhook).toContain('eventError = null;');
    expect(webhook).toContain('status: "RECEIVED"');
  });

  it('persists the real Stripe checkout fee from the balance transaction', () => {
    expect(webhook).toContain('balance_transactions/${balanceTransactionId}');
    expect(webhook).toContain('expand[]", "latest_charge.balance_transaction"');
    expect(webhook).toContain('gateway_fee_in_cents = gatewayFeeInCents');
    expect(webhook).toContain('eventType === "charge.succeeded"');
    expect(webhook).toContain('if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500));');
  });
});
