import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260822133649_instructor_onboarding_and_security_cleanup.sql'),
  'utf8',
);
const authService = fs.readFileSync(path.join(process.cwd(), 'src/lib/auth-service.ts'), 'utf8');
const authContext = fs.readFileSync(path.join(process.cwd(), 'src/components/auth/AuthContext.tsx'), 'utf8');
const appLogin = fs.readFileSync(path.join(process.cwd(), 'src/components/auth/AppLogin.tsx'), 'utf8');

describe('TASK-076 instructor onboarding contract', () => {
  it('uses an authenticated, idempotent RPC and never accepts a client role/provider id', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.onboard_my_instructor()');
    expect(migration).toContain('auth.uid()');
    expect(migration).toContain("'INSTRUCTOR'::public.user_role");
    expect(migration).toContain('ON CONFLICT (user_id, role) DO NOTHING');
    expect(migration).toContain("'DRAFT'::public.provider_status");
    expect(migration).toContain('INSTRUCTOR_ONBOARDING_COMPLETED');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.onboard_my_instructor() TO authenticated');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.onboard_my_instructor() FROM PUBLIC, anon');
    expect(migration).not.toContain('p_role');
    expect(migration).not.toContain('p_provider_id');
  });

  it('keeps onboarding behind the service/RPC boundary and merges multi-role sessions', () => {
    expect(authService).toContain("supabase.rpc('onboard_my_instructor')");
    expect(authContext).toContain(".rpc('get_my_roles')");
    expect(authContext).not.toContain(".from('user_roles')");
    expect(authContext).toContain('const roles = Array.from(new Set<UserRole>');
    expect(appLogin).toContain('await onboardInstructor();');
  });

  it('does not make the initial instructor provider publicly sellable', () => {
    expect(migration).toContain("'DRAFT'::public.provider_status");
    expect(migration).toContain("v_provider.status");
    expect(migration).toContain("ALTER FUNCTION public.validate_cpf(TEXT) SET search_path TO public, pg_temp");
  });
});
