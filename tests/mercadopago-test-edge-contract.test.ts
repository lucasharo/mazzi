import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.resolve('supabase/functions/process-mercadopago-card-payment/index.ts'),
  'utf8'
);

describe('contrato seguro do pagamento Mercado Pago em DEV', () => {
  it('exige ambiente de teste, autenticação e idempotência', () => {
    expect(source).toContain('MERCADOPAGO_ENVIRONMENT')
    expect(source).toContain('!== "test"')
    expect(source).toContain('auth.getUser(token)')
    expect(source).toContain('X-Idempotency-Key')
  });

  it('usa o valor persistido e confirma somente pagamento aprovado', () => {
    expect(source).toContain('payment.amount_in_cents')
    expect(source).not.toContain('payload.transactionAmount')
    expect(source).toContain('result.status !== "approved"')
    expect(source).toContain('finalize_mercadopago_test_payment')
  });

  it('não aceita parcelamento ou meios assíncronos', () => {
    expect(source).toContain('payload.installments !== 1')
    expect(source).not.toContain('payment_method_id: "pix"')
    expect(source).not.toContain('ticket')
  });
});
