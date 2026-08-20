-- ============================================================================
-- MAZZI PLATFORM — MIGRATION 56: CLOSE MVP RELEASE BLOCKERS
-- File: supabase/migrations/20260820000056_mvp_release_blockers_analytics_student_checkin.sql
-- ============================================================================
-- 1. HARDEN PROVIDER ANALYTICS ISOLATION (P0)
--    Removes booking assignment from finance authorization. Operational instructors
--    of driving school bookings NO LONGER receive financial/commercial analytics
--    for the school.

CREATE OR REPLACE FUNCTION public.get_provider_analytics_summary(
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID;
  v_result JSONB;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Usuário não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'USER_NOT_ACTIVE: Usuário não está ativo no sistema.' USING ERRCODE = '42501';
  END IF;

  IF p_date_from IS NULL OR p_date_to IS NULL OR p_date_to <= p_date_from THEN
    RAISE EXCEPTION 'INVALID_ANALYTICS_PERIOD: Período de consulta inválido.' USING ERRCODE = '22023';
  END IF;

  WITH
  authorized_providers AS (
    SELECT DISTINCT p.id
    FROM public.providers p
    WHERE
      -- Private autonomous provider: owner user_id AND provider.finance.read_own permission
      (
        p.user_id = v_uid
        AND p.type::TEXT = 'INSTRUCTOR'
        AND public.current_user_has_permission('provider.finance.read_own'::public.app_permission)
      )
      OR
      -- Driving school provider: active member/owner AND school.finance.read permission
      (
        p.type::TEXT = 'DRIVING_SCHOOL'
        AND public.current_user_has_permission('school.finance.read'::public.app_permission)
        AND (
          p.user_id = v_uid
          OR EXISTS (
            SELECT 1
            FROM public.driving_school_staff dss
            WHERE dss.school_id = p.id
              AND dss.user_id = v_uid
              AND dss.is_active IS TRUE
          )
        )
      )
  ),
  booking_metrics AS (
    SELECT
      COUNT(*) AS bookings_created,
      COUNT(*) FILTER (WHERE status::TEXT = 'CONFIRMED') AS bookings_confirmed,
      COUNT(*) FILTER (WHERE status::TEXT = 'COMPLETED') AS bookings_completed,
      COUNT(*) FILTER (WHERE status::TEXT IN ('CANCELLED_BY_STUDENT', 'CANCELLED_BY_PROVIDER')) AS bookings_cancelled,
      COUNT(*) FILTER (WHERE status::TEXT IN ('NO_SHOW_STUDENT', 'NO_SHOW_PROVIDER')) AS bookings_no_show,
      COUNT(*) FILTER (WHERE status::TEXT = 'CONFIRMED' AND scheduled_start_at >= NOW()) AS upcoming_bookings
    FROM public.bookings
    WHERE provider_id IN (SELECT id FROM authorized_providers)
      AND created_at >= p_date_from
      AND created_at < p_date_to
  ),
  payment_metrics AS (
    SELECT
      COUNT(*) FILTER (WHERE p.status::TEXT = 'PAID') AS payments_paid,
      COALESCE(SUM(p.amount_in_cents) FILTER (WHERE p.status::TEXT = 'PAID'), 0)::BIGINT AS paid_volume_cents,
      COALESCE(SUM(b.platform_fee_in_cents) FILTER (WHERE p.status::TEXT = 'PAID'), 0)::BIGINT AS platform_fee_volume_cents
    FROM public.payments p
    JOIN public.bookings b ON b.id = p.booking_id
    WHERE b.provider_id IN (SELECT id FROM authorized_providers)
      AND p.created_at >= p_date_from
      AND p.created_at < p_date_to
  )
  SELECT JSONB_BUILD_OBJECT(
    'period', JSONB_BUILD_OBJECT('from', p_date_from, 'to', p_date_to),
    'authorized_providers_count', (SELECT COUNT(*) FROM authorized_providers),
    'bookings', JSONB_BUILD_OBJECT(
      'created', COALESCE((SELECT bookings_created FROM booking_metrics), 0),
      'confirmed', COALESCE((SELECT bookings_confirmed FROM booking_metrics), 0),
      'completed', COALESCE((SELECT bookings_completed FROM booking_metrics), 0),
      'cancelled', COALESCE((SELECT bookings_cancelled FROM booking_metrics), 0),
      'no_show', COALESCE((SELECT bookings_no_show FROM booking_metrics), 0),
      'upcoming', COALESCE((SELECT upcoming_bookings FROM booking_metrics), 0)
    ),
    'financial', JSONB_BUILD_OBJECT(
      'payments_paid', COALESCE((SELECT payments_paid FROM payment_metrics), 0),
      'paid_volume_cents', COALESCE((SELECT paid_volume_cents FROM payment_metrics), 0),
      'platform_fee_volume_cents', COALESCE((SELECT platform_fee_volume_cents FROM payment_metrics), 0),
      'net_provider_volume_cents', COALESCE(
        (SELECT paid_volume_cents FROM payment_metrics) - (SELECT platform_fee_volume_cents FROM payment_metrics),
        0
      )
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_provider_analytics_summary(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_provider_analytics_summary(TIMESTAMPTZ, TIMESTAMPTZ) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_provider_analytics_summary(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;


-- ============================================================================
-- 2. CANONICAL STUDENT CHECK-IN RPC (P1)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.student_check_in_booking(
  p_booking_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID;
  v_booking RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_window_start TIMESTAMPTZ;
  v_window_end TIMESTAMPTZ;
BEGIN
  -- 1. Authentication Check
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED: Usuário não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'USER_NOT_ACTIVE: Usuário não está ativo no sistema.' USING ERRCODE = '42501';
  END IF;

  -- 2. Lock & Load Booking
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND: Agendamento não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Student Ownership Check
  IF v_booking.student_id <> v_uid THEN
    RAISE EXCEPTION 'UNAUTHORIZED_STUDENT: Acesso negado. Apenas o aluno titular pode realizar o check-in nesta aula.' USING ERRCODE = '42501';
  END IF;

  -- 4. Status Whitelist Check
  IF v_booking.status::TEXT <> 'CONFIRMED' THEN
    IF v_booking.checkin_student_at IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'is_idempotent', true,
        'booking_id', p_booking_id,
        'checkin_student_at', v_booking.checkin_student_at,
        'message', 'Check-in do aluno já realizado anteriormente.'
      );
    ELSE
      RAISE EXCEPTION 'INVALID_STATUS: O check-in só é permitido para agendamentos confirmados (CONFIRMED).' USING ERRCODE = '42200';
    END IF;
  END IF;

  -- Idempotency check if already checked in
  IF v_booking.checkin_student_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_idempotent', true,
      'booking_id', p_booking_id,
      'checkin_student_at', v_booking.checkin_student_at,
      'message', 'Check-in do aluno já realizado anteriormente.'
    );
  END IF;

  -- 5. Operational Window Check (Opens: start - 30min, Closes: end + 60min)
  v_window_start := v_booking.scheduled_start_at - INTERVAL '30 minutes';
  v_window_end := v_booking.scheduled_end_at + INTERVAL '60 minutes';

  IF v_now < v_window_start THEN
    RAISE EXCEPTION 'CHECKIN_WINDOW_NOT_OPEN: O check-in só fica disponível 30 minutos antes do início da aula.' USING ERRCODE = '42204';
  END IF;

  IF v_now > v_window_end THEN
    RAISE EXCEPTION 'CHECKIN_WINDOW_EXPIRED: A janela de check-in para esta aula expirou.' USING ERRCODE = '42204';
  END IF;

  -- 6. Apply Atomic Update
  UPDATE public.bookings
  SET checkin_student_at = v_now,
      updated_at = v_now
  WHERE id = p_booking_id;

  -- 7. Audit Log
  INSERT INTO public.audit_logs (
    id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at
  ) VALUES (
    gen_random_uuid(),
    v_uid,
    'STUDENT_CHECKIN_BOOKING',
    'Booking',
    p_booking_id,
    jsonb_build_object('checkin_student_at', v_booking.checkin_student_at),
    jsonb_build_object('checkin_student_at', v_now),
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'is_idempotent', false,
    'booking_id', p_booking_id,
    'checkin_student_at', v_now,
    'message', 'Check-in do aluno realizado com sucesso.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.student_check_in_booking(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.student_check_in_booking(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.student_check_in_booking(UUID) TO authenticated, service_role;


-- ============================================================================
-- 3. ALIGN QUOTE TTL TO 10 MINUTES (P2)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_quote_from_offering(
  p_offering_id        UUID,
  p_scheduled_start_at TIMESTAMPTZ,
  p_idempotency_key    VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid                UUID         := auth.uid();
  v_offering           public.service_offerings%ROWTYPE;
  v_provider           public.providers%ROWTYPE;
  v_existing_quote     public.quotes%ROWTYPE;
  v_scheduled_end_at   TIMESTAMPTZ;
  v_now                TIMESTAMPTZ  := NOW();
  v_expires_at         TIMESTAMPTZ;
  v_ttl_minutes        INT          := 10;
  v_platform_fee_cents INT          := 1000;
  v_new_quote_id       UUID;
BEGIN
  -- ── 1. Authentication ─────────────────────────────────────────────────────
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;

  -- ── 2. WRITE PATH HOUSEKEEPING ────────────────────────────────────────────
  UPDATE public.bookings
  SET status = 'EXPIRED', expired_at = v_now, updated_at = v_now
  WHERE status = 'PENDING_PAYMENT' AND hold_expires_at <= v_now;

  -- ── 3. FAST PATH Idempotency Check ────────────────────────────────────────
  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing_quote
    FROM public.quotes
    WHERE idempotency_key = TRIM(p_idempotency_key)
      AND student_id = v_uid
    LIMIT 1;

    IF FOUND THEN
      -- Defense: Reject Category A even on fast-path idempotent retry
      SELECT * INTO v_offering FROM public.service_offerings WHERE id = v_existing_quote.offering_id;
      IF v_offering.category::TEXT <> 'B' THEN
        RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY: Only category B is supported for quotes' USING ERRCODE = '22023';
      END IF;

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
        RAISE EXCEPTION 'QUOTE_IDEMPOTENCY_KEY_STALE' USING ERRCODE = '22023';
      END IF;
    END IF;
  END IF;

  -- ── 4. Offering Validation ─────────────────────────────────────────────────
  SELECT * INTO v_offering FROM public.service_offerings WHERE id = p_offering_id;
  IF NOT FOUND OR v_offering.status <> 'ACTIVE' OR v_offering.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'OFFERING_NOT_FOUND_OR_INACTIVE' USING ERRCODE = '22023';
  END IF;

  IF v_offering.category::TEXT <> 'B' THEN
    RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY: Only category B is supported for quotes' USING ERRCODE = '22023';
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

  -- ── 7. Slot Availability ──────────────────────────────────────────────────
  IF NOT public.is_offering_slot_available(p_offering_id, p_scheduled_start_at) THEN
    RAISE EXCEPTION 'SELECTED_SLOT_NOT_AVAILABLE' USING ERRCODE = '22023';
  END IF;

  -- ── 8. Compute Values ─────────────────────────────────────────────────────
  v_scheduled_end_at := p_scheduled_start_at + MAKE_INTERVAL(mins => v_offering.duration_minutes);
  v_expires_at       := v_now + MAKE_INTERVAL(mins => v_ttl_minutes);
  v_new_quote_id     := gen_random_uuid();

  -- ── 9. ATOMIC Idempotent INSERT (TOCTOU-safe) ─────────────────────────────
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

  -- ── 10. Conflict Branch ───────────────────────────────────────────────────
  IF v_existing_quote.id IS NULL THEN
    SELECT * INTO v_existing_quote
    FROM public.quotes
    WHERE student_id      = v_uid
      AND idempotency_key = NULLIF(TRIM(p_idempotency_key), '');

    IF NOT FOUND THEN
      RAISE EXCEPTION 'QUOTE_CONCURRENT_CONFLICT_UNRESOLVABLE' USING ERRCODE = '40001';
    END IF;

    -- Defense: Reject Category A even on conflict resolution branch
    SELECT * INTO v_offering FROM public.service_offerings WHERE id = v_existing_quote.offering_id;
    IF v_offering.category::TEXT <> 'B' THEN
      RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY: Only category B is supported for quotes' USING ERRCODE = '22023';
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
REVOKE ALL ON FUNCTION public.create_quote_from_offering(UUID, TIMESTAMPTZ, VARCHAR) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_quote_from_offering(UUID, TIMESTAMPTZ, VARCHAR) TO authenticated, service_role;
