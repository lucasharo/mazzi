import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260826034717_driving_school_public_onboarding.sql'),
  'utf8',
);
const authService = fs.readFileSync(path.join(process.cwd(), 'src/lib/auth-service.ts'), 'utf8');
const authContext = fs.readFileSync(path.join(process.cwd(), 'src/components/auth/AuthContext.tsx'), 'utf8');
const appLogin = fs.readFileSync(path.join(process.cwd(), 'src/components/auth/AppLogin.tsx'), 'utf8');

describe('public driving-school onboarding', () => {
  it('derives the responsible identity and school admin role exclusively from auth.uid()', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.onboard_my_driving_school(');
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('SET search_path TO public, pg_temp');
    expect(migration).toContain('v_uid uuid := auth.uid()');
    expect(migration).toContain("'SCHOOL_ADMIN'::public.user_role");
    expect(migration).toContain('ON CONFLICT (school_id, user_id) DO UPDATE');
    expect(migration).not.toContain('p_user_id');
    expect(migration).not.toContain('p_school_id');
    expect(migration).not.toContain('p_role');
  });

  it('requires valid CNPJ, commercial details and a confirmed private address before creating a DRAFT workspace', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.validate_cnpj');
    expect(migration).toContain("RAISE EXCEPTION 'CNPJ_INVALID'");
    expect(migration).toContain("RAISE EXCEPTION 'SCHOOL_ADDRESS_INVALID'");
    expect(migration).toContain("RAISE EXCEPTION 'SCHOOL_LOCATION_NOT_CONFIRMED'");
    expect(migration).toContain("'DRAFT'::public.provider_status");
    expect(migration).toContain('commercial_email');
  });

  it('is retry safe and rejects attempts to take over an existing school CNPJ', () => {
    expect(migration).toContain("pg_advisory_xact_lock(hashtextextended('driving-school-cnpj:' || v_cnpj, 0))");
    expect(migration).toContain("RAISE EXCEPTION 'CNPJ_ALREADY_REGISTERED'");
    expect(migration).toContain("'is_idempotent', NOT v_created");
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.onboard_my_driving_school');
    expect(migration).toContain('TO authenticated');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.onboard_my_driving_school');
  });

  it('reuses the canonical address form and preserves multi-workspace sessions', () => {
    expect(appLogin).toContain('Sou instrutor autônomo');
    expect(appLogin).toContain('Represento uma Autoescola / CFC');
    expect(appLogin).toContain('ProviderAddressForm idPrefix="driving-school-onboarding"');
    expect(appLogin).toContain('await onboardDrivingSchool({');
    expect(authService).toContain("onboard_my_driving_school");
    expect(authContext).toContain("roles.includes('SCHOOL_ADMIN') && schoolProvider");
    expect(authContext).not.toContain(".select('id,status')\n          .eq('user_id', profile.id)\n          .maybeSingle()");
  });
});
