-- Keep service-offering writes scoped to an authenticated provider owner/admin and
-- to a valid, active instructor/vehicle context. The SECURITY DEFINER wrapper
-- avoids policy subqueries being filtered by the target tables' RLS policies.
CREATE OR REPLACE FUNCTION public.can_manage_service_offering(
  p_provider_id uuid,
  p_instructor_id uuid,
  p_vehicle_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT
    public.is_current_user_active()
    AND EXISTS (
      SELECT 1
      FROM public.providers p
      WHERE p.id = p_provider_id
        AND (
          p.user_id = auth.uid()
          OR public.is_school_admin(p.id)
          OR public.is_platform_admin()
        )
        AND EXISTS (
          SELECT 1
          FROM public.vehicles v
          WHERE v.id = p_vehicle_id
            AND v.provider_id = p.id
            AND v.deleted_at IS NULL
        )
        AND (
          (
            p.type = 'DRIVING_SCHOOL'::public.provider_type
            AND p_instructor_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.driving_school_staff dss
              WHERE dss.school_id = p.id
                AND dss.user_id = p_instructor_id
                AND dss.role = 'INSTRUCTOR'::public.user_role
                AND dss.membership_status = 'ACTIVE'::public.school_membership_status
                AND dss.is_active IS TRUE
            )
          )
          OR (
            p.type = 'INSTRUCTOR'::public.provider_type
            AND p_instructor_id = p.user_id
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_service_offering(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_service_offering(uuid, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.can_manage_service_offering(uuid, uuid, uuid) FROM authenticated;

DROP POLICY IF EXISTS offerings_owner_insert ON public.service_offerings;
CREATE POLICY offerings_owner_insert
  ON public.service_offerings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_manage_service_offering(provider_id, instructor_id, vehicle_id)
  );

DROP POLICY IF EXISTS offerings_owner_update ON public.service_offerings;
CREATE POLICY offerings_owner_update
  ON public.service_offerings
  FOR UPDATE
  TO authenticated
  USING (
    public.is_current_user_active()
    AND (
      provider_id IN (
        SELECT p.id
        FROM public.providers p
        WHERE p.user_id = auth.uid()
      )
      OR public.is_school_admin(provider_id)
      OR public.is_platform_admin()
    )
  )
  WITH CHECK (
    public.can_manage_service_offering(provider_id, instructor_id, vehicle_id)
  );
