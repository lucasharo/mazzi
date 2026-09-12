-- ============================================================================
-- MAZZI — TASK-006: Fix quote idempotency race condition (TOCTOU)
-- ============================================================================
-- Replaces the TOCTOU SELECT → INSERT pattern with atomic
-- INSERT ... ON CONFLICT (student_id, idempotency_key) DO NOTHING RETURNING *
-- 
-- The unique index uq_quotes_student_idempotency already exists:
--   ON public.quotes (student_id, idempotency_key) WHERE idempotency_key IS NOT NULL
--
-- This migration ONLY replaces the function body. No schema changes.
-- ============================================================================

DROP FUNCTION IF EXISTS public.create_quote_from_offering(uuid, timestamptz, varchar);

CREATE OR REPLACE FUNCTION public.create_quote_from_offering(
  p_offering_id        uuid,
  p_scheduled_start_at timestamptz,
  p_idempotency_key    varchar
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid              uuid         := auth.uid();
  v_user             public.users%rowtype;
  v_offering         public.service_offerings%rowtype;
  v_provider         public.providers%rowtype;
  v_vehicle          public.vehicles%rowtype;
  v_instructor       public.users%rowtype;
  v_existing         public.quotes%rowtype;
  v_new_row          public.quotes%rowtype;
  v_fee_pct          numeric      := 10;
  v_expiration_minutes integer    := 10;
  v_price            integer;
  v_fee              integer;
  v_total            integer;
  v_end              timestamptz;
  v_expires          timestamptz;
  v_quote_id         uuid;
  v_now              timestamptz  := now();
BEGIN
  -- ── 1. Authentication ─────────────────────────────────────────────────────
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = v_uid;
  IF NOT FOUND OR v_user.status <> 'ACTIVE'::public.user_status THEN
    RAISE EXCEPTION 'ACTIVE_STUDENT_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF v_user.role <> 'STUDENT'::public.user_role THEN
    RAISE EXCEPTION 'STUDENT_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;

  -- ── 2. Basic parameter guards ─────────────────────────────────────────────
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'QUOTE_IDEMPOTENCY_KEY_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_scheduled_start_at IS NULL OR p_scheduled_start_at <= v_now THEN
    RAISE EXCEPTION 'QUOTE_START_MUST_BE_IN_FUTURE' USING ERRCODE = '22023';
  END IF;

  -- ── 2.5 Early Idempotency Check (Fast Path for Retries / Conflict Reuses) ──
  SELECT * INTO v_existing
  FROM public.quotes
  WHERE student_id = v_uid AND idempotency_key = p_idempotency_key
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.offering_id <> p_offering_id
       OR v_existing.scheduled_start_at <> p_scheduled_start_at
    THEN
      RAISE EXCEPTION 'QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'
        USING ERRCODE = '23505';
    END IF;

    RETURN jsonb_build_object(
      'success',              true,
      'is_idempotent',        true,
      'quote_id',             v_existing.id,
      'student_id',           v_existing.student_id,
      'provider_id',          v_existing.provider_id,
      'instructor_id',        v_existing.instructor_id,
      'vehicle_id',           v_existing.vehicle_id,
      'offering_id',          v_existing.offering_id,
      'scheduled_start_at',   v_existing.scheduled_start_at,
      'scheduled_end_at',     v_existing.scheduled_end_at,
      'price_in_cents',       v_existing.price_in_cents,
      'platform_fee_in_cents',v_existing.platform_fee_in_cents,
      'total_in_cents',       v_existing.total_in_cents,
      'expires_at',           v_existing.expires_at,
      'status',               v_existing.status
    );
  END IF;

  -- ── 3. Offering validation ────────────────────────────────────────────────
  SELECT * INTO v_offering FROM public.service_offerings WHERE id = p_offering_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OFFERING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_offering.status <> 'ACTIVE' OR v_offering.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'OFFERING_NOT_ACTIVE' USING ERRCODE = '22000';
  END IF;
  IF v_offering.instructor_id IS NULL THEN
    RAISE EXCEPTION 'OFFERING_INSTRUCTOR_NOT_ASSIGNED' USING ERRCODE = '22000';
  END IF;
  IF v_offering.vehicle_id IS NULL THEN
    RAISE EXCEPTION 'OFFERING_VEHICLE_NOT_ASSIGNED' USING ERRCODE = '22000';
  END IF;

  -- ── 4. Provider validation ────────────────────────────────────────────────
  SELECT * INTO v_provider FROM public.providers WHERE id = v_offering.provider_id;
  IF NOT FOUND OR v_provider.status <> 'ACTIVE'::public.provider_status THEN
    RAISE EXCEPTION 'PROVIDER_NOT_ACTIVE' USING ERRCODE = '22000';
  END IF;

  -- ── 5. Instructor validation ──────────────────────────────────────────────
  SELECT * INTO v_instructor FROM public.users WHERE id = v_offering.instructor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OFFERING_INSTRUCTOR_USER_NOT_FOUND' USING ERRCODE = '23503';
  END IF;
  IF v_instructor.status <> 'ACTIVE'::public.user_status THEN
    RAISE EXCEPTION 'OFFERING_INSTRUCTOR_NOT_ACTIVE' USING ERRCODE = '22000';
  END IF;

  -- ── 6. Vehicle validation ─────────────────────────────────────────────────
  SELECT * INTO v_vehicle
  FROM public.vehicles
  WHERE id = v_offering.vehicle_id AND provider_id = v_offering.provider_id;
  IF NOT FOUND
     OR v_vehicle.status <> 'ACTIVE'::public.vehicle_status
     OR v_vehicle.deleted_at IS NOT NULL
  THEN
    RAISE EXCEPTION 'OFFERING_VEHICLE_NOT_ACTIVE' USING ERRCODE = '22000';
  END IF;

  -- ── 7. Slot availability ──────────────────────────────────────────────────
  IF NOT public.is_offering_slot_available(p_offering_id, p_scheduled_start_at) THEN
    RAISE EXCEPTION 'SELECTED_SLOT_NOT_AVAILABLE' USING ERRCODE = '22000';
  END IF;

  -- ── 8. Platform fee & expiration config ───────────────────────────────────
  SELECT COALESCE((value->>'default_percentage')::numeric, 10)
  INTO v_fee_pct
  FROM public.platform_configurations
  WHERE key = 'platform_fees'
  LIMIT 1;
  v_fee_pct := COALESCE(v_fee_pct, 10);

  SELECT COALESCE((value->>'expiration_minutes')::integer, 10)
  INTO v_expiration_minutes
  FROM public.platform_configurations
  WHERE key = 'quote_settings'
  LIMIT 1;
  v_expiration_minutes := COALESCE(v_expiration_minutes, 10);

  -- ── 9. Price calculation ──────────────────────────────────────────────────
  v_price := v_offering.price_in_cents;
  IF v_price IS NULL OR v_price <= 0 THEN
    RAISE EXCEPTION 'OFFERING_PRICE_INVALID' USING ERRCODE = '22000';
  END IF;
  IF v_offering.duration_minutes IS NULL OR v_offering.duration_minutes <= 0 THEN
    RAISE EXCEPTION 'OFFERING_DURATION_INVALID' USING ERRCODE = '22000';
  END IF;

  v_fee     := ROUND(v_price * v_fee_pct / 100.0)::integer;
  v_total   := v_price + v_fee;
  v_end     := p_scheduled_start_at + make_interval(mins => v_offering.duration_minutes);
  v_expires := v_now + make_interval(mins => v_expiration_minutes);
  v_quote_id := gen_random_uuid();

  -- ── 10. ATOMIC idempotent INSERT ─────────────────────────────────────────
  --
  -- INSERT ... ON CONFLICT (student_id, idempotency_key) DO NOTHING RETURNING *
  -- If a concurrent transaction already inserted the same key, DO NOTHING
  -- returns zero rows.  We then SELECT the existing row and validate it.
  -- This eliminates the TOCTOU window entirely.
  --
  INSERT INTO public.quotes (
    id, student_id, provider_id, instructor_id, vehicle_id, offering_id,
    scheduled_start_at, scheduled_end_at, price_in_cents, platform_fee_in_cents,
    total_in_cents, expires_at, status, idempotency_key, created_at
  )
  VALUES (
    v_quote_id, v_uid, v_offering.provider_id, v_offering.instructor_id, v_offering.vehicle_id,
    v_offering.id, p_scheduled_start_at, v_end, v_price, v_fee, v_total,
    v_expires, 'ACTIVE'::public.quote_status, p_idempotency_key, v_now
  )
  ON CONFLICT (student_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL
  DO NOTHING
  RETURNING * INTO v_new_row;

  -- ── 11. Conflict branch: return existing quote ────────────────────────────
  IF v_new_row.id IS NULL THEN
    -- INSERT was suppressed by ON CONFLICT DO NOTHING → row already existed
    SELECT * INTO v_existing
    FROM public.quotes
    WHERE student_id = v_uid
      AND idempotency_key = p_idempotency_key;

    IF NOT FOUND THEN
      -- Edge case: row disappeared between INSERT and SELECT (e.g., deleted by admin)
      RAISE EXCEPTION 'QUOTE_CONCURRENT_CONFLICT_UNRESOLVABLE' USING ERRCODE = '40001';
    END IF;

    -- Validate this is the same logical request (not key reuse with different params)
    IF v_existing.offering_id <> p_offering_id
       OR v_existing.scheduled_start_at <> p_scheduled_start_at
    THEN
      RAISE EXCEPTION 'QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'
        USING ERRCODE = '23505';
    END IF;

    RETURN jsonb_build_object(
      'success',              true,
      'is_idempotent',        true,
      'quote_id',             v_existing.id,
      'student_id',           v_existing.student_id,
      'provider_id',          v_existing.provider_id,
      'instructor_id',        v_existing.instructor_id,
      'vehicle_id',           v_existing.vehicle_id,
      'offering_id',          v_existing.offering_id,
      'scheduled_start_at',   v_existing.scheduled_start_at,
      'scheduled_end_at',     v_existing.scheduled_end_at,
      'price_in_cents',       v_existing.price_in_cents,
      'platform_fee_in_cents',v_existing.platform_fee_in_cents,
      'total_in_cents',       v_existing.total_in_cents,
      'expires_at',           v_existing.expires_at,
      'status',               v_existing.status
    );
  END IF;

  -- ── 12. New insert branch: return fresh quote ─────────────────────────────
  RETURN jsonb_build_object(
    'success',              true,
    'is_idempotent',        false,
    'quote_id',             v_new_row.id,
    'student_id',           v_new_row.student_id,
    'provider_id',          v_new_row.provider_id,
    'instructor_id',        v_new_row.instructor_id,
    'vehicle_id',           v_new_row.vehicle_id,
    'offering_id',          v_new_row.offering_id,
    'scheduled_start_at',   v_new_row.scheduled_start_at,
    'scheduled_end_at',     v_new_row.scheduled_end_at,
    'price_in_cents',       v_new_row.price_in_cents,
    'platform_fee_in_cents',v_new_row.platform_fee_in_cents,
    'total_in_cents',       v_new_row.total_in_cents,
    'expires_at',           v_new_row.expires_at,
    'status',               v_new_row.status
  );
END;
$$;

-- ── Grants (preserve existing contract) ──────────────────────────────────────
REVOKE ALL ON FUNCTION public.create_quote_from_offering(uuid, timestamptz, varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_quote_from_offering(uuid, timestamptz, varchar) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_quote_from_offering(uuid, timestamptz, varchar) TO authenticated;
