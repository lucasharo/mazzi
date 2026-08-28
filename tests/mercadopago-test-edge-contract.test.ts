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

  it('valida a propriedade do pagamento pela reserva, conforme o schema real', () => {
    expect(source).not.toContain('booking_id, student_id, amount_in_cents')
    expect(source).toContain('.select("id, student_id, status")')
    expect(source).toContain('booking.student_id !== authData.user.id')
    expect(source).toContain('if (paymentError) {')
    expect(source).toContain('return reply(500, { message: "Não foi possível consultar o pagamento.')
    expect(source).toContain('p_student_id: authData.user.id')
    expect(source).not.toContain('failed_at:')
  });

  it('não aceita parcelamento ou meios assíncronos', () => {
    expect(source).toContain('payload.installments !== 1')
    expect(source).not.toContain('payment_method_id: "pix"')
    expect(source).not.toContain('ticket')
  });

  it('explica em pt-BR como simular a aprovação no sandbox', () => {
    expect(source).toContain('informe APRO como nome do titular e CPF 123.456.789-09')
    expect(source).not.toContain('cc_rejected_other_reason')
  });

  it('envia o e-mail preenchido no Brick e normaliza apenas o documento', () => {
    expect(source).toContain('const payerEmail = isValidEmail(payload.payer?.email)')
    expect(source).toContain('email: payerEmail')
    expect(source).toContain('number: String(payerIdentification.number).replace(/\\D/g, "")')
  });
});
