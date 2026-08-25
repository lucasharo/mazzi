import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260824230000_task_096a4m_r_student_to_pro_profile_migration.sql'), 'utf8');
const canonicalQuote = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260823050139_task_081_correct_marketplace_fee_split.sql'), 'utf8');
const canonicalHold = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260824021413_task_092_atomic_schedule_mutations.sql'), 'utf8');
const canonicalCheckIn = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260823220956_require_both_checkins_and_extend_checkin_window.sql'), 'utf8');
const canonicalPayments = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260818000045_fix_failed_retry_idempotency.sql'), 'utf8');
const canonicalReviews = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260815000013_chat_reviews_notifications.sql'), 'utf8');
const authService = readFileSync(resolve(process.cwd(), 'src/lib/auth-service.ts'), 'utf8');
const authContext = readFileSync(resolve(process.cwd(), 'src/components/auth/AuthContext.tsx'), 'utf8');
const studentCard = readFileSync(resolve(process.cwd(), 'src/apps/student/components/StudentProMigrationCard.tsx'), 'utf8');
const studentRoot = readFileSync(resolve(process.cwd(), 'src/entrypoints/student/StudentRoot.tsx'), 'utf8');

const legacyMigrationPath = resolve(process.cwd(), 'supabase/migrations/20260824202040_task_096a4m_student_to_pro_profile_migration.sql');
const finalMigrationPath = resolve(process.cwd(), 'supabase/migrations/20260824230000_task_096a4m_r_student_to_pro_profile_migration.sql');

describe('TASK-096A4M — Student to MAZZI PRO migration contract', () => {
  it('uses the final migration version without retaining the pre-LIVE-ledger filename', () => {
    expect(existsSync(finalMigrationPath)).toBe(true);
    expect(existsSync(legacyMigrationPath)).toBe(false);
  });

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

  it('preserves the critical pre-A4M contracts while adding the shared lock', () => {
    expect(migration).toContain("IF v_offering.category::TEXT <> 'B' THEN");
    expect(migration).toContain("'instructorName'");
    expect(migration).toContain("'Check-in do aluno já realizado anteriormente.'");
    expect(migration).toContain("'Check-in do aluno realizado com sucesso.'");
    expect(migration).toContain("INTERVAL '30 minutes'");
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.create_booking_payment');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.confirm_booking_payment');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.mark_booking_payment_failed');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.create_review_for_booking');

    for (const contract of [
      "'BOOKING_HOLD_EXPIRED'",
      "'REAL_PAYMENT_GATEWAY_NOT_ENABLED'",
      "'PAYMENT_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BOOKING'",
      "'PAYMENT_NOT_IN_FAILURABLE_STATE'",
    ]) expect(migration).toContain(contract);

    expect(canonicalQuote).toContain("v_offering.category::TEXT <> 'B'");
    expect(canonicalHold).toContain("'instructorName'");
    expect(canonicalCheckIn).toContain("'Check-in do aluno já realizado anteriormente.'");
    expect(canonicalPayments).toContain('CREATE OR REPLACE FUNCTION public.create_booking_payment');
    expect(canonicalReviews).toContain('CREATE OR REPLACE FUNCTION public.create_review_for_booking');
  });

  it('proves lock -> assert -> operational decision order for payment and review races', () => {
    for (const functionName of ['create_booking_payment', 'confirm_booking_payment', 'mark_booking_payment_failed', 'create_review_for_booking']) {
      const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${functionName}`);
      expect(start).toBeGreaterThan(-1);
      const body = migration.slice(start, migration.indexOf('$$;', start) + 3);
      expect(body.indexOf('PERFORM public.lock_student_profile')).toBeGreaterThan(-1);
      expect(body.indexOf('PERFORM public.assert_current_user_student')).toBeGreaterThan(body.indexOf('PERFORM public.lock_student_profile'));
      const firstOperationalDecision = Math.min(...['SELECT * INTO', 'IF v_payment', 'IF v_booking', 'UPDATE public'].map((token) => {
        const position = body.indexOf(token);
        return position === -1 ? Number.MAX_SAFE_INTEGER : position;
      }));
      expect(body.indexOf('PERFORM public.assert_current_user_student')).toBeLessThan(firstOperationalDecision);
    }
    expect(migration).toContain("'student-profile:' || p_user_id::TEXT");
    expect(migration).toContain('PERFORM public.lock_student_profile(v_student_id);');
    expect(migration).toContain('PERFORM public.lock_student_profile(v_uid);');
  });

  it('closes the SECURITY DEFINER trigger ACL and keeps cancel booking out of scope', () => {
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.guard_student_owned_mutation() FROM PUBLIC, anon, authenticated;');
    expect(migration).not.toContain('CREATE OR REPLACE FUNCTION public.cancel_booking_v2');
    expect(migration).not.toContain('DROP FROM public.bookings');
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
