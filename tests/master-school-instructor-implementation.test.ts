import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const sql = (file: string) => read(file).toLowerCase().replace(/\s+/g, ' ');

describe('MASTER school-instructor implementation contracts', () => {
  it('keeps the applied migration filenames aligned with LIVE history', () => {
    for (const file of [
      '20260821211805_school_instructor_membership_lifecycle.sql',
      '20260821211815_instructor_global_compliance_scope.sql',
      '20260821212128_school_membership_events_selection.sql',
      '20260821212131_school_compliance_runtime_rpcs.sql',
      '20260821212134_school_rehire_and_listing.sql',
      '20260821212313_runtime_eligibility_gates.sql',
      '20260821212317_legacy_provider_compliance_compatibility.sql',
      '20260821212518_school_membership_management_reads.sql',
      '20260821212857_fix_runtime_booking_and_search_gates.sql',
      '20260821213335_revoke_internal_lifecycle_exec.sql',
      '20260821213422_allow_terminal_booking_fixtures.sql',
      '20260821213516_allow_legacy_terminal_booking_rows.sql',
    ]) expect(fs.existsSync(path.join(root, 'supabase/migrations', file))).toBe(true);
    expect(fs.existsSync(path.join(root, 'supabase/migrations/20260821200000_school_instructor_membership_lifecycle.sql'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'supabase/migrations/20260821210000_instructor_global_compliance_scope.sql'))).toBe(false);
  });

  it('preserves TASK-072 migrations and adds forward-only runtime migrations', () => {
    expect(fs.existsSync(path.join(root, 'supabase/migrations/20260821212128_school_membership_events_selection.sql'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'supabase/migrations/20260821212131_school_compliance_runtime_rpcs.sql'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'supabase/migrations/20260821212134_school_rehire_and_listing.sql'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'supabase/migrations/20260821212313_runtime_eligibility_gates.sql'))).toBe(true);
  });

  it('models membership history, rehire, selection mode and per-instructor offering uniqueness', () => {
    const migration = sql('supabase/migrations/20260821212128_school_membership_events_selection.sql');
    expect(migration).toContain('driving_school_membership_events');
    expect(migration).toContain("rehire_invited");
    expect(migration).toContain("rehire_accepted");
    expect(migration).toContain('booking_selection_mode');
    expect(migration).toContain('alter table public.quotes');
    expect(migration).toContain('alter table public.bookings');
    expect(migration).toContain('provider_id, instructor_id, vehicle_id, category, duration_minutes');
    expect(migration).not.toContain('driving_school_staff(id) on delete cascade');
  });

  it('defines secure compliance RPCs and canonical eligibility helper', () => {
    const migration = sql('supabase/migrations/20260821212131_school_compliance_runtime_rpcs.sql');
    for (const fn of [
      'is_instructor_global_compliance_valid',
      'is_membership_compliance_valid',
      'is_provider_instructor_eligible',
      'list_my_global_compliance',
      'submit_my_global_compliance_document',
      'review_compliance_document',
      'get_school_instructor_compliance_summary',
    ]) expect(migration).toContain(`public.${fn}`);
    expect(sql('supabase/migrations/20260821212128_school_membership_events_selection.sql'))
      .toContain('try_activate_school_instructor_membership');
    expect(migration).toContain('security definer');
    expect(migration).toContain('set search_path to public, pg_temp');
    expect(migration).toContain('grant execute');
    expect(migration).toContain('revoke all');
  });

  it('supports ended-membership rehire without a second membership row', () => {
    const migration = sql('supabase/migrations/20260821212134_school_rehire_and_listing.sql');
    expect(migration).toContain('membership_status <> \'ended\'');
    expect(migration).toContain("membership_status='pending_compliance'");
    expect(migration).toContain('rehire_accepted');
    expect(migration).not.toContain('membership_rehire_flow_not_implemented');
  });

  it('adds runtime gates and keeps payment fake', () => {
    const migration = sql('supabase/migrations/20260821212313_runtime_eligibility_gates.sql');
    expect(migration).toContain('is_provider_instructor_eligible');
    expect(migration).toContain('instructor_not_eligible');
    expect(migration).toContain('instructor_compliance_invalid_at_lesson_start');
    expect(read('src/apps/student/StudentApp.tsx')).toContain('contextsByInstructor');
    expect(read('src/domain/payments/payment-service.ts')).not.toContain('stripe.com');
  });

  it('documents the safe legacy direct compliance insert boundary', () => {
    const policy = sql('supabase/migrations/20260814000004_providers_compliance.sql');
    expect(policy).toContain('create policy "providers can insert own compliance documents"');
    expect(policy).toContain("and status = 'pending'");
    expect(policy).toContain('is_provider_owner(provider_id) or user_id = auth.uid()');
    expect(policy).not.toContain("status = 'approved'");
  });
});
