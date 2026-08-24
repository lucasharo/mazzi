import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260824202040_task_096a4m_student_to_pro_profile_migration.sql'), 'utf8');
const authService = readFileSync(resolve(process.cwd(), 'src/lib/auth-service.ts'), 'utf8');
const authContext = readFileSync(resolve(process.cwd(), 'src/components/auth/AuthContext.tsx'), 'utf8');
const studentCard = readFileSync(resolve(process.cwd(), 'src/apps/student/components/StudentProMigrationCard.tsx'), 'utf8');
const studentRoot = readFileSync(resolve(process.cwd(), 'src/entrypoints/student/StudentRoot.tsx'), 'utf8');

describe('TASK-096A4M — Student to MAZZI PRO migration contract', () => {
  it('defines authenticated, SECURITY DEFINER RPCs with a safe search path', () => {
    expect(migration).toContain('public.get_my_student_to_pro_migration_status()');
    expect(migration).toContain('public.migrate_my_student_profile_to_instructor()');
    expect(migration.match(/SECURITY DEFINER/g)?.length).toBeGreaterThanOrEqual(6);
    expect(migration.match(/SET search_path TO public, pg_temp/g)?.length).toBeGreaterThanOrEqual(6);
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.get_my_student_to_pro_migration_status() TO authenticated');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.migrate_my_student_profile_to_instructor() TO authenticated');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.get_my_student_to_pro_migration_status() FROM PUBLIC, anon');
  });

  it('returns the eligibility contract and fail-closed blockers', () => {
    for (const field of ['student_profile_active', 'instructor_role_active', 'provider_id', 'provider_status', 'can_migrate', 'blockers', 'active_booking_count']) {
      expect(migration).toContain(`'${field}'`);
    }
    for (const blocker of ['IDENTITY_INCOMPLETE', 'ROLE_CONFLICT', 'PENDING_STUDENT_PAYMENT', 'ACTIVE_STUDENT_BOOKING', 'STUDENT_DISPUTE_OPEN']) {
      expect(migration).toContain(blocker);
    }
    expect(migration).toContain("b.status::TEXT = 'PENDING_PAYMENT'");
    expect(migration).toContain("b.status::TEXT IN ('CONFIRMED', 'IN_PROGRESS', 'DISPUTED', 'PARTIALLY_REFUNDED')");
  });

  it('locks and revalidates before mutating the primary role, preserving history', () => {
    expect(migration).toContain("pg_advisory_xact_lock(hashtextextended('student-profile:' || p_user_id::TEXT, 0))");
    expect(migration).toContain('PERFORM public.lock_student_profile(v_uid);');
    expect(migration).toContain("UPDATE public.users SET role = 'INSTRUCTOR'");
    expect(migration).toContain("DELETE FROM public.user_roles WHERE user_id = v_uid AND role = 'STUDENT'");
    expect(migration).toContain('STUDENT_PROFILE_MIGRATED_TO_INSTRUCTOR');
    expect(migration).not.toContain('DELETE FROM public.bookings');
    expect(migration).toContain('PERFORM public.onboard_my_instructor();');
  });

  it('protects the quote, hold, check-in and student-owned payment/review paths', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.create_quote_from_offering');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.create_booking_hold');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.student_check_in_booking');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.guard_student_owned_mutation');
    expect(migration).toContain('trg_guard_student_payment_insert');
    expect(migration).toContain('trg_guard_student_review_insert');
    expect(migration).toContain('PERFORM public.assert_current_user_student();');
  });

  it('wires the two explicit Student choices and the post-migration screen', () => {
    expect(authService).toContain("supabase.rpc('get_my_student_to_pro_migration_status')");
    expect(authService).toContain("supabase.rpc('migrate_my_student_profile_to_instructor')");
    expect(authContext).toContain('getStudentToProMigrationStatus');
    expect(authContext).toContain('migrateStudentProfileToInstructor');
    expect(studentCard).toContain('Ativar perfil profissional');
    expect(studentCard).toContain('Migrar para MAZZI PRO');
    expect(studentCard).toContain('Confirmar migração');
    expect(studentRoot).toContain('Seu perfil de aluno está desativado.');
    expect(studentRoot).toContain('Use esta mesma conta no MAZZI PRO');
  });
});
