-- MAZZI — PRO EARNINGS & PERFORMANCE
-- Dedicated financial contract for the PRO "Ganhos" experience.
-- Monetary values are integer cents. The database is the source of truth.

CREATE OR REPLACE FUNCTION public.get_provider_earnings_summary(
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
  v_now TIMESTAMPTZ := NOW();
  v_period_length INTERVAL;
  v_result JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Usuário não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'USER_NOT_ACTIVE: Usuário não está ativo no sistema.' USING ERRCODE = '42501';
  END IF;

  IF p_date_from IS NULL OR p_date_to IS NULL OR p_date_to <= p_date_from THEN
    RAISE EXCEPTION 'INVALID_EARNINGS_PERIOD: Período de consulta inválido.' USING ERRCODE = '22023';
  END IF;

  v_period_length := p_date_to - p_date_from;
  IF v_period_length < INTERVAL '1 day' OR v_period_length > INTERVAL '366 days' THEN
    RAISE EXCEPTION 'INVALID_EARNINGS_PERIOD: O período deve estar entre 1 e 366 dias.' USING ERRCODE = '22023';
  END IF;

  WITH
  authorized_providers AS (
    SELECT DISTINCT p.id
    FROM public.providers p
    WHERE
      (
        p.type::TEXT = 'INSTRUCTOR'
        AND p.user_id = v_uid
        AND public.current_user_has_permission('provider.finance.read_own'::public.app_permission)
      )
      OR
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
  payout_base AS (
    SELECT
      po.id,
      po.booking_id,
      po.amount_in_cents,
      po.status::TEXT AS payout_status,
      po.scheduled_release_at,
      po.released_at,
      po.processed_at,
      po.updated_at,
      COALESCE(b.completed_at, b.lesson_finished_at, b.scheduled_end_at, po.created_at) AS earned_at,
      COALESCE(po.released_at, po.processed_at, po.updated_at) AS received_at
    FROM public.payouts po
    JOIN public.bookings b ON b.id = po.booking_id
    WHERE po.provider_id IN (SELECT id FROM authorized_providers)
      -- A refund/cancellation removes the economic gain from the PRO view.
      AND b.status::TEXT IN ('COMPLETED', 'DISPUTED')
  ),
  periods AS (
    SELECT 'current'::TEXT AS period_key, p_date_from AS period_from, p_date_to AS period_to
    UNION ALL
    SELECT 'previous'::TEXT, p_date_from - v_period_length, p_date_from
  ),
  period_metrics AS (
    SELECT
      periods.period_key,
      COUNT(DISTINCT pb.booking_id) AS lessons_completed,
      COALESCE(SUM(pb.amount_in_cents), 0)::BIGINT AS net_earned_cents,
      COALESCE(SUM(pb.amount_in_cents) FILTER (
        WHERE pb.payout_status = 'PAID'
          AND pb.received_at >= periods.period_from
          AND pb.received_at < periods.period_to
      ), 0)::BIGINT AS received_cents,
      COALESCE(SUM(pb.amount_in_cents) FILTER (WHERE pb.payout_status IN ('PENDING', 'AVAILABLE', 'PROCESSING')), 0)::BIGINT AS to_receive_cents,
      COALESCE(SUM(pb.amount_in_cents) FILTER (WHERE pb.payout_status = 'BLOCKED'), 0)::BIGINT AS blocked_cents,
      COALESCE(SUM(pb.amount_in_cents) FILTER (WHERE pb.payout_status = 'FAILED'), 0)::BIGINT AS failed_cents
    FROM periods
    LEFT JOIN payout_base pb
      ON pb.earned_at >= periods.period_from
     AND pb.earned_at < periods.period_to
    GROUP BY periods.period_key
  ),
  series_rows AS (
    SELECT
      periods.period_key,
      (business_day::DATE) AS business_date,
      COALESCE(SUM(pb.amount_in_cents), 0)::BIGINT AS net_earned_cents,
      COUNT(DISTINCT pb.booking_id)::INTEGER AS lessons_completed
    FROM periods
    CROSS JOIN LATERAL generate_series(
      (periods.period_from AT TIME ZONE 'America/Sao_Paulo')::DATE,
      ((periods.period_to - INTERVAL '1 microsecond') AT TIME ZONE 'America/Sao_Paulo')::DATE,
      INTERVAL '1 day'
    ) AS business_day
    LEFT JOIN payout_base pb
      ON (pb.earned_at AT TIME ZONE 'America/Sao_Paulo')::DATE = business_day::DATE
     AND pb.earned_at >= periods.period_from
     AND pb.earned_at < periods.period_to
    GROUP BY periods.period_key, business_day
  ),
  series_aggregates AS (
    SELECT
      period_key,
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'date', business_date,
          'net_earned_cents', net_earned_cents,
          'lessons_completed', lessons_completed
        ) ORDER BY business_date
      ) AS series
    FROM series_rows
    GROUP BY period_key
  ),
  upcoming_by_date AS (
    SELECT
      (po.scheduled_release_at AT TIME ZONE 'America/Sao_Paulo')::DATE AS release_date,
      SUM(po.amount_in_cents)::BIGINT AS amount_in_cents,
      COUNT(*)::INTEGER AS payout_count
    FROM payout_base po
    WHERE po.payout_status IN ('PENDING', 'AVAILABLE', 'PROCESSING')
      AND po.scheduled_release_at >= v_now
      AND po.scheduled_release_at < v_now + INTERVAL '7 days'
    GROUP BY (po.scheduled_release_at AT TIME ZONE 'America/Sao_Paulo')::DATE
  ),
  reviews_summary AS (
    SELECT
      COUNT(*)::INTEGER AS review_count,
      COUNT(DISTINCT r.student_id)::INTEGER AS distinct_students_count,
      ROUND(AVG(r.rating_overall)::NUMERIC, 2) AS rating_overall,
      ROUND(AVG(r.rating_didactics)::NUMERIC, 2) AS rating_didactics,
      ROUND(AVG(r.rating_punctuality)::NUMERIC, 2) AS rating_punctuality,
      ROUND(AVG(r.rating_safety)::NUMERIC, 2) AS rating_safety,
      ROUND(AVG(r.rating_vehicle)::NUMERIC, 2) AS rating_vehicle,
      ROUND(AVG(r.rating_cordiality)::NUMERIC, 2) AS rating_cordiality
    FROM public.reviews r
    WHERE r.provider_id IN (SELECT id FROM authorized_providers)
  )
  SELECT JSONB_BUILD_OBJECT(
    'period', JSONB_BUILD_OBJECT(
      'from', p_date_from,
      'to', p_date_to,
      'timezone', 'America/Sao_Paulo'
    ),
    'current', JSONB_BUILD_OBJECT(
      'net_earned_cents', COALESCE(cm.net_earned_cents, 0),
      'received_cents', COALESCE(cm.received_cents, 0),
      'to_receive_cents', COALESCE(cm.to_receive_cents, 0),
      'blocked_cents', COALESCE(cm.blocked_cents, 0),
      'failed_cents', COALESCE(cm.failed_cents, 0),
      'lessons_completed', COALESCE(cm.lessons_completed, 0),
      'average_ticket_cents', CASE
        WHEN COALESCE(cm.lessons_completed, 0) = 0 THEN NULL
        ELSE ROUND(cm.net_earned_cents::NUMERIC / cm.lessons_completed)::BIGINT
      END
    ),
    'previous', JSONB_BUILD_OBJECT(
      'net_earned_cents', COALESCE(pm.net_earned_cents, 0),
      'received_cents', COALESCE(pm.received_cents, 0),
      'to_receive_cents', COALESCE(pm.to_receive_cents, 0),
      'blocked_cents', COALESCE(pm.blocked_cents, 0),
      'failed_cents', COALESCE(pm.failed_cents, 0),
      'lessons_completed', COALESCE(pm.lessons_completed, 0),
      'average_ticket_cents', CASE
        WHEN COALESCE(pm.lessons_completed, 0) = 0 THEN NULL
        ELSE ROUND(pm.net_earned_cents::NUMERIC / pm.lessons_completed)::BIGINT
      END
    ),
    'series', COALESCE(cs.series, '[]'::JSONB),
    'upcoming_payouts', COALESCE((
      SELECT JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'date', release_date,
          'amount_in_cents', amount_in_cents,
          'payout_count', payout_count
        ) ORDER BY release_date
      )
      FROM upcoming_by_date
    ), '[]'::JSONB),
    'upcoming_total_cents', COALESCE((SELECT SUM(amount_in_cents)::BIGINT FROM upcoming_by_date), 0),
    'reviews', JSONB_BUILD_OBJECT(
      'review_count', COALESCE(rs.review_count, 0),
      'distinct_students_count', COALESCE(rs.distinct_students_count, 0),
      'rating_overall', rs.rating_overall,
      'dimensions', JSONB_BUILD_OBJECT(
        'didactics', rs.rating_didactics,
        'punctuality', rs.rating_punctuality,
        'safety', rs.rating_safety,
        'vehicle', rs.rating_vehicle,
        'cordiality', rs.rating_cordiality
      )
    ),
    'generated_at', v_now
  )
  INTO v_result
  FROM period_metrics cm
  JOIN period_metrics pm ON pm.period_key = 'previous'
  LEFT JOIN series_aggregates cs ON cs.period_key = 'current'
  CROSS JOIN reviews_summary rs
  WHERE cm.period_key = 'current';

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_provider_earnings_summary(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_provider_earnings_summary(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
