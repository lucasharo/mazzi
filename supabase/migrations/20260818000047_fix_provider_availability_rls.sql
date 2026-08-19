-- ============================================================================
-- MAZZI PLATFORM — SPRINT 18: FIX PROVIDER AVAILABILITY RLS POLICIES & RBAC
-- Migration: 20260818000047_fix_provider_availability_rls.sql
-- ============================================================================

-- Helper: Determines if current authenticated user can manage schedule for target provider
-- Least-Privilege Rules:
-- 1. Current user MUST be active (public.is_current_user_active())
-- 2. AND one of:
--    a) Provider Owner (independent instructor or driving school owner)
--    b) Active driving school staff member whose role holds 'school.schedule.manage' in role_permissions
--    c) Platform Admin
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
      public.is_provider_owner(target_provider_id)
      OR EXISTS (
        SELECT 1
        FROM public.driving_school_staff dss
        JOIN public.role_permissions rp
          ON rp.role = dss.role
         AND rp.permission = 'school.schedule.manage'
        JOIN public.providers p
          ON p.id = dss.school_id
        WHERE dss.school_id = target_provider_id
          AND dss.user_id = auth.uid()
          AND dss.is_active = TRUE
          AND p.type = 'DRIVING_SCHOOL'
      )
      OR public.is_platform_admin()
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_provider_schedule(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_provider_schedule(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_manage_provider_schedule(UUID) TO authenticated, service_role;

-- 1. Availabilities (Recurring Rules) RLS Policies
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

-- 2. Availability Exceptions (Blocks) RLS Policies
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
