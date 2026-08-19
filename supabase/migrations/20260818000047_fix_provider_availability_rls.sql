-- ============================================================================
-- MAZZI PLATFORM — SPRINT 18: FIX PROVIDER AVAILABILITY RLS POLICIES & RBAC
-- Migration: 20260818000047_fix_provider_availability_rls.sql
-- ============================================================================

-- 1. Table-Level Privileges for driving_school_staff (Row-Level Security enforces multi-tenant isolation)
REVOKE ALL ON TABLE public.driving_school_staff FROM PUBLIC;
REVOKE ALL ON TABLE public.driving_school_staff FROM anon;
GRANT SELECT ON TABLE public.driving_school_staff TO authenticated, service_role;

-- 2. Helper: Checks if the current authenticated user has an effective permission
-- Resolves: User Status (is_current_user_active), Base Roles (users.role & user_roles), and Custom Overrides (user_custom_permissions)
-- Note: Permission resolution is strict and does NOT implicitly grant all permissions to PLATFORM_ADMIN.
CREATE OR REPLACE FUNCTION public.current_user_has_permission(p_permission public.app_permission)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID;
  v_custom_granted BOOLEAN;
  v_base_has_permission BOOLEAN;
BEGIN
  -- 2.1 Must be authenticated and active
  v_uid := auth.uid();
  IF v_uid IS NULL OR NOT public.is_current_user_active() THEN
    RETURN FALSE;
  END IF;

  -- 2.2 Check custom permission override in user_custom_permissions
  SELECT is_granted INTO v_custom_granted
  FROM public.user_custom_permissions
  WHERE user_id = v_uid AND permission = p_permission;

  IF v_custom_granted IS NOT NULL THEN
    RETURN v_custom_granted;
  END IF;

  -- 2.3 Check base permissions across primary role (users.role) and additional roles (user_roles)
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    WHERE rp.permission = p_permission
      AND rp.role IN (
        SELECT u.role FROM public.users u WHERE u.id = v_uid
        UNION
        SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = v_uid
      )
  ) INTO v_base_has_permission;

  RETURN COALESCE(v_base_has_permission, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_has_permission(public.app_permission) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_has_permission(public.app_permission) FROM anon;
GRANT EXECUTE ON FUNCTION public.current_user_has_permission(public.app_permission) TO authenticated, service_role;

-- 3. Helper: Determines if current authenticated user can manage schedule for target provider
-- Least-Privilege & Direct Owner Rules:
-- 3.1 Current user MUST be active (public.is_current_user_active())
-- 3.2 AND one of:
--     a) Platform Admin (public.is_platform_admin())
--     b) Direct Provider Owner (providers.user_id = auth.uid()) AND has 'provider.schedule.manage_own' permission
--     c) Active driving school staff member AND provider type is DRIVING_SCHOOL AND has 'school.schedule.manage' permission
CREATE OR REPLACE FUNCTION public.can_manage_provider_schedule(target_provider_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    public.is_current_user_active()
    AND (
      public.is_platform_admin()
      OR (
        EXISTS (
          SELECT 1
          FROM public.providers p
          WHERE p.id = target_provider_id
            AND p.user_id = auth.uid()
        )
        AND public.current_user_has_permission('provider.schedule.manage_own'::public.app_permission)
      )
      OR (
        EXISTS (
          SELECT 1
          FROM public.driving_school_staff dss
          JOIN public.providers p ON p.id = dss.school_id
          WHERE dss.school_id = target_provider_id
            AND dss.user_id = auth.uid()
            AND dss.is_active = TRUE
            AND p.type = 'DRIVING_SCHOOL'
        )
        AND public.current_user_has_permission('school.schedule.manage'::public.app_permission)
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_provider_schedule(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_provider_schedule(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_manage_provider_schedule(UUID) TO authenticated, service_role;

-- 4. Availabilities (Recurring Rules) RLS Policies
DROP POLICY IF EXISTS "availabilities_owner_insert" ON public.availabilities;
DROP POLICY IF EXISTS "availabilities_owner_update" ON public.availabilities;
DROP POLICY IF EXISTS "availabilities_owner_delete" ON public.availabilities;
DROP POLICY IF EXISTS "availabilities_public_select" ON public.availabilities;

CREATE POLICY "availabilities_owner_insert" ON public.availabilities
  FOR INSERT WITH CHECK (
    public.can_manage_provider_schedule(provider_id)
  );

CREATE POLICY "availabilities_owner_update" ON public.availabilities
  FOR UPDATE
  USING (public.can_manage_provider_schedule(provider_id))
  WITH CHECK (public.can_manage_provider_schedule(provider_id));

CREATE POLICY "availabilities_owner_delete" ON public.availabilities
  FOR DELETE
  USING (public.can_manage_provider_schedule(provider_id));

CREATE POLICY "availabilities_public_select" ON public.availabilities
  FOR SELECT
  USING (
    is_active = true
    OR public.can_manage_provider_schedule(provider_id)
  );

-- 5. Availability Exceptions (Blocks) RLS Policies
DROP POLICY IF EXISTS "exceptions_owner_insert" ON public.availability_exceptions;
DROP POLICY IF EXISTS "exceptions_owner_update" ON public.availability_exceptions;
DROP POLICY IF EXISTS "exceptions_owner_delete" ON public.availability_exceptions;
DROP POLICY IF EXISTS "exceptions_owner_select" ON public.availability_exceptions;

CREATE POLICY "exceptions_owner_insert" ON public.availability_exceptions
  FOR INSERT WITH CHECK (
    public.can_manage_provider_schedule(provider_id)
  );

CREATE POLICY "exceptions_owner_update" ON public.availability_exceptions
  FOR UPDATE
  USING (public.can_manage_provider_schedule(provider_id))
  WITH CHECK (public.can_manage_provider_schedule(provider_id));

CREATE POLICY "exceptions_owner_delete" ON public.availability_exceptions
  FOR DELETE
  USING (public.can_manage_provider_schedule(provider_id));

CREATE POLICY "exceptions_owner_select" ON public.availability_exceptions
  FOR SELECT
  USING (
    public.can_manage_provider_schedule(provider_id)
  );
