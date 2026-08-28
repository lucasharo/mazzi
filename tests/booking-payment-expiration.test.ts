import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const migration = fs.readFileSync(
  path.resolve('supabase/migrations/20260828050000_expire_pending_payment_bookings.sql'),
  'utf8'
);

describe('expiração automática da reserva aguardando pagamento', () => {
  it('usa pg_cron, expira somente reservas vencidas e registra auditoria', () => {
    expect(migration).toContain('CREATE EXTENSION IF NOT EXISTS pg_cron');
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.expire_pending_payment_bookings()");
    expect(migration).toContain("status = 'PENDING_PAYMENT'");
    expect(migration).toContain('hold_expires_at <= v_now');
    expect(migration).toContain("status = 'EXPIRED'");
    expect(migration).toContain("'BOOKING_PAYMENT_HOLD_EXPIRED'");
    expect(migration).toContain("'* * * * *'");
  });
});
