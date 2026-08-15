-- ============================================================================
-- MAZZI PLATFORM — SPRINT 06 MIGRATION: AVAILABILITY & SCHEDULING ENGINE
-- File: supabase/migrations/20260814000007_availability_scheduling.sql
-- Incremental schema evolution for weekly recurring rules, timezone,
-- exception types, and RLS multi-tenant security policies.
-- ============================================================================

-- 1. INCREMENTAL COLUMNS FOR AVAILABILITIES TABLE
ALTER TABLE availabilities
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS effective_from DATE,
  ADD COLUMN IF NOT EXISTS effective_to DATE;

-- 2. INCREMENTAL COLUMNS FOR AVAILABILITY_EXCEPTIONS TABLE
ALTER TABLE availability_exceptions
  ADD COLUMN IF NOT EXISTS type VARCHAR(30) NOT NULL DEFAULT 'BLOCK' CHECK (type IN ('BLOCK', 'AVAILABLE_OVERRIDE')),
  ADD COLUMN IF NOT EXISTS reason_category VARCHAR(50) NOT NULL DEFAULT 'OTHER';

-- 3. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_availabilities_provider_dow ON availabilities(provider_id, day_of_week, is_active);
CREATE INDEX IF NOT EXISTS idx_availabilities_instructor ON availabilities(instructor_id);
CREATE INDEX IF NOT EXISTS idx_availabilities_vehicle ON availabilities(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_exceptions_provider_dates ON availability_exceptions(provider_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_exceptions_instructor_dates ON availability_exceptions(instructor_id);
CREATE INDEX IF NOT EXISTS idx_exceptions_vehicle_dates ON availability_exceptions(vehicle_id);

-- 4. ROW LEVEL SECURITY (RLS) POLICIES FOR AVAILABILITIES & EXCEPTIONS
-- SUPPORT and STUDENT roles are strictly denied write access.
ALTER TABLE availabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_exceptions ENABLE ROW LEVEL SECURITY;

-- Availabilities Policies
DROP POLICY IF EXISTS availabilities_public_select ON availabilities;
DROP POLICY IF EXISTS availabilities_owner_insert ON availabilities;
DROP POLICY IF EXISTS availabilities_owner_update ON availabilities;
DROP POLICY IF EXISTS availabilities_owner_delete ON availabilities;

CREATE POLICY availabilities_public_select ON availabilities
  FOR SELECT
  USING (
    is_active = true
    OR provider_id IN (SELECT p.id FROM providers p WHERE p.user_id = auth.uid())
    OR (auth.jwt() ->> 'role') = 'PLATFORM_ADMIN'
  );

CREATE POLICY availabilities_owner_insert ON availabilities
  FOR INSERT
  WITH CHECK (
    provider_id IN (SELECT p.id FROM providers p WHERE p.user_id = auth.uid())
    AND (auth.jwt() ->> 'role') IN ('INSTRUCTOR', 'SCHOOL_ADMIN', 'SCHOOL_STAFF', 'PLATFORM_ADMIN')
  );

CREATE POLICY availabilities_owner_update ON availabilities
  FOR UPDATE
  USING (
    provider_id IN (SELECT p.id FROM providers p WHERE p.user_id = auth.uid())
    OR (auth.jwt() ->> 'role') = 'PLATFORM_ADMIN'
  );

CREATE POLICY availabilities_owner_delete ON availabilities
  FOR DELETE
  USING (
    provider_id IN (SELECT p.id FROM providers p WHERE p.user_id = auth.uid())
    OR (auth.jwt() ->> 'role') = 'PLATFORM_ADMIN'
  );

-- Availability Exceptions Policies
-- Exception private notes/reasons are strictly protected from public access.
DROP POLICY IF EXISTS exceptions_owner_select ON availability_exceptions;
DROP POLICY IF EXISTS exceptions_owner_insert ON availability_exceptions;
DROP POLICY IF EXISTS exceptions_owner_update ON availability_exceptions;
DROP POLICY IF EXISTS exceptions_owner_delete ON availability_exceptions;

CREATE POLICY exceptions_owner_select ON availability_exceptions
  FOR SELECT
  USING (
    provider_id IN (SELECT p.id FROM providers p WHERE p.user_id = auth.uid())
    OR (auth.jwt() ->> 'role') = 'PLATFORM_ADMIN'
  );

CREATE POLICY exceptions_owner_insert ON availability_exceptions
  FOR INSERT
  WITH CHECK (
    provider_id IN (SELECT p.id FROM providers p WHERE p.user_id = auth.uid())
    AND (auth.jwt() ->> 'role') IN ('INSTRUCTOR', 'SCHOOL_ADMIN', 'SCHOOL_STAFF', 'PLATFORM_ADMIN')
  );

CREATE POLICY exceptions_owner_update ON availability_exceptions
  FOR UPDATE
  USING (
    provider_id IN (SELECT p.id FROM providers p WHERE p.user_id = auth.uid())
    OR (auth.jwt() ->> 'role') = 'PLATFORM_ADMIN'
  );

CREATE POLICY exceptions_owner_delete ON availability_exceptions
  FOR DELETE
  USING (
    provider_id IN (SELECT p.id FROM providers p WHERE p.user_id = auth.uid())
    OR (auth.jwt() ->> 'role') = 'PLATFORM_ADMIN'
  );
