-- MAZZI — Secure offering ownership by instructor context.
-- Forward-only: preserves runtime eligibility and existing offerings.

DROP POLICY IF EXISTS offerings_owner_insert ON public.service_offerings;
DROP POLICY IF EXISTS offerings_owner_update ON public.service_offerings;

CREATE POLICY offerings_owner_insert ON public.service_offerings
  FOR INSERT
  WITH CHECK (
    public.is_current_user_active()
    AND (
      service_offerings.provider_id IN (
        SELECT p.id FROM public.providers p WHERE p.user_id = auth.uid()
      )
      OR public.is_school_admin(service_offerings.provider_id)
      OR public.is_platform_admin()
    )
    AND service_offerings.vehicle_id IN (
      SELECT v.id
      FROM public.vehicles v
      WHERE v.provider_id = service_offerings.provider_id
        AND v.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1
      FROM public.providers p
      WHERE p.id = service_offerings.provider_id
        AND (
          (
            p.type = 'DRIVING_SCHOOL'::public.provider_type
            AND service_offerings.instructor_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.driving_school_staff dss
              WHERE dss.school_id = p.id
                AND dss.user_id = service_offerings.instructor_id
                AND dss.role = 'INSTRUCTOR'::public.user_role
                AND dss.membership_status = 'ACTIVE'::public.school_membership_status
                AND dss.is_active IS TRUE
            )
          )
          OR (
            p.type = 'INSTRUCTOR'::public.provider_type
            AND service_offerings.instructor_id = p.user_id
          )
        )
    )
  );

CREATE POLICY offerings_owner_update ON public.service_offerings
  FOR UPDATE
  USING (
    public.is_current_user_active()
    AND (
      service_offerings.provider_id IN (
        SELECT p.id FROM public.providers p WHERE p.user_id = auth.uid()
      )
      OR public.is_school_admin(service_offerings.provider_id)
      OR public.is_platform_admin()
    )
  )
  WITH CHECK (
    public.is_current_user_active()
    AND (
      service_offerings.provider_id IN (
        SELECT p.id FROM public.providers p WHERE p.user_id = auth.uid()
      )
      OR public.is_school_admin(service_offerings.provider_id)
      OR public.is_platform_admin()
    )
    AND service_offerings.vehicle_id IN (
      SELECT v.id
      FROM public.vehicles v
      WHERE v.provider_id = service_offerings.provider_id
        AND v.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1
      FROM public.providers p
      WHERE p.id = service_offerings.provider_id
        AND (
          (
            p.type = 'DRIVING_SCHOOL'::public.provider_type
            AND service_offerings.instructor_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.driving_school_staff dss
              WHERE dss.school_id = p.id
                AND dss.user_id = service_offerings.instructor_id
                AND dss.role = 'INSTRUCTOR'::public.user_role
                AND dss.membership_status = 'ACTIVE'::public.school_membership_status
                AND dss.is_active IS TRUE
            )
          )
          OR (
            p.type = 'INSTRUCTOR'::public.provider_type
            AND service_offerings.instructor_id = p.user_id
          )
        )
    )
  );

DROP INDEX IF EXISTS public.idx_uniq_active_offering;
CREATE UNIQUE INDEX idx_uniq_active_offering
  ON public.service_offerings (provider_id, instructor_id, vehicle_id, category, duration_minutes)
  WHERE status = 'ACTIVE' AND is_active IS TRUE;
