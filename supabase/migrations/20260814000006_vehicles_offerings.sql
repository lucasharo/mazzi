-- ============================================================================
-- MAZZI PLATFORM — SPRINT 05 MIGRATION: VEHICLES & SERVICE OFFERINGS (INCREMENTAL)
-- File: supabase/migrations/20260814000006_vehicles_offerings.sql
-- ============================================================================

-- 1. ENUM EXTENSIONS & TYPE SYNCHRONIZATION
-- Add 'DRAFT' value to vehicle_status enum if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = 'vehicle_status' AND pg_enum.enumlabel = 'DRAFT'
  ) THEN
    ALTER TYPE vehicle_status ADD VALUE 'DRAFT' BEFORE 'PENDING';
  END IF;
END $$;

-- Ensure vehicle_type enum exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_type') THEN
    CREATE TYPE vehicle_type AS ENUM ('MOTORCYCLE', 'CAR');
  END IF;
END $$;

-- 2. INCREMENTAL VEHICLES TABLE EVOLUTION
-- Modify existing vehicles table created in 20260814000001_initial_schema.sql
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS vehicle_type vehicle_type NOT NULL DEFAULT 'CAR',
  ADD COLUMN IF NOT EXISTS color VARCHAR(50),
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Add category/type & transmission integrity constraints if not existing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_vehicle_category_type_consistency'
  ) THEN
    ALTER TABLE vehicles ADD CONSTRAINT chk_vehicle_category_type_consistency CHECK (
      (category = 'A' AND vehicle_type = 'MOTORCYCLE') OR
      (category = 'B' AND vehicle_type = 'CAR') OR
      (category NOT IN ('A', 'B'))
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_car_transmission_required'
  ) THEN
    ALTER TABLE vehicles ADD CONSTRAINT chk_car_transmission_required CHECK (
      (vehicle_type = 'CAR' AND transmission IN ('MANUAL', 'AUTOMATIC')) OR
      (vehicle_type = 'MOTORCYCLE')
    );
  END IF;
END $$;

-- 3. INCREMENTAL SERVICE OFFERINGS EVOLUTION
-- Ensure service_offerings has status column aligned with domain
ALTER TABLE service_offerings
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE'));

-- Uniqueness constraint: Prevent exact active duplicate offerings for same provider, vehicle, category & duration
CREATE UNIQUE INDEX IF NOT EXISTS idx_uniq_active_offering
  ON service_offerings (provider_id, vehicle_id, category, duration_minutes)
  WHERE (status = 'ACTIVE');

-- 4. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_vehicles_provider_status ON vehicles(provider_id, status);
CREATE INDEX IF NOT EXISTS idx_vehicles_category ON vehicles(category);
CREATE INDEX IF NOT EXISTS idx_service_offerings_provider_status ON service_offerings(provider_id, status);
CREATE INDEX IF NOT EXISTS idx_service_offerings_vehicle ON service_offerings(vehicle_id);

-- 5. PUBLIC SANITIZED VIEWS (LICENCE PLATE PRIVACY BOUNDARY & SECURITY INVOKER)
-- Security Strategy: Views use WITH (security_invoker = true) so that querying the view
-- executes under the caller's privileges and strictly respects RLS policies on base tables.
-- Public vehicles view NEVER exposes license_plate or license_plate_masked.

DROP VIEW IF EXISTS public_service_offerings CASCADE;
DROP VIEW IF EXISTS public_vehicles CASCADE;

CREATE VIEW public_vehicles
WITH (security_invoker = true) AS
SELECT
  v.id,
  v.provider_id,
  v.brand,
  v.model,
  v.year,
  v.vehicle_type,
  v.category,
  v.transmission,
  v.color,
  v.photos,
  (v.brand || ' ' || v.model || ' (' || v.year || ')') AS display_title
FROM vehicles v
WHERE v.status = 'ACTIVE' AND v.deleted_at IS NULL;

CREATE VIEW public_service_offerings
WITH (security_invoker = true) AS
SELECT
  so.id,
  so.provider_id,
  so.vehicle_id,
  so.category,
  so.duration_minutes,
  so.price_in_cents,
  so.status,
  pv.brand AS vehicle_brand,
  pv.model AS vehicle_model,
  pv.year AS vehicle_year,
  pv.transmission AS vehicle_transmission,
  pv.photos AS vehicle_photos
FROM service_offerings so
JOIN public_vehicles pv ON pv.id = so.vehicle_id
JOIN providers p ON p.id = so.provider_id
WHERE so.status = 'ACTIVE'
  AND p.status = 'ACTIVE';

-- Grant SELECT access on public views to anonymous and authenticated users
GRANT SELECT ON public_vehicles TO anon, authenticated;
GRANT SELECT ON public_service_offerings TO anon, authenticated;

-- 6. STRICT ROW LEVEL SECURITY (RLS) POLICIES
-- NOTE: SUPPORT role MUST NOT have generic write/admin overrides.
-- SUPPORT cannot INSERT or UPDATE vehicles or service offerings.

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_offerings ENABLE ROW LEVEL SECURITY;

-- Vehicles RLS
DROP POLICY IF EXISTS "Public can view active vehicles" ON vehicles;
DROP POLICY IF EXISTS vehicles_owner_select ON vehicles;
DROP POLICY IF EXISTS vehicles_owner_insert ON vehicles;
DROP POLICY IF EXISTS vehicles_owner_update ON vehicles;

CREATE POLICY vehicles_public_select ON vehicles
  FOR SELECT
  USING (
    (status = 'ACTIVE' AND deleted_at IS NULL)
    OR provider_id IN (
      SELECT p.id FROM providers p WHERE p.user_id = auth.uid()
    )
    OR (auth.jwt() ->> 'role') = 'PLATFORM_ADMIN'
  );

CREATE POLICY vehicles_owner_insert ON vehicles
  FOR INSERT
  WITH CHECK (
    provider_id IN (
      SELECT p.id FROM providers p WHERE p.user_id = auth.uid()
    )
    AND (auth.jwt() ->> 'role') IN ('INSTRUCTOR', 'SCHOOL_ADMIN', 'SCHOOL_STAFF', 'PLATFORM_ADMIN')
  );

CREATE POLICY vehicles_owner_update ON vehicles
  FOR UPDATE
  USING (
    provider_id IN (
      SELECT p.id FROM providers p WHERE p.user_id = auth.uid()
    )
    OR (auth.jwt() ->> 'role') = 'PLATFORM_ADMIN'
  );

-- Service Offerings RLS
DROP POLICY IF EXISTS "Public can view active offerings" ON service_offerings;
DROP POLICY IF EXISTS offerings_owner_select ON service_offerings;
DROP POLICY IF EXISTS offerings_owner_insert ON service_offerings;
DROP POLICY IF EXISTS offerings_owner_update ON service_offerings;

CREATE POLICY offerings_public_select ON service_offerings
  FOR SELECT
  USING (
    status = 'ACTIVE'
    OR provider_id IN (
      SELECT p.id FROM providers p WHERE p.user_id = auth.uid()
    )
    OR (auth.jwt() ->> 'role') = 'PLATFORM_ADMIN'
  );

CREATE POLICY offerings_owner_insert ON service_offerings
  FOR INSERT
  WITH CHECK (
    provider_id IN (
      SELECT p.id FROM providers p WHERE p.user_id = auth.uid()
    )
    AND vehicle_id IN (
      SELECT v.id FROM vehicles v WHERE v.provider_id = provider_id
    )
    AND (auth.jwt() ->> 'role') IN ('INSTRUCTOR', 'SCHOOL_ADMIN', 'SCHOOL_STAFF', 'PLATFORM_ADMIN')
  );

CREATE POLICY offerings_owner_update ON service_offerings
  FOR UPDATE
  USING (
    provider_id IN (
      SELECT p.id FROM providers p WHERE p.user_id = auth.uid()
    )
    OR (auth.jwt() ->> 'role') = 'PLATFORM_ADMIN'
  );
