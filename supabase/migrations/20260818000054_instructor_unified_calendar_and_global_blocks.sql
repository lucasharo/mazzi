-- ============================================================================
-- MAZZI PLATFORM — MIGRATION 54: Unified Instructor Calendar & Dedicated Global Personal Blocks
-- File: supabase/migrations/20260818000054_instructor_unified_calendar_and_global_blocks.sql
-- ============================================================================

-- 1. DEDICATED TABLE FOR INSTRUCTOR GLOBAL PERSONAL BLOCKS
-- Personal blocks belong to the instructor's physical identity (auth.uid() = instructor_id).
-- They DO NOT have a provider_id because they block the instructor globally across all providers.
CREATE TABLE IF NOT EXISTS public.instructor_global_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_instructor_global_blocks_dates CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_instructor_global_blocks_search
  ON public.instructor_global_blocks (instructor_id, start_at, end_at);

-- RLS & SECURITY ON INSTRUCTOR_GLOBAL_BLOCKS
ALTER TABLE public.instructor_global_blocks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.instructor_global_blocks FROM PUBLIC;
REVOKE ALL ON public.instructor_global_blocks FROM anon;

DROP POLICY IF EXISTS instructor_global_blocks_owner_select ON public.instructor_global_blocks;
CREATE POLICY instructor_global_blocks_owner_select ON public.instructor_global_blocks
  FOR SELECT
  USING (
    instructor_id = auth.uid()
    OR (auth.jwt() ->> 'role') = 'PLATFORM_ADMIN'
  );

-- Block direct INSERT/UPDATE/DELETE from browser; force mutation via SECURITY DEFINER RPCs below.
REVOKE INSERT, UPDATE, DELETE ON public.instructor_global_blocks FROM authenticated;


-- 2. RPC: get_my_instructor_global_blocks()
-- Returns active global personal blocks for the authenticated instructor.
CREATE OR REPLACE FUNCTION public.get_my_instructor_global_blocks()
RETURNS TABLE (
  id UUID,
  instructor_id UUID,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  reason TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    igb.id,
    igb.instructor_id,
    igb.start_at,
    igb.end_at,
    igb.reason,
    igb.created_at,
    igb.updated_at
  FROM public.instructor_global_blocks igb
  WHERE igb.instructor_id = v_uid
  ORDER BY igb.start_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_instructor_global_blocks() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_instructor_global_blocks() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_instructor_global_blocks() TO authenticated, service_role;


-- 3. RPC: save_instructor_global_block()
-- Creates or updates a global personal block owned strictly by auth.uid().
CREATE OR REPLACE FUNCTION public.save_instructor_global_block(
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  p_reason TEXT DEFAULT NULL,
  p_block_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF p_start_at IS NULL OR p_end_at IS NULL OR p_end_at <= p_start_at THEN
    RAISE EXCEPTION 'INVALID_TIME_RANGE' USING ERRCODE = '22023';
  END IF;

  IF p_block_id IS NOT NULL THEN
    SELECT id INTO v_id FROM public.instructor_global_blocks
    WHERE id = p_block_id AND instructor_id = v_uid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'GLOBAL_BLOCK_NOT_FOUND_OR_UNAUTHORIZED' USING ERRCODE = '42501';
    END IF;

    UPDATE public.instructor_global_blocks
    SET start_at = p_start_at,
        end_at = p_end_at,
        reason = p_reason,
        updated_at = v_now
    WHERE id = v_id;
  ELSE
    v_id := gen_random_uuid();
    INSERT INTO public.instructor_global_blocks (
      id, instructor_id, start_at, end_at, reason, created_at, updated_at
    ) VALUES (
      v_id, v_uid, p_start_at, p_end_at, p_reason, v_now, v_now
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_id,
    'instructor_id', v_uid,
    'start_at', p_start_at,
    'end_at', p_end_at,
    'reason', p_reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_instructor_global_block(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_instructor_global_block(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_instructor_global_block(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID) TO authenticated, service_role;


-- 4. RPC: delete_instructor_global_block()
-- Deletes a global personal block owned strictly by auth.uid().
CREATE OR REPLACE FUNCTION public.delete_instructor_global_block(
  p_block_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_deleted_count INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.instructor_global_blocks
  WHERE id = p_block_id AND instructor_id = v_uid;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF v_deleted_count = 0 THEN
    RAISE EXCEPTION 'GLOBAL_BLOCK_NOT_FOUND_OR_UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object('success', true, 'id', p_block_id);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_instructor_global_block(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_instructor_global_block(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_instructor_global_block(UUID) TO authenticated, service_role;


-- 5. RPC: get_my_unified_instructor_bookings()
-- Returns all bookings assigned to auth.uid() as the instructor across ALL provider contexts.
-- Exact schema alignment: refund_amount_in_cents BIGINT, cancelled_by TEXT.
CREATE OR REPLACE FUNCTION public.get_my_unified_instructor_bookings()
RETURNS TABLE (
  id UUID,
  student_id UUID,
  provider_id UUID,
  provider_name TEXT,
  instructor_id UUID,
  instructor_name TEXT,
  vehicle_id UUID,
  vehicle_name TEXT,
  offering_id UUID,
  quote_id UUID,
  status public.booking_status,
  scheduled_start_at TIMESTAMPTZ,
  scheduled_end_at TIMESTAMPTZ,
  checkin_student_at TIMESTAMPTZ,
  checkin_instructor_at TIMESTAMPTZ,
  lesson_started_at TIMESTAMPTZ,
  lesson_finished_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  hold_expires_at TIMESTAMPTZ,
  idempotency_key VARCHAR,
  cancelled_at TIMESTAMPTZ,
  cancelled_by TEXT,
  cancellation_reason TEXT,
  refund_amount_in_cents BIGINT,
  expired_at TIMESTAMPTZ,
  price_in_cents INT,
  platform_fee_in_cents INT,
  total_in_cents INT,
  snapshot_data JSONB,
  meeting_point JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    b.id,
    b.student_id,
    b.provider_id,
    COALESCE(b.snapshot_data->>'providerName', p.trade_name, p.legal_name, '')::TEXT AS provider_name,
    b.instructor_id,
    COALESCE(b.snapshot_data->>'instructorName', iu.name, '')::TEXT AS instructor_name,
    b.vehicle_id,
    COALESCE(b.snapshot_data->>'vehicleName', (v.brand || ' ' || v.model), '')::TEXT AS vehicle_name,
    b.offering_id,
    b.quote_id,
    b.status,
    b.scheduled_start_at,
    b.scheduled_end_at,
    b.checkin_student_at,
    b.checkin_instructor_at,
    b.lesson_started_at,
    b.lesson_finished_at,
    b.completed_at,
    b.confirmed_at,
    b.updated_at,
    b.hold_expires_at,
    b.idempotency_key,
    b.cancelled_at,
    b.cancelled_by,
    b.cancellation_reason,
    b.refund_amount_in_cents,
    b.expired_at,
    b.price_in_cents,
    b.platform_fee_in_cents,
    b.total_in_cents,
    b.snapshot_data,
    b.meeting_point,
    b.created_at
  FROM public.bookings b
  LEFT JOIN public.providers p ON p.id = b.provider_id
  LEFT JOIN public.users iu ON iu.id = b.instructor_id
  LEFT JOIN public.vehicles v ON v.id = b.vehicle_id
  WHERE b.instructor_id = v_uid
  ORDER BY b.scheduled_start_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_unified_instructor_bookings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_unified_instructor_bookings() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_unified_instructor_bookings() TO authenticated, service_role;


-- 6. RPC: is_offering_slot_available()
-- Checks slot availability enforcing global blocks, provider blocks, overrides, base availability and booking overlaps
CREATE OR REPLACE FUNCTION public.is_offering_slot_available(
  p_offering_id UUID,
  p_scheduled_start_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_offering public.service_offerings%ROWTYPE;
  v_provider public.providers%ROWTYPE;
  v_instructor public.users%ROWTYPE;
  v_vehicle public.vehicles%ROWTYPE;
  v_scheduled_end_at TIMESTAMPTZ;
  v_now TIMESTAMPTZ := NOW();
  v_interval_minutes INTEGER := 60;
  v_has_override BOOLEAN := FALSE;
  v_tz TEXT := 'America/Sao_Paulo';
  v_local_start TIMESTAMPTZ;
  v_local_end TIMESTAMPTZ;
  v_local_start_time TIME;
  v_local_end_time TIME;
  v_local_date DATE;
  v_dow INTEGER;
BEGIN
  -- A) Start date must be in the future
  IF p_scheduled_start_at IS NULL OR p_scheduled_start_at <= v_now THEN
    RETURN FALSE;
  END IF;

  -- B) Offering validation
  SELECT * INTO v_offering FROM public.service_offerings WHERE id = p_offering_id;
  IF NOT FOUND OR v_offering.status <> 'ACTIVE' OR v_offering.is_active IS NOT TRUE
     OR v_offering.instructor_id IS NULL OR v_offering.vehicle_id IS NULL
     OR COALESCE(v_offering.duration_minutes, 0) <= 0 THEN
    RETURN FALSE;
  END IF;

  -- C) Provider validation
  SELECT * INTO v_provider FROM public.providers WHERE id = v_offering.provider_id;
  IF NOT FOUND OR v_provider.status <> 'ACTIVE' THEN
    RETURN FALSE;
  END IF;

  -- D) Instructor validation
  SELECT * INTO v_instructor FROM public.users WHERE id = v_offering.instructor_id;
  IF NOT FOUND OR v_instructor.status <> 'ACTIVE' THEN
    RETURN FALSE;
  END IF;

  -- E) Vehicle validation
  SELECT * INTO v_vehicle FROM public.vehicles WHERE id = v_offering.vehicle_id;
  IF NOT FOUND OR v_vehicle.status <> 'ACTIVE' OR v_vehicle.deleted_at IS NOT NULL OR v_vehicle.provider_id <> v_offering.provider_id THEN
    RETURN FALSE;
  END IF;

  v_scheduled_end_at := p_scheduled_start_at + make_interval(mins => v_offering.duration_minutes);

  -- Fetch interval setting
  SELECT COALESCE((value->>'slot_interval_minutes')::integer, 60)
  INTO v_interval_minutes
  FROM public.platform_configurations
  WHERE key = 'scheduling_settings'
  LIMIT 1;
  v_interval_minutes := GREATEST(COALESCE(v_interval_minutes, 60), 1);

  -- F1) INSTRUCTOR GLOBAL PERSONAL BLOCK Exception Check (Beats EVERYTHING including provider overrides)
  IF EXISTS (
    SELECT 1 FROM public.instructor_global_blocks igb
    WHERE igb.instructor_id = v_offering.instructor_id
      AND igb.start_at < v_scheduled_end_at
      AND igb.end_at > p_scheduled_start_at
  ) THEN
    RETURN FALSE;
  END IF;

  -- F2) PROVIDER-SPECIFIC BLOCK Exceptions Check (availability_exceptions)
  IF EXISTS (
    SELECT 1 FROM public.availability_exceptions e
    WHERE e.provider_id = v_offering.provider_id
      AND e.type = 'BLOCK'
      AND (e.instructor_id IS NULL OR e.instructor_id = v_offering.instructor_id)
      AND (e.vehicle_id IS NULL OR e.vehicle_id = v_offering.vehicle_id)
      AND e.start_at < v_scheduled_end_at
      AND e.end_at > p_scheduled_start_at
  ) THEN
    RETURN FALSE;
  END IF;

  -- G) Check AVAILABLE_OVERRIDE Exceptions (Only if NO global block is present)
  IF EXISTS (
    SELECT 1 FROM public.availability_exceptions e
    WHERE e.provider_id = v_offering.provider_id
      AND e.type = 'AVAILABLE_OVERRIDE'
      AND (e.instructor_id IS NULL OR e.instructor_id = v_offering.instructor_id)
      AND (e.vehicle_id IS NULL OR e.vehicle_id = v_offering.vehicle_id)
      AND e.start_at <= p_scheduled_start_at
      AND e.end_at >= v_scheduled_end_at
  ) THEN
    v_has_override := TRUE;
  END IF;

  -- H) Recurrent Base Availability Check (Required unless AVAILABLE_OVERRIDE is present)
  IF NOT v_has_override THEN
    SELECT COALESCE(a.timezone, 'America/Sao_Paulo') INTO v_tz
    FROM public.availabilities a
    WHERE a.provider_id = v_offering.provider_id AND a.is_active = TRUE
    LIMIT 1;
    v_tz := COALESCE(v_tz, 'America/Sao_Paulo');

    v_local_start := p_scheduled_start_at AT TIME ZONE v_tz;
    v_local_end := v_scheduled_end_at AT TIME ZONE v_tz;
    v_local_date := v_local_start::date;
    v_local_start_time := v_local_start::time;
    v_local_end_time := v_local_end::time;
    v_dow := extract(isodow from v_local_start)::integer;

    IF NOT EXISTS (
      SELECT 1 FROM public.availabilities a
      WHERE a.provider_id = v_offering.provider_id
        AND a.is_active = TRUE
        AND (a.instructor_id IS NULL OR a.instructor_id = v_offering.instructor_id)
        AND (a.vehicle_id IS NULL OR a.vehicle_id = v_offering.vehicle_id)
        AND a.day_of_week = v_dow
        AND (a.effective_from IS NULL OR v_local_date >= a.effective_from)
        AND (a.effective_to IS NULL OR v_local_date <= a.effective_to)
        AND a.start_time <= v_local_start_time
        AND a.end_time >= v_local_end_time
    ) THEN
      RETURN FALSE;
    END IF;
  END IF;

  -- I) Slot Alignment Check: minute modulo interval
  IF (extract(minute from (p_scheduled_start_at at time zone v_tz))::integer % v_interval_minutes) <> 0 THEN
    RETURN FALSE;
  END IF;

  -- J) Overlapping Active Bookings Check Across ALL Providers for the same instructor_id
  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE (b.instructor_id = v_offering.instructor_id OR b.vehicle_id = v_offering.vehicle_id)
      AND b.scheduled_start_at < v_scheduled_end_at
      AND b.scheduled_end_at > p_scheduled_start_at
      AND (
        b.status IN ('CONFIRMED', 'IN_PROGRESS')
        OR (b.status = 'PENDING_PAYMENT' AND (b.hold_expires_at IS NULL OR b.hold_expires_at > v_now))
      )
  ) THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.is_offering_slot_available(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_offering_slot_available(UUID, TIMESTAMPTZ) TO anon, authenticated, service_role;
