import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const blockersFixMigration = readFileSync(
  'supabase/migrations/20260904160000_task_089_instant_lesson_blockers_and_rbac_fix.sql',
  'utf8'
);

describe('TASK-089 Aula Agora — Verification of Blockers & Security Requirements', () => {
  describe('1. Multi-role Verification (Item 7)', () => {
    it('defines public.user_has_role to check both users table and user_roles table', () => {
      expect(blockersFixMigration).toContain('CREATE OR REPLACE FUNCTION public.user_has_role(');
      expect(blockersFixMigration).toContain('u.role = p_role');
      expect(blockersFixMigration).toContain('SELECT 1 FROM public.user_roles ur');
      expect(blockersFixMigration).toContain('ur.user_id = p_user_id AND ur.role = p_role');
    });

    it('applies public.user_has_role to all student-authenticated instant RPCs', () => {
      expect(blockersFixMigration).toContain("public.user_has_role(v_uid, 'STUDENT'::public.user_role)");
      expect(blockersFixMigration).not.toContain("u.role = 'STUDENT'");
    });

    it('restricts user_has_role function execution to authenticated users', () => {
      expect(blockersFixMigration).toContain('REVOKE ALL ON FUNCTION public.user_has_role(UUID, public.user_role) FROM PUBLIC, anon');
      expect(blockersFixMigration).toContain('GRANT EXECUTE ON FUNCTION public.user_has_role(UUID, public.user_role) TO authenticated');
    });
  });

  describe('2. GPS Location RBAC Isolation (Item 8)', () => {
    it('strictly enforces auth.uid() = p_instructor_id in upsert_my_instant_location', () => {
      expect(blockersFixMigration).toContain('IF auth.uid() IS NULL OR auth.uid() <> p_instructor_id THEN');
      expect(blockersFixMigration).toContain("RAISE EXCEPTION 'INSTANT_PROVIDER_ACCESS_DENIED'");
    });

    it('verifies instructor membership scope before saving location', () => {
      expect(blockersFixMigration).toContain('public.service_offerings o');
      expect(blockersFixMigration).toContain('public.providers p');
      expect(blockersFixMigration).toContain('public.driving_school_staff s');
      expect(blockersFixMigration).toContain("RAISE EXCEPTION 'INSTANT_INSTRUCTOR_SCOPE_DENIED'");
    });
  });

  describe('3. Deduplication of Providers & Waves (Item 9)', () => {
    it('uses COUNT(DISTINCT instructor_id) for eligible_provider_count in price selector', () => {
      expect(blockersFixMigration).toContain('COUNT(DISTINCT c.instructor_id)');
      expect(blockersFixMigration).toContain('COUNT(DISTINCT instructor_id)');
    });

    it('deduplicates wave candidates by instructor before applying wave limit', () => {
      expect(blockersFixMigration).toContain('DISTINCT ON (o.instructor_id)');
      expect(blockersFixMigration).toContain('LIMIT v_wave');
    });
  });

  describe('4. Fail Closed Next Booking Schedule Window (Item 4 & 5)', () => {
    it('uses exact operational geodetic distance from student meeting point to next booking location', () => {
      expect(blockersFixMigration).toContain('nb.meeting_point->>\'latitude\'');
      expect(blockersFixMigration).toContain('nb.meeting_point->>\'longitude\'');
      expect(blockersFixMigration).toContain('np.location');
      expect(blockersFixMigration).toContain('eta_to_next_minutes');
    });

    it('FAILS CLOSED when an upcoming booking exists without usable location coordinates', () => {
      expect(blockersFixMigration).toContain('-- FAIL CLOSED RULE:');
      expect(blockersFixMigration).toContain('ec.next_location IS NOT NULL');
      expect(blockersFixMigration).toContain('IF v_next.next_location IS NULL THEN');
      expect(blockersFixMigration).toContain('CONTINUE;');
    });

    it('includes safety margin of 15 minutes in total window check', () => {
      expect(blockersFixMigration).toContain('ec.eta_minutes + ec.duration_minutes + ec.eta_to_next_minutes + 15');
      expect(blockersFixMigration).toContain('v_end + MAKE_INTERVAL(mins => v_eta_next + 15) > v_next.scheduled_start_at');
    });
  });
});
