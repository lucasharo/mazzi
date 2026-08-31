import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const edgeFunction = readFileSync(
  resolve(root, 'supabase/functions/create-stripe-payment-intent/index.ts'),
  'utf8',
);
const checkout = readFileSync(
  resolve(root, 'src/apps/student/components/CheckoutModal.tsx'),
  'utf8',
);

describe('Stripe Pix configuration guard', () => {
  it('marks rejected Stripe attempts as failed and keeps the booking retryable', () => {
    expect(edgeFunction).toContain('status: "FAILED"');
    expect(edgeFunction).toContain('failureReason');
    expect(edgeFunction).toContain('.in("status", ["PENDING", "AUTHORIZED"])');
    expect(edgeFunction).toContain('code: "STRIPE_PIX_NOT_ENABLED"');
    expect(edgeFunction).toContain('automatic_payment_methods[enabled]');
    expect(edgeFunction).not.toContain('form.append("payment_method_types[]"');
  });

  it('exposes a clear action when Stripe has Pix disabled', () => {
    expect(checkout).toContain("technicalMessage.includes('STRIPE_PIX_NOT_ENABLED')");
    expect(checkout).toContain('Ative Pix em Payment methods no Dashboard');
  });
});
