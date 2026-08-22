import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260822133721_admin_provider_and_role_operations.sql'),
  'utf8',
);
const adminApp = fs.readFileSync(path.join(process.cwd(), 'src/apps/admin/AdminApp.tsx'), 'utf8');
const dbService = fs.readFileSync(path.join(process.cwd(), 'src/lib/db-service.ts'), 'utf8');

describe('TASK-076 Admin operations contract', () => {
  it('secures provider lifecycle transitions with Admin RBAC and audit logging', () => {
    expect(migration).toContain('public.admin_review_provider');
    expect(migration).toContain('public.is_platform_admin()');
    expect(migration).toContain("p_status NOT IN ('ACTIVE', 'REJECTED', 'SUSPENDED', 'BLOCKED')");
    expect(migration).toContain('ADMIN_PROVIDER_REVIEW');
    expect(migration).toContain('PROVIDER_COMPLIANCE_REQUIRED');
    expect(adminApp).toContain('dbService.reviewProvider');
  });

  it('keeps role changes server-side and prevents self escalation', () => {
    expect(migration).toContain('public.admin_update_user_role');
    expect(migration).toContain('SELF_ROLE_CHANGE_FORBIDDEN');
    expect(migration).toContain('ADMIN_USER_ROLE_CHANGED');
    expect(dbService).toContain("sp.rpc('admin_update_user_role'");
  });

  it('limits refunds to fake providers, full remaining cents, and idempotent keys', () => {
    expect(migration).toContain('public.admin_refund_mock_booking');
    expect(migration).toContain('REAL_GATEWAY_REFUND_FORBIDDEN');
    expect(migration).toContain("'admin_mock_refund:' || p_booking_id::TEXT");
    expect(migration).toContain('v_payment.amount_in_cents - v_refunded');
    expect(adminApp).toContain('dbService.adminRefundMockBooking');
  });
});
