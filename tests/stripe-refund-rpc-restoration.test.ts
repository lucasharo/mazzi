import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20260912144209_restore_process_booking_refund.sql',
  'utf8',
);

describe('Stripe refund RPC restoration', () => {
  it('restores a service-only, idempotent refund finalizer', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.process_booking_refund(');
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('SET search_path TO public, pg_temp');
    expect(migration).toContain('r.external_refund_id = p_external_refund_id');
    expect(migration).toContain("'PARTIALLY_REFUNDED'::public.payment_status");
    expect(migration).toContain('refund_amount_in_cents = v_total_refunded');
    expect(migration).toContain('FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('TO service_role');
    expect(migration).toContain("NOTIFY pgrst, 'reload schema'");
    expect(migration).not.toContain('financial_events');
    expect(migration).not.toContain('GRANT EXECUTE ON FUNCTION public.process_booking_refund(uuid, integer, varchar, varchar, varchar)\n  TO authenticated');
  });
});
