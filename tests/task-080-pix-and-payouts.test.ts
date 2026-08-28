import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const migration = readFileSync(resolve(root, 'supabase/migrations/20260828023332_pix_receiving_and_manual_payouts.sql'), 'utf8');
const pixFunction = readFileSync(resolve(root, 'supabase/functions/process-mercadopago-pix-payment/index.ts'), 'utf8');
const webhookFunction = readFileSync(resolve(root, 'supabase/functions/mercadopago-payment-webhook/index.ts'), 'utf8');

describe('TASK-080 — Pix e repasse manual', () => {
  it('mantém dinheiro em centavos, cria idempotência e fecha escrita direta nas tabelas financeiras', () => {
    expect(migration).toContain('gateway_fee_in_cents INTEGER');
    expect(migration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS payouts_booking_id_unique');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.payment_webhook_events');
    expect(migration).toContain('CREATE POLICY payouts_no_direct_client_select ON public.payouts FOR SELECT TO authenticated USING (FALSE)');
    expect(migration).toContain("p_gateway_provider NOT IN ('fake_payment_gateway', 'mercadopago_test')");
  });

  it('protege o fluxo Pix no backend e não permite produção', () => {
    expect(pixFunction).toContain('MERCADOPAGO_ENVIRONMENT')
    expect(pixFunction).toContain('X-Idempotency-Key');
    expect(pixFunction).toContain('/v1/payments/${encodeURIComponent(payment.external_transaction_id)}');
    expect(pixFunction).toContain('gatewayStatus');
    expect(pixFunction).toContain('amount_in_cents');
    expect(pixFunction).toContain('finalize_mercadopago_pix_payment');
    expect(pixFunction).toContain('20 * 1000');
    expect(webhookFunction).toContain('MERCADOPAGO_WEBHOOK_SECRET');
    expect(webhookFunction).toContain('signaturesMatch');
    expect(webhookFunction).toContain('payment_webhook_events');
  });

  it('mantém a regra de repasse manual com referência e destino Pix', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.mark_manual_payout');
    expect(migration).toContain('TRANSFER_REFERENCE_REQUIRED');
    expect(migration).toContain('PIX_DESTINATION_REQUIRED');
    expect(migration).toContain("MANUAL_PIX_PAYOUT_COMPLETED");
    expect(migration).toContain("max_total_fee_percentage");
    expect(migration).toContain("'BLOCKED'::public.payout_status");
  });
});
