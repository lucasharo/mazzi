-- Financial summary for amounts returned to students after cancellation/refund.
-- Values are sourced from the booking's canonical refund amount in cents.

CREATE OR REPLACE FUNCTION public.get_provider_refunded_canceled_summary(
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_period_length INTERVAL;
  v_current BIGINT;
  v_previous BIGINT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE = '42501';
  END IF;

  IF p_date_from IS NULL OR p_date_to IS NULL OR p_date_to <= p_date_from THEN
    RAISE EXCEPTION 'INVALID_EARNINGS_PERIOD' USING ERRCODE = '22023';
  END IF;

  v_period_length := p_date_to - p_date_from;

  WITH authorized_providers AS (
    SELECT DISTINCT p.id
    FROM public.providers p
    WHERE (
      p.type::TEXT = 'INSTRUCTOR'
      AND p.user_id = v_uid
      AND public.current_user_has_permission('provider.finance.read_own'::public.app_permission)
    ) OR (
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
  )
  SELECT COALESCE(SUM(GREATEST(b.refund_amount_in_cents, 0)), 0)::BIGINT
  INTO v_current
  FROM public.bookings b
  WHERE b.provider_id IN (SELECT id FROM authorized_providers)
    AND b.status::TEXT IN (
      'CANCELLED_BY_STUDENT', 'CANCELLED_BY_PROVIDER', 'NO_SHOW_STUDENT',
      'NO_SHOW_PROVIDER', 'REFUNDED', 'PARTIALLY_REFUNDED', 'EXPIRED'
    )
    AND b.updated_at >= p_date_from
    AND b.updated_at < p_date_to;

  WITH authorized_providers AS (
    SELECT DISTINCT p.id
    FROM public.providers p
    WHERE (
      p.type::TEXT = 'INSTRUCTOR'
      AND p.user_id = v_uid
      AND public.current_user_has_permission('provider.finance.read_own'::public.app_permission)
    ) OR (
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
  )
  SELECT COALESCE(SUM(GREATEST(b.refund_amount_in_cents, 0)), 0)::BIGINT
  INTO v_previous
  FROM public.bookings b
  WHERE b.provider_id IN (SELECT id FROM authorized_providers)
    AND b.status::TEXT IN (
      'CANCELLED_BY_STUDENT', 'CANCELLED_BY_PROVIDER', 'NO_SHOW_STUDENT',
      'NO_SHOW_PROVIDER', 'REFUNDED', 'PARTIALLY_REFUNDED', 'EXPIRED'
    )
    AND b.updated_at >= p_date_from - v_period_length
    AND b.updated_at < p_date_from;

  RETURN jsonb_build_object(
    'current', jsonb_build_object('refunded_canceled_cents', v_current),
    'previous', jsonb_build_object('refunded_canceled_cents', v_previous)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_provider_refunded_canceled_summary(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_provider_refunded_canceled_summary(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
