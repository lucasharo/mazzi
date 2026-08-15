-- ============================================================================
-- MAZZI PLATFORM — SPRINT 03: AUTH & RBAC SECURITY HARDENING MIGRATION
-- File: 20260814000003_auth_security_hardening.sql
-- ============================================================================

-- 1. SECURITY DEFINER HELPER FUNCTIONS (Zero Recursive RLS & Search Path Hardening)
-- All helper functions have fixed search_path = public, pg_temp and execute only boolean logic

-- Helper 1.1: Checks if current authenticated user has active status in public.users
CREATE OR REPLACE FUNCTION public.is_current_user_active()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND status = 'ACTIVE'
  );
$$;

-- Helper 1.2: Checks if current user is active member of a driving school without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.is_school_member(target_school_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.driving_school_staff
    WHERE school_id = target_school_id
      AND user_id = auth.uid()
      AND is_active = TRUE
  );
$$;

-- Helper 1.3: Checks if current user is active school administrator
CREATE OR REPLACE FUNCTION public.is_school_admin(target_school_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.driving_school_staff
    WHERE school_id = target_school_id
      AND user_id = auth.uid()
      AND role = 'SCHOOL_ADMIN'
      AND is_active = TRUE
  );
$$;

-- Helper 1.4: Checks if current user is platform administrator
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.users u ON u.id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'PLATFORM_ADMIN'
      AND u.status = 'ACTIVE'
  );
$$;

-- Revoke execute from public, grant to authenticated
REVOKE ALL ON FUNCTION public.is_current_user_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_active() TO authenticated;

REVOKE ALL ON FUNCTION public.is_school_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_school_member(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.is_school_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_school_admin(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- 2. DROP FLAWED / POTENTIALLY RECURSIVE POLICIES FROM PREVIOUS SPRINT
DROP POLICY IF EXISTS "School staff can view same school members" ON driving_school_staff;
DROP POLICY IF EXISTS "School admin can manage school staff" ON driving_school_staff;
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Students can read own bookings" ON bookings;
DROP POLICY IF EXISTS "Instructors can read assigned bookings" ON bookings;
DROP POLICY IF EXISTS "Providers can manage own offerings" ON service_offerings;
DROP POLICY IF EXISTS "Users can read own booking payments" ON payments;

-- 3. HARDENED ROW LEVEL SECURITY (RLS) POLICIES

-- 3.1 USERS TABLE
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT TO authenticated
  USING (
    (auth.uid() = id AND is_current_user_active())
    OR is_platform_admin()
  );

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id AND is_current_user_active())
  WITH CHECK (auth.uid() = id AND is_current_user_active());

-- 3.2 DRIVING_SCHOOL_STAFF TABLE (Protected with Non-Recursive Helper Functions)
CREATE POLICY "School staff and members can view their school team" ON driving_school_staff
  FOR SELECT TO authenticated
  USING (
    is_current_user_active() AND (
      is_school_member(school_id)
      OR user_id = auth.uid()
      OR is_platform_admin()
    )
  );

CREATE POLICY "School admin can manage school staff" ON driving_school_staff
  FOR ALL TO authenticated
  USING (
    is_current_user_active() AND (
      is_school_admin(school_id)
      OR is_platform_admin()
    )
  )
  WITH CHECK (
    is_current_user_active() AND (
      is_school_admin(school_id)
      OR is_platform_admin()
    )
  );

-- 3.3 USER_ROLES TABLE (Direct Mutation Blocked from Browser Client)
CREATE POLICY "Users can view own roles" ON user_roles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR is_platform_admin()
  );

-- Explicitly NO INSERT/UPDATE/DELETE policies for authenticated users on user_roles
-- (PostgreSQL default deny enforces that only service_role or database triggers can assign roles)

-- 3.4 ROLE_PERMISSIONS TABLE (Read-only catalog for clients)
CREATE POLICY "Authenticated users can read role permissions" ON role_permissions
  FOR SELECT TO authenticated
  USING (true);

-- Explicitly NO INSERT/UPDATE/DELETE policies for authenticated users on role_permissions

-- 3.5 USER_CUSTOM_PERMISSIONS TABLE (Protected against self-escalation)
CREATE POLICY "Users can view own custom permissions" ON user_custom_permissions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR is_platform_admin()
  );

-- Explicitly NO INSERT/UPDATE/DELETE policies for authenticated users on user_custom_permissions

-- 3.6 BOOKINGS TABLE (Blocked users denied; Student & Instructor access)
CREATE POLICY "Parties can read own bookings" ON bookings
  FOR SELECT TO authenticated
  USING (
    is_current_user_active() AND (
      student_id = auth.uid()
      OR instructor_id = auth.uid()
      OR is_platform_admin()
    )
  );

-- 3.7 SERVICE_OFFERINGS TABLE
CREATE POLICY "Anyone can view active service offerings" ON service_offerings
  FOR SELECT TO authenticated, anon
  USING (is_active = TRUE);

CREATE POLICY "Providers can manage own service offerings" ON service_offerings
  FOR ALL TO authenticated
  USING (
    is_current_user_active() AND (
      provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid())
      OR is_school_admin(provider_id)
      OR is_platform_admin()
    )
  )
  WITH CHECK (
    is_current_user_active() AND (
      provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid())
      OR is_school_admin(provider_id)
      OR is_platform_admin()
    )
  );

-- 3.8 PAYMENTS TABLE
CREATE POLICY "Parties can read own payments" ON payments
  FOR SELECT TO authenticated
  USING (
    is_current_user_active() AND (
      booking_id IN (
        SELECT id FROM bookings
        WHERE student_id = auth.uid() OR instructor_id = auth.uid()
      )
      OR is_platform_admin()
    )
  );

-- 4. SECURE TRIGGER FOR AUTOMATIC USER & DEFAULT ROLE PROVISIONING
-- When auth.users row is created, provision public.users and user_roles as STUDENT strictly.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 1. Create public.users record
  INSERT INTO public.users (
    id,
    email,
    name,
    phone,
    role,
    status
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Novo Usuário'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    'STUDENT', -- ALWAYS strictly STUDENT for public self-service signup
    'ACTIVE'
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2. Create user_roles record
  INSERT INTO public.user_roles (
    user_id,
    role
  ) VALUES (
    NEW.id,
    'STUDENT'
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger hook on auth.users (Executed server-side on identity creation)
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 5. PUBLIC PROVIDER PROFILE VIEW (Sanitized Data Boundary)
-- Strictly masks sensitive documents, CPF, bank details and compliance notes
CREATE OR REPLACE VIEW public.providers_public_view AS
SELECT
  p.id,
  p.user_id,
  p.type,
  p.trade_name AS provider_name,
  u.avatar_url,
  p.bio,
  p.rating_average,
  p.rating_count,
  p.neighborhood,
  p.city,
  p.state,
  p.status
FROM public.providers p
JOIN public.users u ON u.id = p.user_id
WHERE p.status = 'ACTIVE' AND u.status = 'ACTIVE';

-- Grant SELECT on public sanitized view
GRANT SELECT ON public.providers_public_view TO authenticated, anon;
