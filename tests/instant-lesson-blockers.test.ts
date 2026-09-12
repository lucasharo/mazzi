import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const aulaAgoraConsolidationMigration = readFileSync(
  'supabase/migrations/20260904222305_task_091_aula_agora_consolidation.sql',
  'utf8',
);
const canonicalAvailabilityMigration = readFileSync(
  'supabase/migrations/20260905232254_task_089_canonical_instructor_availability.sql',
  'utf8',
);

describe('TASK-089 Aula Agora — Verification of Blockers & Security Requirements', () => {
  describe('1. Multi-role Verification (Item 7)', () => {
    it('defines public.user_has_role to check both users table and user_roles table', () => {
      expect(aulaAgoraConsolidationMigration).toContain('CREATE OR REPLACE FUNCTION public.user_has_role(');
      expect(aulaAgoraConsolidationMigration).toContain('u.role = p_role');
      expect(aulaAgoraConsolidationMigration).toContain('SELECT 1 FROM public.user_roles ur');
      expect(aulaAgoraConsolidationMigration).toContain('ur.user_id = p_user_id AND ur.role = p_role');
    });

    it('applies public.user_has_role to all student-authenticated instant RPCs', () => {
      expect(aulaAgoraConsolidationMigration).toContain("public.user_has_role(v_uid, 'STUDENT'::public.user_role)");
      expect(aulaAgoraConsolidationMigration).not.toContain("u.role = 'STUDENT'");
    });

    it('restricts user_has_role function execution to authenticated users', () => {
      expect(aulaAgoraConsolidationMigration).toContain('REVOKE ALL ON FUNCTION public.user_has_role(UUID, public.user_role) FROM PUBLIC, anon');
      expect(aulaAgoraConsolidationMigration).toContain('GRANT EXECUTE ON FUNCTION public.user_has_role(UUID, public.user_role) TO authenticated');
    });
  });

  describe('2. GPS Location RBAC Isolation (Item 8)', () => {
    it('strictly enforces auth.uid() = p_instructor_id in upsert_my_instant_location', () => {
      expect(canonicalAvailabilityMigration).toContain('IF auth.uid() IS NULL OR auth.uid() <> p_instructor_id THEN');
      expect(canonicalAvailabilityMigration).toContain("RAISE EXCEPTION 'INSTANT_PROVIDER_ACCESS_DENIED'");
    });

    it('verifies canonical provider membership and active offering scope before saving location', () => {
      expect(canonicalAvailabilityMigration).toContain('CREATE OR REPLACE FUNCTION public.upsert_my_instant_location(');
      expect(canonicalAvailabilityMigration).toContain('public.instant_is_provider_member(p_provider_id, auth.uid())');
      expect(canonicalAvailabilityMigration).toContain('public.service_offerings o');
      expect(canonicalAvailabilityMigration).toContain("o.source = 'AULA_AGORA'");
      expect(canonicalAvailabilityMigration).toContain("o.status = 'ACTIVE'");
      expect(canonicalAvailabilityMigration).toContain("RAISE EXCEPTION 'INSTANT_INSTRUCTOR_SCOPE_DENIED'");
    });
  });

  describe('3. Deduplication of Providers & Waves (Item 9)', () => {
    it('uses COUNT(DISTINCT instructor_id) for eligible_provider_count in price selector', () => {
      expect(aulaAgoraConsolidationMigration).toContain('COUNT(DISTINCT e.instructor_id)');
      expect(aulaAgoraConsolidationMigration).toContain('COUNT(DISTINCT instructor_id)');
    });

    it('deduplicates wave candidates by instructor before applying wave limit', () => {
      expect(aulaAgoraConsolidationMigration).toContain('DISTINCT ON (o.instructor_id)');
      expect(aulaAgoraConsolidationMigration).toContain('LIMIT v_wave');
    });
  });

  describe('4. Fail Closed Next Booking Schedule Window (Item 4 & 5)', () => {
    it('uses exact operational geodetic distance from student meeting point to next booking location', () => {
      expect(aulaAgoraConsolidationMigration).toContain("b.meeting_point->>'latitude'");
      expect(aulaAgoraConsolidationMigration).toContain("b.meeting_point->>'longitude'");
      expect(aulaAgoraConsolidationMigration).toContain('np.location');
      expect(aulaAgoraConsolidationMigration).toContain('eta_next');
    });

    it('FAILS CLOSED when an upcoming booking exists without usable location coordinates', () => {
      expect(aulaAgoraConsolidationMigration).toContain('b.next_location IS NOT NULL');
      expect(aulaAgoraConsolidationMigration).toContain('IF n.next_location IS NULL THEN CONTINUE; END IF;');
    });

    it('includes safety margin of 15 minutes in total window check', () => {
      expect(aulaAgoraConsolidationMigration).toContain('b.eta_minutes+b.duration_minutes+b.eta_next+15');
      expect(aulaAgoraConsolidationMigration).toContain('c.eta+c.duration_minutes+eta_next+15');
    });
  });
});
