-- ============================================================================
-- MAZZI PLATFORM — MIGRATION 40: RESTORE SLOT SCHEDULING CONTRACT & READ-ONLY AVAILABILITY
-- File: supabase/migrations/20260818000040_restore_slot_contract_and_readonly_availability.sql
-- ============================================================================

-- 1. READ-ONLY AVAILABILITY CHECK FUNCTION
-- Must be STABLE SECURITY DEFINER with NO DML statements to allow safe execution in read-only RPCs.
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

  -- F) BLOCK Exceptions Check (BLOCK overrides EVERYTHING)
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

  -- G) Check AVAILABLE_OVERRIDE Exceptions
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

  -- J) Overlapping Active Bookings Check
  -- Cancelled bookings or expired PENDING_PAYMENT holds (hold_expires_at <= NOW()) DO NOT BLOCK!
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

REVOKE ALL ON FUNCTION public.is_offering_slot_available(UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;


-- 2. STABLE READ-ONLY RPC: get_available_slots_public
CREATE OR REPLACE FUNCTION public.get_available_slots_public(
  p_offering_id uuid,
  p_date_from date,
  p_date_to date
)
RETURNS TABLE (
  offering_id uuid,
  provider_id uuid,
  instructor_id uuid,
  vehicle_id uuid,
  slot_start_at timestamp with time zone,
  slot_end_at timestamp with time zone,
  local_date date,
  local_start_time time without time zone,
  local_end_time time without time zone,
  timezone text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
declare
  v_offering public.service_offerings%rowtype;
  v_interval_minutes integer := 60;
  v_max_horizon integer := 30;
begin
  if p_date_from is null or p_date_to is null or p_date_to < p_date_from then
    raise exception 'INVALID_SLOT_DATE_RANGE' using errcode = '22023';
  end if;

  select coalesce((value->>'slot_interval_minutes')::integer, 60),
         coalesce((value->>'max_booking_horizon_days')::integer, 30)
    into v_interval_minutes, v_max_horizon
  from public.platform_configurations
  where key = 'scheduling_settings'
  limit 1;
  v_interval_minutes := greatest(coalesce(v_interval_minutes, 60), 1);
  v_max_horizon := greatest(coalesce(v_max_horizon, 30), 1);

  if p_date_to - p_date_from > 31 then
    raise exception 'SLOT_DATE_RANGE_TOO_LARGE' using errcode = '22023';
  end if;
  if p_date_to > (current_date + v_max_horizon) then
    raise exception 'SLOT_DATE_BEYOND_BOOKING_HORIZON' using errcode = '22023';
  end if;

  select * into v_offering from public.service_offerings where id = p_offering_id;
  if not found or v_offering.status <> 'ACTIVE' or v_offering.is_active is not true
     or v_offering.instructor_id is null or v_offering.vehicle_id is null then
    return;
  end if;

  return query
  with base_candidates as (
    select distinct
      a.timezone::text as tz,
      gs as start_at,
      gs + make_interval(mins => v_offering.duration_minutes) as end_at
    from public.availabilities a
    cross join lateral generate_series(
      greatest(p_date_from, current_date),
      p_date_to,
      interval '1 day'
    ) d(day_ts)
    cross join lateral generate_series(
      ((d.day_ts::date + a.start_time) at time zone a.timezone),
      ((d.day_ts::date + a.end_time) at time zone a.timezone) - make_interval(mins => v_offering.duration_minutes),
      make_interval(mins => v_interval_minutes)
    ) gs
    where a.provider_id = v_offering.provider_id
      and a.is_active = true
      and (a.instructor_id is null or a.instructor_id = v_offering.instructor_id)
      and (a.vehicle_id is null or a.vehicle_id = v_offering.vehicle_id)
      and a.day_of_week = extract(isodow from d.day_ts)::integer
      and (a.effective_from is null or d.day_ts::date >= a.effective_from)
      and (a.effective_to is null or d.day_ts::date <= a.effective_to)
  ),
  override_candidates as (
    select distinct
      'America/Sao_Paulo'::text as tz,
      gs as start_at,
      gs + make_interval(mins => v_offering.duration_minutes) as end_at
    from public.availability_exceptions e
    cross join lateral generate_series(
      e.start_at,
      e.end_at - make_interval(mins => v_offering.duration_minutes),
      make_interval(mins => v_interval_minutes)
    ) gs
    where e.provider_id = v_offering.provider_id
      and e.type = 'AVAILABLE_OVERRIDE'
      and (e.instructor_id is null or e.instructor_id = v_offering.instructor_id)
      and (e.vehicle_id is null or e.vehicle_id = v_offering.vehicle_id)
      and (e.start_at at time zone 'America/Sao_Paulo')::date between p_date_from and p_date_to
  ),
  candidates as (
    select * from base_candidates
    union
    select * from override_candidates
  )
  select
    v_offering.id,
    v_offering.provider_id,
    v_offering.instructor_id,
    v_offering.vehicle_id,
    c.start_at,
    c.end_at,
    (c.start_at at time zone c.tz)::date,
    (c.start_at at time zone c.tz)::time,
    (c.end_at at time zone c.tz)::time,
    c.tz
  from candidates c
  where c.start_at > now()
    and public.is_offering_slot_available(v_offering.id, c.start_at)
  order by c.start_at;
end;
$$;

REVOKE ALL ON FUNCTION public.get_available_slots_public(UUID, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_available_slots_public(UUID, DATE, DATE) TO anon, authenticated;


--- 3. WRITE-PATH: create_quote_from_offering
-- ============================================================================
-- HOTFIX (TASK-008): Corrige INSERT que omitia provider_id/instructor_id/vehicle_id
-- Restaura idempotência atômica (ON CONFLICT DO NOTHING) da migration 38/39
-- Preenche contrato de resposta JSON completo (14 campos)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_quote_from_offering(
  p_offering_id UUID,
  p_scheduled_start_at TIMESTAMPTZ,
  p_idempotency_key VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid              UUID         := auth.uid();
  v_offering         public.service_offerings%ROWTYPE;
  v_provider         public.providers%ROWTYPE;
  v_existing_quote   public.quotes%ROWTYPE;
  v_scheduled_end_at TIMESTAMPTZ;
  v_now              TIMESTAMPTZ  := NOW();
  v_expires_at       TIMESTAMPTZ;
  v_ttl_minutes      INT          := 15;
  v_platform_fee_cents INT        := 1000;
  v_new_quote_id     UUID;
BEGIN
  -- ── 1. Authentication ─────────────────────────────────────────────────────
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;

  -- ── 2. WRITE PATH HOUSEKEEPING ────────────────────────────────────────────
  -- Expire stale PENDING_PAYMENT holds before checking/creating quotes.
  -- This DML belongs here (VOLATILE write path), NOT in is_offering_slot_available.
  UPDATE public.bookings
  SET status = 'EXPIRED', expired_at = v_now, updated_at = v_now
  WHERE status = 'PENDING_PAYMENT' AND hold_expires_at <= v_now;

  -- ── 3. FAST PATH Idempotency Check ────────────────────────────────────────
  -- If we already have a quote for this key, return it immediately (retries).
  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing_quote
    FROM public.quotes
    WHERE idempotency_key = TRIM(p_idempotency_key)
      AND student_id = v_uid
    LIMIT 1;

    IF FOUND THEN
      -- Guard: same key must match same request parameters
      IF v_existing_quote.offering_id <> p_offering_id
         OR v_existing_quote.scheduled_start_at <> p_scheduled_start_at
      THEN
        RAISE EXCEPTION 'QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'
          USING ERRCODE = '23505';
      END IF;

      IF v_existing_quote.status = 'ACTIVE' AND v_existing_quote.expires_at > v_now THEN
        RETURN jsonb_build_object(
          'success',               true,
          'is_idempotent',         true,
          'quote_id',              v_existing_quote.id,
          'student_id',            v_existing_quote.student_id,
          'provider_id',           v_existing_quote.provider_id,
          'instructor_id',         v_existing_quote.instructor_id,
          'vehicle_id',            v_existing_quote.vehicle_id,
          'offering_id',           v_existing_quote.offering_id,
          'scheduled_start_at',    v_existing_quote.scheduled_start_at,
          'scheduled_end_at',      v_existing_quote.scheduled_end_at,
          'price_in_cents',        v_existing_quote.price_in_cents,
          'platform_fee_in_cents', v_existing_quote.platform_fee_in_cents,
          'total_in_cents',        v_existing_quote.total_in_cents,
          'status',                v_existing_quote.status,
          'expires_at',            v_existing_quote.expires_at
        );
      ELSE
        -- Historical quote (CONSUMED or EXPIRED) — reject stale key
        RAISE EXCEPTION 'QUOTE_IDEMPOTENCY_KEY_STALE' USING ERRCODE = '22023';
      END IF;
    END IF;
  END IF;

  -- ── 4. Offering Validation ─────────────────────────────────────────────────
  SELECT * INTO v_offering FROM public.service_offerings WHERE id = p_offering_id;
  IF NOT FOUND OR v_offering.status <> 'ACTIVE' OR v_offering.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'OFFERING_NOT_FOUND_OR_INACTIVE' USING ERRCODE = '22023';
  END IF;

  IF v_offering.instructor_id IS NULL THEN
    RAISE EXCEPTION 'OFFERING_INSTRUCTOR_NOT_ASSIGNED' USING ERRCODE = '22023';
  END IF;

  IF v_offering.vehicle_id IS NULL THEN
    RAISE EXCEPTION 'OFFERING_VEHICLE_NOT_ASSIGNED' USING ERRCODE = '22023';
  END IF;

  -- ── 5. Provider Validation ─────────────────────────────────────────────────
  SELECT * INTO v_provider FROM public.providers WHERE id = v_offering.provider_id;
  IF NOT FOUND OR v_provider.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'PROVIDER_INACTIVE' USING ERRCODE = '22023';
  END IF;

  -- ── 6. Time Validation ────────────────────────────────────────────────────
  IF p_scheduled_start_at IS NULL OR p_scheduled_start_at <= v_now THEN
    RAISE EXCEPTION 'SLOT_MUST_BE_IN_FUTURE' USING ERRCODE = '22023';
  END IF;

  -- ── 7. Slot Availability (read-only STABLE helper) ────────────────────────
  IF NOT public.is_offering_slot_available(p_offering_id, p_scheduled_start_at) THEN
    RAISE EXCEPTION 'SELECTED_SLOT_NOT_AVAILABLE' USING ERRCODE = '22023';
  END IF;

  -- ── 8. Compute Values ─────────────────────────────────────────────────────
  v_scheduled_end_at := p_scheduled_start_at + make_interval(mins => v_offering.duration_minutes);
  v_expires_at       := v_now + make_interval(mins => v_ttl_minutes);
  v_new_quote_id     := gen_random_uuid();

  -- ── 9. ATOMIC Idempotent INSERT (TOCTOU-safe) ─────────────────────────────
  -- ON CONFLICT prevents duplicate quotes in high-concurrency scenarios.
  -- The unique index uq_quotes_student_idempotency covers (student_id, idempotency_key)
  -- WHERE idempotency_key IS NOT NULL.
  INSERT INTO public.quotes (
    id,
    student_id,
    provider_id,
    instructor_id,
    vehicle_id,
    offering_id,
    scheduled_start_at,
    scheduled_end_at,
    price_in_cents,
    platform_fee_in_cents,
    total_in_cents,
    status,
    expires_at,
    created_at,
    idempotency_key
  ) VALUES (
    v_new_quote_id,
    v_uid,
    v_offering.provider_id,
    v_offering.instructor_id,
    v_offering.vehicle_id,
    v_offering.id,
    p_scheduled_start_at,
    v_scheduled_end_at,
    v_offering.price_in_cents,
    v_platform_fee_cents,
    (v_offering.price_in_cents + v_platform_fee_cents),
    'ACTIVE',
    v_expires_at,
    v_now,
    NULLIF(TRIM(p_idempotency_key), '')
  )
  ON CONFLICT (student_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL
  DO NOTHING
  RETURNING * INTO v_existing_quote;

  -- ── 10. Conflict Branch (concurrent race winner took the slot) ────────────
  IF v_existing_quote.id IS NULL THEN
    SELECT * INTO v_existing_quote
    FROM public.quotes
    WHERE student_id    = v_uid
      AND idempotency_key = NULLIF(TRIM(p_idempotency_key), '');

    IF NOT FOUND THEN
      RAISE EXCEPTION 'QUOTE_CONCURRENT_CONFLICT_UNRESOLVABLE' USING ERRCODE = '40001';
    END IF;

    IF v_existing_quote.offering_id <> p_offering_id
       OR v_existing_quote.scheduled_start_at <> p_scheduled_start_at
    THEN
      RAISE EXCEPTION 'QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'
        USING ERRCODE = '23505';
    END IF;

    IF v_existing_quote.status = 'ACTIVE' AND v_existing_quote.expires_at > v_now THEN
      RETURN jsonb_build_object(
        'success',               true,
        'is_idempotent',         true,
        'quote_id',              v_existing_quote.id,
        'student_id',            v_existing_quote.student_id,
        'provider_id',           v_existing_quote.provider_id,
        'instructor_id',         v_existing_quote.instructor_id,
        'vehicle_id',            v_existing_quote.vehicle_id,
        'offering_id',           v_existing_quote.offering_id,
        'scheduled_start_at',    v_existing_quote.scheduled_start_at,
        'scheduled_end_at',      v_existing_quote.scheduled_end_at,
        'price_in_cents',        v_existing_quote.price_in_cents,
        'platform_fee_in_cents', v_existing_quote.platform_fee_in_cents,
        'total_in_cents',        v_existing_quote.total_in_cents,
        'status',                v_existing_quote.status,
        'expires_at',            v_existing_quote.expires_at
      );
    ELSE
      RAISE EXCEPTION 'QUOTE_IDEMPOTENCY_KEY_STALE' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- ── 11. New Insert Branch: Return fresh quote with all required fields ─────
  RETURN jsonb_build_object(
    'success',               true,
    'is_idempotent',         false,
    'quote_id',              v_existing_quote.id,
    'student_id',            v_existing_quote.student_id,
    'provider_id',           v_existing_quote.provider_id,
    'instructor_id',         v_existing_quote.instructor_id,
    'vehicle_id',            v_existing_quote.vehicle_id,
    'offering_id',           v_existing_quote.offering_id,
    'scheduled_start_at',    v_existing_quote.scheduled_start_at,
    'scheduled_end_at',      v_existing_quote.scheduled_end_at,
    'price_in_cents',        v_existing_quote.price_in_cents,
    'platform_fee_in_cents', v_existing_quote.platform_fee_in_cents,
    'total_in_cents',        v_existing_quote.total_in_cents,
    'status',                v_existing_quote.status,
    'expires_at',            v_existing_quote.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_quote_from_offering(UUID, TIMESTAMPTZ, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_quote_from_offering(UUID, TIMESTAMPTZ, VARCHAR) TO authenticated;
