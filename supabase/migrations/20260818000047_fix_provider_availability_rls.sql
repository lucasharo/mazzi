-- ============================================================================
-- MAZZI PLATFORM — SPRINT 18: FIX PROVIDER AVAILABILITY RLS POLICIES
-- Migration: 20260818000047_fix_provider_availability_rls.sql
-- ============================================================================

-- 1. Availabilities (Recurring Rules) RLS Policies
DROP POLICY IF EXISTS "availabilities_owner_insert" ON public.availabilities;
DROP POLICY IF EXISTS "availabilities_owner_update" ON public.availabilities;
DROP POLICY IF EXISTS "availabilities_owner_delete" ON public.availabilities;
DROP POLICY IF EXISTS "availabilities_public_select" ON public.availabilities;

CREATE POLICY "availabilities_owner_insert" ON public.availabilities
  FOR INSERT WITH CHECK (
    public.is_provider_owner(provider_id)
    OR public.is_school_admin(provider_id)
    OR public.is_platform_admin()
  );

CREATE POLICY "availabilities_owner_update" ON public.availabilities
  FOR UPDATE USING (
    public.is_provider_owner(provider_id)
    OR public.is_school_admin(provider_id)
    OR public.is_platform_admin()
  );

CREATE POLICY "availabilities_owner_delete" ON public.availabilities
  FOR DELETE USING (
    public.is_provider_owner(provider_id)
    OR public.is_school_admin(provider_id)
    OR public.is_platform_admin()
  );

CREATE POLICY "availabilities_public_select" ON public.availabilities
  FOR SELECT USING (
    is_active = true
    OR public.is_provider_owner(provider_id)
    OR public.is_school_admin(provider_id)
    OR public.is_platform_admin()
  );

-- 2. Availability Exceptions (Blocks) RLS Policies
DROP POLICY IF EXISTS "exceptions_owner_insert" ON public.availability_exceptions;
DROP POLICY IF EXISTS "exceptions_owner_update" ON public.availability_exceptions;
DROP POLICY IF EXISTS "exceptions_owner_delete" ON public.availability_exceptions;
DROP POLICY IF EXISTS "exceptions_owner_select" ON public.availability_exceptions;

CREATE POLICY "exceptions_owner_insert" ON public.availability_exceptions
  FOR INSERT WITH CHECK (
    public.is_provider_owner(provider_id)
    OR public.is_school_admin(provider_id)
    OR public.is_platform_admin()
  );

CREATE POLICY "exceptions_owner_update" ON public.availability_exceptions
  FOR UPDATE USING (
    public.is_provider_owner(provider_id)
    OR public.is_school_admin(provider_id)
    OR public.is_platform_admin()
  );

CREATE POLICY "exceptions_owner_delete" ON public.availability_exceptions
  FOR DELETE USING (
    public.is_provider_owner(provider_id)
    OR public.is_school_admin(provider_id)
    OR public.is_platform_admin()
  );

CREATE POLICY "exceptions_owner_select" ON public.availability_exceptions
  FOR SELECT USING (
    public.is_provider_owner(provider_id)
    OR public.is_school_admin(provider_id)
    OR public.is_platform_admin()
  );
