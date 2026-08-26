import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260826214337_fix_provider_privacy_and_school_schedule_bootstrap.sql'),
  'utf8',
);
const providerProfile = fs.readFileSync(
  path.join(root, 'src/apps/provider/components/ProviderProfileTab.tsx'),
  'utf8',
);

describe('TASK-078 audit remediation contracts', () => {
  it('removes anonymous direct access to the private providers base table', () => {
    expect(migration).toContain('REVOKE SELECT ON TABLE public.providers FROM PUBLIC, anon');
    expect(migration).toContain('DROP POLICY IF EXISTS anon_public_active_providers ON public.providers');
    expect(migration).not.toContain('GRANT SELECT ON TABLE public.providers TO anon');
  });

  it('enforces normalized valid CNPJ for driving-school providers', () => {
    expect(migration).toContain('providers_driving_school_cnpj_valid_ck');
    expect(migration).toContain("document_number ~ '^[0-9]{14}$'");
    expect(migration).toContain('public.validate_cnpj(document_number)');
    expect(migration).toContain('VALIDATE CONSTRAINT providers_driving_school_cnpj_valid_ck');
  });

  it('bootstraps school availability only once from a real instructor + vehicle resource', () => {
    expect(migration).toContain('bootstrap_driving_school_default_availability');
    expect(migration).toContain("dss.role = 'INSTRUCTOR'::public.user_role");
    expect(migration).toContain("dss.membership_status = 'ACTIVE'::public.school_membership_status");
    expect(migration).toContain("TIME '08:00'");
    expect(migration).toContain("TIME '18:00'");
    expect(migration).toContain("'America/Sao_Paulo'");
    expect(migration).toContain('FROM generate_series(1, 5) AS weekday');
    expect(migration).toContain('provider_schedule_bootstrap');
  });

  it('marks pre-existing schools as processed instead of backfilling schedule rows', () => {
    const markerPosition = migration.indexOf('INSERT INTO public.provider_schedule_bootstrap(provider_id)');
    const triggerPosition = migration.indexOf('CREATE OR REPLACE FUNCTION public.bootstrap_driving_school_default_availability');
    expect(markerPosition).toBeGreaterThan(-1);
    expect(triggerPosition).toBeGreaterThan(markerPosition);
  });

  it('does not offer school profile editing to SCHOOL_STAFF', () => {
    expect(providerProfile).toContain("const canEditProfile = currentRole !== 'SCHOOL_STAFF';");
    expect(providerProfile).toContain('!isEditingProfile && canEditProfile');
    expect(providerProfile).toContain('Alterações no perfil da Autoescola são exclusivas para administradores da escola.');
  });
});
