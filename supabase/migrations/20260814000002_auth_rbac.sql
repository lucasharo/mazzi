-- ============================================================================
-- MAZZI PLATFORM — SPRINT 03 MIGRATION: AUTH & RBAC EXTENSIONS
-- File: 20260814000002_auth_rbac.sql
-- ============================================================================

-- 1. USER PERMISSIONS ENUM & STRUCTURE
-- Fine-grained permissions catalog for backend authorization
CREATE TYPE app_permission AS ENUM (
  -- Student domain
  'student.profile.read',
  'student.profile.update',
  'student.booking.create',
  'student.booking.read_own',
  'student.booking.cancel_own',
  'student.review.create',

  -- Provider / Instructor domain
  'provider.profile.read_own',
  'provider.profile.update_own',
  'provider.schedule.manage_own',
  'provider.vehicle.manage_own',
  'provider.lesson.start_finish',
  'provider.finance.read_own',
  'provider.payout.request',

  -- Driving School domain (Multi-tenant)
  'school.profile.read',
  'school.profile.update',
  'school.member.read',
  'school.member.manage',
  'school.vehicle.manage',
  'school.schedule.manage',
  'school.finance.read',
  'school.payout.request',

  -- Platform Admin domain
  'admin.provider.review',
  'admin.provider.suspend',
  'admin.compliance.review',
  'admin.platform.manage_settings',
  'admin.audit.read',
  'admin.finance.read_all',
  'admin.user.manage',

  -- Support domain
  'support.user.read_limited',
  'support.booking.read_limited',
  'support.ticket.manage'
);

-- 2. USER MULTI-ROLE SUPPORT TABLE (Table 22: user_roles)
-- Allows a user to hold multiple roles (e.g., INSTRUCTOR + STUDENT) while maintaining default role
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(user_id, role)
);

-- 3. ROLE DEFAULT PERMISSIONS MAPPING (Table 23: role_permissions)
CREATE TABLE IF NOT EXISTS role_permissions (
  role user_role NOT NULL,
  permission app_permission NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role, permission)
);

-- 4. USER SPECIFIC CUSTOM OVERRIDE PERMISSIONS (Table 24: user_custom_permissions)
CREATE TABLE IF NOT EXISTS user_custom_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission app_permission NOT NULL,
  is_granted BOOLEAN NOT NULL DEFAULT TRUE, -- TRUE = Grant override, FALSE = Revoke override
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(user_id, permission)
);

-- 5. AUDIT LOG SECURITY EVENT ENUM & EXTENSION
-- Enhanced tracking for security audits: LOGIN_SUCCESS, LOGIN_FAILURE, etc.
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'INFO';

-- 6. POPULATE DEFAULT ROLE PERMISSIONS
INSERT INTO role_permissions (role, permission) VALUES
  -- STUDENT
  ('STUDENT', 'student.profile.read'),
  ('STUDENT', 'student.profile.update'),
  ('STUDENT', 'student.booking.create'),
  ('STUDENT', 'student.booking.read_own'),
  ('STUDENT', 'student.booking.cancel_own'),
  ('STUDENT', 'student.review.create'),

  -- INSTRUCTOR
  ('INSTRUCTOR', 'student.profile.read'), -- Can also act/view as student
  ('INSTRUCTOR', 'provider.profile.read_own'),
  ('INSTRUCTOR', 'provider.profile.update_own'),
  ('INSTRUCTOR', 'provider.schedule.manage_own'),
  ('INSTRUCTOR', 'provider.vehicle.manage_own'),
  ('INSTRUCTOR', 'provider.lesson.start_finish'),
  ('INSTRUCTOR', 'provider.finance.read_own'),
  ('INSTRUCTOR', 'provider.payout.request'),

  -- SCHOOL_ADMIN
  ('SCHOOL_ADMIN', 'school.profile.read'),
  ('SCHOOL_ADMIN', 'school.profile.update'),
  ('SCHOOL_ADMIN', 'school.member.read'),
  ('SCHOOL_ADMIN', 'school.member.manage'),
  ('SCHOOL_ADMIN', 'school.vehicle.manage'),
  ('SCHOOL_ADMIN', 'school.schedule.manage'),
  ('SCHOOL_ADMIN', 'school.finance.read'),
  ('SCHOOL_ADMIN', 'school.payout.request'),
  ('SCHOOL_ADMIN', 'provider.lesson.start_finish'),

  -- SCHOOL_STAFF
  ('SCHOOL_STAFF', 'school.profile.read'),
  ('SCHOOL_STAFF', 'school.member.read'),
  ('SCHOOL_STAFF', 'school.vehicle.manage'),
  ('SCHOOL_STAFF', 'school.schedule.manage'),

  -- PLATFORM_ADMIN
  ('PLATFORM_ADMIN', 'admin.provider.review'),
  ('PLATFORM_ADMIN', 'admin.provider.suspend'),
  ('PLATFORM_ADMIN', 'admin.compliance.review'),
  ('PLATFORM_ADMIN', 'admin.platform.manage_settings'),
  ('PLATFORM_ADMIN', 'admin.audit.read'),
  ('PLATFORM_ADMIN', 'admin.finance.read_all'),
  ('PLATFORM_ADMIN', 'admin.user.manage'),
  ('PLATFORM_ADMIN', 'support.user.read_limited'),
  ('PLATFORM_ADMIN', 'support.booking.read_limited'),

  -- SUPPORT
  ('SUPPORT', 'support.user.read_limited'),
  ('SUPPORT', 'support.booking.read_limited'),
  ('SUPPORT', 'support.ticket.manage'),
  ('SUPPORT', 'admin.audit.read')
ON CONFLICT DO NOTHING;

-- 7. ENABLE RLS ON NEW RBAC TABLES
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_custom_permissions ENABLE ROW LEVEL SECURITY;

-- 8. REFINED ROW LEVEL SECURITY (RLS) POLICIES FOR AUTHENTICATED ACCESS
-- Users can only read their own user record
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Students can read only their own bookings
CREATE POLICY "Students can read own bookings" ON bookings
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

-- Instructors can read bookings assigned to them
CREATE POLICY "Instructors can read assigned bookings" ON bookings
  FOR SELECT TO authenticated
  USING (instructor_id = auth.uid());

-- Providers can read and manage their own offerings
CREATE POLICY "Providers can manage own offerings" ON service_offerings
  FOR ALL TO authenticated
  USING (
    provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid())
    OR provider_id IN (SELECT school_id FROM driving_school_staff WHERE user_id = auth.uid() AND is_active = TRUE)
  );

-- School Staff and Admin multi-tenant isolation on staff table
CREATE POLICY "School staff can view same school members" ON driving_school_staff
  FOR SELECT TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM driving_school_staff WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

-- School Admin can manage school staff
CREATE POLICY "School admin can manage school staff" ON driving_school_staff
  FOR ALL TO authenticated
  USING (
    school_id IN (
      SELECT id FROM providers WHERE user_id = auth.uid()
    )
    OR school_id IN (
      SELECT school_id FROM driving_school_staff WHERE user_id = auth.uid() AND role = 'SCHOOL_ADMIN' AND is_active = TRUE
    )
  );

-- Payments read strictly for involved student or provider
CREATE POLICY "Users can read own booking payments" ON payments
  FOR SELECT TO authenticated
  USING (
    booking_id IN (
      SELECT id FROM bookings WHERE student_id = auth.uid() OR instructor_id = auth.uid()
    )
  );
