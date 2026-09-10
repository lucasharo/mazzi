import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260910001206_admin_reports.sql'), 'utf8');
const panel = readFileSync(join(process.cwd(), 'src/components/admin/AdminReportsPanel.tsx'), 'utf8');
const adminApp = readFileSync(join(process.cwd(), 'src/apps/admin/AdminApp.tsx'), 'utf8');

describe('admin reports contract', () => {
  it('exposes one bounded, admin-only report RPC with explicit grants', () => {
    expect(migration).toContain('create or replace function public.get_admin_reports');
    expect(migration).toContain("p_date_to - p_date_from > interval '366 days'");
    expect(migration).toContain("not public.is_current_user_active() or not public.is_platform_admin()");
    expect(migration).toContain('security definer');
    expect(migration).toContain('revoke all on function public.get_admin_reports');
    expect(migration).toContain('grant execute on function public.get_admin_reports(timestamptz, timestamptz) to authenticated');
    expect(migration).not.toMatch(/recipient_email|storage_path|payment_token|card_number|cvv|chat|message_body/i);
  });

  it('contains the ten report domains requested by the Admin product surface', () => {
    for (const key of ['executive', 'bookings', 'revenue', 'payouts', 'supply', 'demand', 'users', 'compliance', 'cancellations', 'communications']) {
      expect(migration).toContain(`'${key}'`);
      expect(panel).toContain(`key: '${key}'`);
    }
  });

  it('keeps date controls, visibility controls and PDF export in the Admin route', () => {
    expect(panel).toContain('type="date"');
    expect(panel).toContain('aria-pressed={isSelected}');
    expect(panel).toContain('window.print()');
    expect(adminApp).toContain("{ id: 'reports', label: 'Relatórios'");
    expect(adminApp).toContain('<AdminReportsPanel');
  });
});
