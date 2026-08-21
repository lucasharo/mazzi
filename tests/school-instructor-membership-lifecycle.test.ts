import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20260821200000_school_instructor_membership_lifecycle.sql'), 'utf8');
const historicalStaffPolicy = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20260814000003_auth_security_hardening.sql'), 'utf8');

describe('School-instructor invitation and membership security migration', () => {
  it('keeps the lifecycle model, backfill, and legacy compatibility', () => {
    expect(migration).toContain('CREATE TYPE public.school_invitation_status AS ENUM');
    expect(migration).toContain('CREATE TYPE public.school_membership_status AS ENUM');
    expect(migration).toContain('UPDATE public.driving_school_staff');
    expect(migration).toContain("WHEN is_active IS TRUE THEN 'ACTIVE'::public.school_membership_status");
    expect(migration).toContain("ELSE 'SUSPENDED'::public.school_membership_status");
    expect(fs.readFileSync(path.join(__dirname, '../supabase/migrations/20260814000001_initial_schema.sql'), 'utf8'))
      .toContain('UNIQUE(school_id, user_id)');
  });

  it('keeps invitations fail-closed and normalized', () => {
    expect(migration).toContain('NULLIF(BTRIM(invited_email), \'\') IS NOT NULL');
    expect(migration).toContain("CHECK (role = 'INSTRUCTOR')");
    expect(migration).toContain('LOWER(BTRIM(invited_email))');
    expect(migration).toContain('driving_school_invitations_pending_user_uidx');
    expect(migration).toContain('driving_school_invitations_pending_email_uidx');
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('REVOKE ALL ON TABLE public.driving_school_invitations FROM PUBLIC, anon, authenticated');
    expect(migration).not.toMatch(/\bcpf\b|document_number/i);
  });

  it('closes direct membership mutations while retaining legitimate SELECT access', () => {
    expect(migration).toContain('DROP POLICY IF EXISTS "School admin can manage school staff"');
    expect(migration).toContain('REVOKE INSERT, UPDATE, DELETE ON TABLE public.driving_school_staff FROM PUBLIC, anon, authenticated');
    expect(migration).not.toContain('CREATE POLICY "School admin can manage school staff"');
    expect(historicalStaffPolicy).toContain('CREATE POLICY "School staff and members can view their school team"');
  });

  it('defines secure invitation creation with school-admin, provider, identity, and expiry checks', () => {
    expect(migration).toContain('create_school_instructor_invitation(');
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('SET search_path TO public, pg_temp');
    expect(migration).toContain('is_school_admin(p_school_id)');
    expect(migration).toContain("v_school.type <> 'DRIVING_SCHOOL'::public.provider_type");
    expect(migration).toContain('LOWER(BTRIM(p_invited_email))');
    expect(migration).toContain('p_expires_in_days < 1 OR p_expires_in_days > 30');
    expect(migration).toContain('SELECT id INTO v_target_user_id');
    expect(migration).not.toContain('INSERT INTO auth.users');
    expect(migration).not.toContain('INSERT INTO public.users');
  });

  it('defines accept with identity validation, row lock, idempotent role, and pending compliance', () => {
    expect(migration).toContain('accept_school_instructor_invitation(p_invitation_id UUID)');
    expect(migration).toContain('FROM public.driving_school_invitations\n  WHERE id = p_invitation_id\n  FOR UPDATE');
    expect(migration).toContain('target_user_id <> v_uid');
    expect(migration).toContain('LOWER(BTRIM(v_user.email)) <> LOWER(BTRIM(v_invitation.invited_email))');
    expect(migration).toContain("INSERT INTO public.user_roles (user_id, role, granted_by)");
    expect(migration).toContain('ON CONFLICT (user_id, role) DO NOTHING');
    expect(migration).toContain("'PENDING_COMPLIANCE', FALSE");
    expect(migration).not.toContain("UPDATE public.users SET role");
    expect(migration).toContain("'MEMBERSHIP_REHIRE_FLOW_NOT_IMPLEMENTED'");
    expect(migration).toContain("status = 'ACCEPTED'");
  });

  it('defines decline, cancel, expiry, grants, and concurrency protections', () => {
    expect(migration).toContain('decline_school_instructor_invitation(p_invitation_id UUID)');
    expect(migration).toContain("status = 'DECLINED'");
    expect(migration).toContain('cancel_school_instructor_invitation(p_invitation_id UUID)');
    expect(migration).toContain("status = 'CANCELLED'");
    expect(migration).toContain("status = 'EXPIRED'");
    expect(migration.match(/FOR UPDATE/g)?.length).toBeGreaterThanOrEqual(4);
    expect(migration.match(/GRANT EXECUTE ON FUNCTION public\./g)).toHaveLength(4);
    expect(migration).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.[\s\S]*TO anon/i);
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.create_school_instructor_invitation');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.accept_school_instructor_invitation');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.decline_school_instructor_invitation');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.cancel_school_instructor_invitation');
  });

  it('leaves payment and UI scope untouched', () => {
    expect(migration).not.toMatch(/payment|fake_payment_gateway|MOCK_VALIDATION|StudentApp|AdminApp/i);
  });
});
