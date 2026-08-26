import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260826034717_driving_school_public_onboarding.sql'),
  'utf8',
);
const validationFixMigration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260826142919_fix_driving_school_onboarding_validation.sql'),
  'utf8',
);
const authService = fs.readFileSync(path.join(process.cwd(), 'src/lib/auth-service.ts'), 'utf8');
const authContext = fs.readFileSync(path.join(process.cwd(), 'src/components/auth/AuthContext.tsx'), 'utf8');
const appLogin = fs.readFileSync(path.join(process.cwd(), 'src/components/auth/AppLogin.tsx'), 'utf8');
const button = fs.readFileSync(path.join(process.cwd(), 'src/components/ui/Button.tsx'), 'utf8');

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

  it('accepts normalized digit-only CNPJ, phone and postal-code values in the repaired RPC', () => {
    expect(validationFixMigration).toContain("regexp_replace(coalesce(p_cnpj, ''), '[^0-9]', '', 'g')");
    expect(validationFixMigration).toContain("regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')");
    expect(validationFixMigration).toContain("regexp_replace(coalesce(p_postal_code, ''), '[^0-9]', '', 'g')");
    expect(validationFixMigration).toContain("v_phone !~ '^[0-9]{10,11}$'");
    expect(validationFixMigration).toContain("v_postal_code !~ '^[0-9]{8}$'");
    expect(validationFixMigration).not.toContain("v_phone !~ '^\\\\d{10,11}$'");
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

  it('persists the selected professional path until the matching onboarding starts', () => {
    expect(appLogin).toContain("const PENDING_PROFESSIONAL_PATH_KEY = 'mazzi_pending_professional_path'");
    expect(appLogin).toContain("writePendingProfessionalPath('instructor')");
    expect(appLogin).toContain("writePendingProfessionalPath('school')");
    expect(appLogin).toContain("pendingPath === 'school'");
    expect(appLogin).toContain("setScreen('school_onboarding')");
    expect(appLogin).toContain("setScreen('instructor_onboarding')");
    expect(appLogin).toContain('clearPendingProfessionalPath();');
  });

  it('translates school onboarding validation errors into clear Portuguese feedback', () => {
    expect(appLogin).toContain("lower.includes('school_phone_invalid')");
    expect(appLogin).toContain("lower.includes('school_email_invalid')");
    expect(appLogin).toContain("lower.includes('school_location_not_confirmed')");
  });

  it('marks the resolved operational address as confirmed before calling the school RPC', () => {
    expect(appLogin).toContain('locationConfirmed: true');
    expect(appLogin).toContain('address: resolvedAddress ? { ...resolvedAddress, locationConfirmed: true }');
  });

  it('uses the authenticated account email when commercial contact is blank', () => {
    expect(appLogin).toContain('schoolEmail.trim() || user?.email?.trim() || email.trim()');
    expect(appLogin).toContain('E-mail para contato (opcional)');
  });

  it('uses the shared Button component as a responsive professional-path card', () => {
    expect(appLogin).toContain('function ProfessionalPathOption');
    expect(appLogin).toContain('min-h-[104px]');
    expect(appLogin).toContain('whitespace-normal');
    expect(appLogin).toContain('break-words text-xs');
    expect(appLogin).toContain('bg-[var(--mazzi-yellow-soft)]');
    expect(appLogin).toContain('Crio o espaço da autoescola e me torno seu administrador responsável.');
    expect(appLogin).toContain('contentClassName="flex-1 whitespace-normal"');
    expect(button).toContain('contentClassName = \'\'');
  });

  it('identifies the account holder as the school responsible before company onboarding', () => {
    expect(appLogin).toContain('Nome completo do responsável');
    expect(appLogin).toContain('Você será a pessoa responsável pela autoescola.');
    expect(appLogin).toContain('Depois de criar sua conta, informe CNPJ, razão social e endereço operacional da empresa.');
  });
});
