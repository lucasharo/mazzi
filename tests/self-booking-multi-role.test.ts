import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260825211702_prevent_student_self_booking.sql'),
  'utf8',
);
const studentCard = readFileSync(
  resolve(process.cwd(), 'src/apps/student/components/StudentProMigrationCard.tsx'),
  'utf8',
);
const studentRoot = readFileSync(
  resolve(process.cwd(), 'src/entrypoints/student/StudentRoot.tsx'),
  'utf8',
);

describe('multi-role self-booking contract', () => {
  it('centralizes identity conflict resolution without email or UUID hardcoding', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.is_self_booking_context');
    expect(migration).toContain('auth.uid()');
    expect(migration).toContain("v_provider_type = 'INSTRUCTOR' AND v_provider_user_id = v_user_id");
    expect(migration).toContain('p_instructor_id = v_user_id');
    expect(migration).not.toMatch(/lucas-haro@hotmail\.com/i);
    expect(migration).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  });

  it('applies self-booking protection to every public and authenticated funnel gate', () => {
    for (const functionName of [
      'search_providers_public',
      'get_provider_booking_context_public',
      'get_available_slots_public',
      'create_quote_from_offering',
      'create_booking_hold',
    ]) {
      expect(migration).toContain(`CREATE OR REPLACE FUNCTION public.${functionName}`);
    }
    expect(migration.match(/is_self_booking_context/g)?.length).toBeGreaterThanOrEqual(8);
    expect(migration).toContain("'SELF_BOOKING_NOT_ALLOWED'");
    expect(migration).toContain("NOT public.is_self_booking_context(o.provider_id, o.instructor_id)");
    expect(migration).toContain("NOT public.is_self_booking_context(so_avail.provider_id, so_avail.instructor_id)");
  });

  it('keeps anonymous search available and preserves school other-instructor offerings', () => {
    const searchStart = migration.indexOf('CREATE OR REPLACE FUNCTION public.search_providers_public');
    const searchEnd = migration.indexOf('CREATE OR REPLACE FUNCTION public.get_provider_booking_context_public');
    const searchBody = migration.slice(searchStart, searchEnd);
    expect(searchBody).not.toContain('AUTH_REQUIRED');
    expect(migration).toContain("v_provider_type = 'INSTRUCTOR'");
    expect(migration).toContain('p_instructor_id = v_user_id');
    expect(searchBody).not.toContain('driving_school_staff');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.search_providers_public');
    expect(migration).toContain('TO anon, authenticated');
  });

  it('uses same-identity professional notice and never creates cross-app navigation', () => {
    expect(studentCard).toContain('hasProfessionalProfile');
    expect(studentCard).toContain('Ativar perfil profissional');
    expect(studentCard).toContain('acesse o aplicativo MAZZI PRO');
    expect(studentCard).not.toContain('Migrar para MAZZI PRO');
    expect(studentCard).not.toMatch(/href\s*=|window\.open|location\.href|deep.?link|mazzi-pro-beta\.vercel\.app/i);
  });

  it('keeps the Student surface available for STUDENT plus INSTRUCTOR identities', () => {
    const studentCheck = studentRoot.indexOf("auth.user?.roles.includes('STUDENT')");
    const instructorCheck = studentRoot.indexOf("auth.user?.roles.includes('INSTRUCTOR')");
    expect(studentCheck).toBeGreaterThan(-1);
    expect(instructorCheck).toBeGreaterThan(studentCheck);
    expect(studentRoot.slice(studentCheck, instructorCheck)).toContain('<StudentApp />');
  });
});
