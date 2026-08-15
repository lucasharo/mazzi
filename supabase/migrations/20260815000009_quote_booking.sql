-- ============================================================================
-- MAZZI PLATFORM — MIGRATION 20260815000009
-- SPRINT 08: QUOTE + BOOKING HOLD + DOUBLE-BOOKING EXCLUSION CONSTRAINTS
-- Schema evolution for Quotes, Bookings, TSTZRANGE Exclusion Constraints,
-- RLS security policies, and transactional create_booking_hold procedure.
-- ============================================================================

-- Step 1: Ensure Btree_Gist Extension is Enabled for Combined Column Exclusion Constraints
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Step 2: Quote Status Enum & Quotes Table Evolution
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quote_status') THEN
    CREATE TYPE quote_status AS ENUM ('ACTIVE', 'EXPIRED', 'CONSUMED', 'CANCELLED');
  END IF;
END $$;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS status quote_status NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);

-- Ensure index on quotes for rapid expiry and student lookup
CREATE INDEX IF NOT EXISTS idx_quotes_student_status_expires 
  ON public.quotes (student_id, status, expires_at);

-- Step 3: Bookings Table Evolution
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255),
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;

-- Ensure generated slot_range column uses TSTZRANGE with half-open interval [start, end)
-- tstzrange(scheduled_start_at, scheduled_end_at, '[)') ensures [10:00, 11:00) does not conflict with [11:00, 12:00)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='bookings' AND column_name='slot_range'
  ) THEN
    ALTER TABLE public.bookings 
      ADD COLUMN slot_range TSTZRANGE GENERATED ALWAYS AS (
        tstzrange(scheduled_start_at, scheduled_end_at, '[)')
      ) STORED;
  END IF;
END $$;

-- Step 4: Double-Booking Exclusion Constraints (Instructor & Vehicle)
-- Active status list occupying schedule: PENDING_PAYMENT, CONFIRMED, IN_PROGRESS
-- EXCLUDE USING gist (instructor_id WITH =, slot_range WITH &&)
-- EXCLUDE USING gist (vehicle_id WITH =, slot_range WITH &&)
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS exclude_instructor_overlapping_bookings;

ALTER TABLE public.bookings
  ADD CONSTRAINT exclude_instructor_overlapping_bookings
  EXCLUDE USING gist (
    instructor_id WITH =,
    slot_range WITH &&
  )
  WHERE (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'));

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS exclude_vehicle_overlapping_bookings;

ALTER TABLE public.bookings
  ADD CONSTRAINT exclude_vehicle_overlapping_bookings
  EXCLUDE USING gist (
    vehicle_id WITH =,
    slot_range WITH &&
  )
  WHERE (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'));

-- Step 5: Performance Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_hold_expiration 
  ON public.bookings (status, hold_expires_at) 
  WHERE status = 'PENDING_PAYMENT';

CREATE INDEX IF NOT EXISTS idx_bookings_idempotency 
  ON public.bookings (idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_student_history 
  ON public.bookings (student_id, scheduled_start_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_provider_schedule 
  ON public.bookings (provider_id, scheduled_start_at);

-- Step 6: Row Level Security (RLS) Policies for Quotes & Bookings
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Quotes Policies
DROP POLICY IF EXISTS quotes_student_select ON public.quotes;
DROP POLICY IF EXISTS quotes_student_insert ON public.quotes;
DROP POLICY IF EXISTS quotes_provider_select ON public.quotes;

CREATE POLICY quotes_student_select ON public.quotes
  FOR SELECT
  USING (
    student_id = auth.uid()
    OR (auth.jwt() ->> 'role') IN ('PLATFORM_ADMIN', 'SUPPORT')
  );

CREATE POLICY quotes_student_insert ON public.quotes
  FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
  );

CREATE POLICY quotes_provider_select ON public.quotes
  FOR SELECT
  USING (
    provider_id IN (SELECT p.id FROM public.providers p WHERE p.user_id = auth.uid())
    OR instructor_id = auth.uid()
  );

-- Bookings Policies
DROP POLICY IF EXISTS bookings_student_select ON public.bookings;
DROP POLICY IF EXISTS bookings_provider_select ON public.bookings;
DROP POLICY IF EXISTS bookings_no_direct_student_update ON public.bookings;

CREATE POLICY bookings_student_select ON public.bookings
  FOR SELECT
  USING (
    student_id = auth.uid()
    OR (auth.jwt() ->> 'role') IN ('PLATFORM_ADMIN', 'SUPPORT')
  );

CREATE POLICY bookings_provider_select ON public.bookings
  FOR SELECT
  USING (
    provider_id IN (SELECT p.id FROM public.providers p WHERE p.user_id = auth.uid())
    OR instructor_id = auth.uid()
  );

-- Step 7: Atomic Stored Transaction Procedure (create_booking_hold)
-- Executes Quote Validation, Stale Hold Cleanup, Quote Lock, and Booking Insert in a single PostgreSQL transaction
CREATE OR REPLACE FUNCTION public.create_booking_hold(
  p_quote_id UUID,
  p_student_id UUID,
  p_idempotency_key VARCHAR DEFAULT NULL,
  p_hold_duration_minutes INT DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_quote RECORD;
  v_provider RECORD;
  v_vehicle RECORD;
  v_offering RECORD;
  v_existing_booking RECORD;
  v_booking_id UUID;
  v_now TIMESTAMPTZ := NOW();
  v_hold_expires_at TIMESTAMPTZ;
  v_snapshot JSONB;
BEGIN
  -- 1. Idempotency Check
  -- If same student, same operation, and same quoteId -> idempotent retry (return existing booking)
  -- If same idempotency_key is reused with different quoteId -> reject with IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_booking FROM public.bookings 
    WHERE idempotency_key = p_idempotency_key AND student_id = p_student_id;
    
    IF FOUND THEN
      IF v_existing_booking.quote_id = p_quote_id THEN
        RETURN jsonb_build_object(
          'success', true,
          'is_idempotent', true,
          'booking_id', v_existing_booking.id,
          'status', v_existing_booking.status,
          'hold_expires_at', v_existing_booking.hold_expires_at
        );
      ELSE
        RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST' USING ERRCODE = '23505';
      END IF;
    END IF;
  END IF;

  -- 2. Housekeeping: Expire stale PENDING_PAYMENT holds before evaluation
  UPDATE public.bookings 
  SET status = 'EXPIRED', expired_at = v_now, updated_at = v_now
  WHERE status = 'PENDING_PAYMENT' AND hold_expires_at <= v_now;

  -- 3. Load & Lock Quote (FOR UPDATE row lock prevents race conditions)
  SELECT * INTO v_quote FROM public.quotes 
  WHERE id = p_quote_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUOTE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_quote.student_id != p_student_id THEN
    RAISE EXCEPTION 'CROSS_STUDENT_QUOTE_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  IF v_quote.status != 'ACTIVE' THEN
    IF v_quote.status = 'CONSUMED' THEN
      RAISE EXCEPTION 'QUOTE_ALREADY_CONSUMED' USING ERRCODE = '22000';
    ELSE
      RAISE EXCEPTION 'QUOTE_NOT_ACTIVE' USING ERRCODE = '22000';
    END IF;
  END IF;

  IF v_quote.expires_at <= v_now THEN
    UPDATE public.quotes SET status = 'EXPIRED' WHERE id = p_quote_id;
    RAISE EXCEPTION 'QUOTE_EXPIRED' USING ERRCODE = '22000';
  END IF;

  -- 4. Revalidate Provider, Vehicle, and Service Offering operational eligibility
  SELECT * INTO v_provider FROM public.providers WHERE id = v_quote.provider_id;
  IF NOT FOUND OR v_provider.status != 'ACTIVE' THEN
    RAISE EXCEPTION 'PROVIDER_NOT_ACTIVE' USING ERRCODE = '22000';
  END IF;

  SELECT * INTO v_vehicle FROM public.vehicles WHERE id = v_quote.vehicle_id;
  IF NOT FOUND OR v_vehicle.status != 'ACTIVE' THEN
    RAISE EXCEPTION 'VEHICLE_NOT_ACTIVE' USING ERRCODE = '22000';
  END IF;

  SELECT * INTO v_offering FROM public.service_offerings WHERE id = v_quote.offering_id;
  IF NOT FOUND OR v_offering.is_active != TRUE THEN
    RAISE EXCEPTION 'OFFERING_NOT_ACTIVE' USING ERRCODE = '22000';
  END IF;

  -- 5. Calculate Hold Expiration
  v_hold_expires_at := v_now + (p_hold_duration_minutes || ' minutes')::INTERVAL;

  -- 6. Construct Immutable Historical Snapshot
  v_snapshot := jsonb_build_object(
    'providerId', v_provider.id,
    'providerName', v_provider.trade_name,
    'providerType', v_provider.type,
    'instructorId', v_quote.instructor_id,
    'instructorName', 'Instrutor ' || v_quote.instructor_id,
    'vehicleId', v_vehicle.id,
    'vehicleName', v_vehicle.brand || ' ' || v_vehicle.model,
    'vehicleBrand', v_vehicle.brand,
    'vehicleModel', v_vehicle.model,
    'category', v_offering.category,
    'transmission', v_vehicle.transmission,
    'durationMinutes', v_offering.duration_minutes,
    'priceInCents', v_quote.price_in_cents,
    'platformFeeInCents', v_quote.platform_fee_in_cents,
    'totalInCents', v_quote.total_in_cents,
    'meetingPoint', COALESCE(v_provider.neighborhood, v_provider.city)
  );

  -- 7. Insert Booking (Exclusion constraint EXCLUDE USING gist triggers exclusion_violation 23P01 on overlap)
  v_booking_id := gen_random_uuid();
  INSERT INTO public.bookings (
    id,
    student_id,
    provider_id,
    instructor_id,
    vehicle_id,
    offering_id,
    quote_id,
    status,
    scheduled_start_at,
    scheduled_end_at,
    hold_expires_at,
    idempotency_key,
    price_in_cents,
    platform_fee_in_cents,
    total_in_cents,
    snapshot_data,
    created_at,
    updated_at
  ) VALUES (
    v_booking_id,
    p_student_id,
    v_quote.provider_id,
    v_quote.instructor_id,
    v_quote.vehicle_id,
    v_quote.offering_id,
    p_quote_id,
    'PENDING_PAYMENT',
    v_quote.scheduled_start_at,
    v_quote.scheduled_end_at,
    v_hold_expires_at,
    p_idempotency_key,
    v_quote.price_in_cents,
    v_quote.platform_fee_in_cents,
    v_quote.total_in_cents,
    v_snapshot,
    v_now,
    v_now
  );

  -- 8. Mark Quote as CONSUMED
  UPDATE public.quotes 
  SET status = 'CONSUMED', consumed_at = v_now 
  WHERE id = p_quote_id;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'status', 'PENDING_PAYMENT',
    'hold_expires_at', v_hold_expires_at
  );
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION 'SLOT_NO_LONGER_AVAILABLE' USING ERRCODE = '23P01';
END;
$$;

-- Revoke public & anon access to RPC; grant exclusively to authenticated and service_role
REVOKE ALL ON FUNCTION public.create_booking_hold(UUID, UUID, VARCHAR, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_booking_hold(UUID, UUID, VARCHAR, INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_booking_hold(UUID, UUID, VARCHAR, INT) TO authenticated, service_role;
