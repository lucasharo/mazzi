-- ============================================================================
-- MAZZI PLATFORM — FIX SELF-PROFILE SELECT/UPDATE RLS POLICY ON USERS TABLE
-- Sprint 17.1: Replace self-referential is_current_user_active() call on public.users
-- with direct column check (auth.uid() = id AND status = 'ACTIVE')
-- to allow INSERT ... RETURNING * without 42501 RLS failure on first student login.
-- ============================================================================

-- 1. Drop self-referential SELECT policy on users
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;

-- 2. Create non-recursive SELECT policy directly inspecting row's status
CREATE POLICY "Users can read own profile" ON public.users
  FOR SELECT TO authenticated
  USING (
    (auth.uid() = id AND status = 'ACTIVE')
    OR is_platform_admin()
  );

-- 3. Update the UPDATE policy on users to use direct row checks
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id AND status = 'ACTIVE')
  WITH CHECK (auth.uid() = id AND status = 'ACTIVE');
