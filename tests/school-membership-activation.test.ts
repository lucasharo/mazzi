import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(__dirname, '../supabase/migrations/20260821235840_fix_school_membership_activation_preeligibility.sql'),
  'utf8',
);

describe('school membership activation pre-eligibility contract', () => {
  it('keeps activation as a secure forward-only RPC', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.try_activate_school_instructor_membership(');
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('SET search_path TO public, pg_temp');
    expect(migration).toContain("IF v_uid IS NULL THEN");
    expect(migration).toContain("RAISE EXCEPTION 'AUTH_REQUIRED'");
    expect(migration).toContain('public.is_compliance_reviewer()');
    expect(migration).toContain('public.is_school_admin(v_membership.school_id)');
    expect(migration).toContain('v_membership.user_id = v_uid');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.try_activate_school_instructor_membership(UUID) FROM PUBLIC, anon');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.try_activate_school_instructor_membership(UUID) TO authenticated');
  });

  it('checks pending membership, active school, active instructor, and instructor role', () => {
    expect(migration).toContain("v_membership.membership_status <> 'PENDING_COMPLIANCE'::public.school_membership_status");
    expect(migration).toContain("v_school.status <> 'ACTIVE'::public.provider_status");
    expect(migration).toContain("v_school.type <> 'DRIVING_SCHOOL'::public.provider_type");
    expect(migration).toContain("v_user.status <> 'ACTIVE'::public.user_status");
    expect(migration).toContain("v_user.role = 'INSTRUCTOR'::public.user_role");
    expect(migration).toContain("ur.role = 'INSTRUCTOR'::public.user_role");
    expect(migration).toContain("RAISE EXCEPTION 'PROVIDER_NOT_ACTIVE'");
    expect(migration).toContain("RAISE EXCEPTION 'USER_NOT_ACTIVE'");
    expect(migration).toContain("RAISE EXCEPTION 'INSTRUCTOR_ROLE_REQUIRED'");
  });

  it('uses both compliance checks without calling runtime eligibility', () => {
    expect(migration).toContain('public.is_instructor_global_compliance_valid(v_membership.user_id, NULL)');
    expect(migration).toContain('public.is_membership_compliance_valid(v_membership.id, NULL)');
    expect(migration).toContain("RAISE EXCEPTION 'COMPLIANCE_NOT_SATISFIED'");
    expect(migration).not.toContain('is_provider_instructor_eligible');
  });

  it('activates atomically and preserves idempotent non-pending behavior', () => {
    expect(migration).toContain("SET membership_status = 'ACTIVE'");
    expect(migration).toContain('is_active = TRUE');
    expect(migration).toContain('suspended_at = NULL');
    expect(migration).toContain('suspended_by = NULL');
    expect(migration).toContain('ended_at = NULL');
    expect(migration).toContain('ended_by = NULL');
    expect(migration).toContain('end_reason = NULL');
    expect(migration).toContain("'membership_id', v_membership.id");
    expect(migration).toContain("'status', 'ACTIVE'");
    expect(migration).toContain("RETURN jsonb_build_object(\n      'success', FALSE");
    expect(migration).toContain("'status', v_membership.membership_status");
  });
});
