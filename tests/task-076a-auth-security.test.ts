import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260822152930_task_076a_auth_roles_and_safe_indexes.sql'),
  'utf8',
);
const authContext = fs.readFileSync(path.join(process.cwd(), 'src/components/auth/AuthContext.tsx'), 'utf8');

describe('TASK-076A auth and role security contracts', () => {
  it('hydrates roles through a closed RPC and fails closed on role errors', () => {
    expect(authContext).toContain("sp.rpc('get_my_roles')");
    expect(authContext).not.toContain(".from('user_roles')");
    expect(authContext).toContain('AUTH_ROLES_UNAVAILABLE');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.get_my_roles()');
    expect(migration).toContain("RAISE EXCEPTION 'AUTH_REQUIRED'");
    expect(migration).toContain('LANGUAGE plpgsql');
    expect(migration).toContain('auth.uid()');
    expect(migration).toContain('u.status = \'ACTIVE\'::public.user_status');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.get_my_roles() FROM PUBLIC');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.get_my_roles() TO authenticated');
  });

  it('re-hydrates the canonical session after instructor onboarding', () => {
    expect(authContext).toContain('await onboardInstructorService()');
    expect(authContext).toContain('await handleSession(session)');
    expect(authContext).toContain('AUTH_SESSION_UNAVAILABLE');
  });

  it('revokes only the old primary role while preserving secondary roles', () => {
    expect(migration).toContain('DELETE FROM public.user_roles');
    expect(migration).toContain('role = v_previous.role');
    expect(migration).toContain('v_before_roles');
    expect(migration).toContain('v_after_roles');
    expect(migration).toContain('SELF_ROLE_CHANGE_FORBIDDEN');
    expect(migration).toContain('WHERE user_id = p_user_id AND role = v_previous.role;');
    expect(migration).toContain('INSERT INTO public.user_roles(user_id, role, granted_by)');
  });

  it('adds only explicitly missing FK indexes and leaves policy consolidation deferred', () => {
    expect(migration).toContain('idx_compliance_documents_user_id');
    expect(migration).toContain('idx_compliance_documents_vehicle_id');
    expect(migration).toContain('idx_school_invitations_target_user_id');
    expect(migration).toContain('idx_membership_events_user_id');
    expect(migration).toContain('idx_payouts_booking_id');
    expect(migration).toContain('idx_refunds_payment_id');
    expect(migration).toContain('no permissive policy is consolidated');
  });
});
