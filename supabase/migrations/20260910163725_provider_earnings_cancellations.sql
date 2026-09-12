-- MAZZI — ganhos do PRO em cancelamentos com valor devido
-- Um cancelamento pago pelo aluno pode deixar uma compensação financeira para
-- o PRO. Esse valor precisa ter o mesmo registro canônico de um payout normal.

CREATE OR REPLACE FUNCTION public.ensure_booking_payout(p_booking_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_account public.provider_payment_accounts%ROWTYPE;
  v_gateway_fee INTEGER;
  v_refund_amount INTEGER;
  v_amount INTEGER;
  v_release_at TIMESTAMPTZ;
  v_payout_id UUID;
  v_has_dispute BOOLEAN;
BEGIN
  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND OR v_booking.status::TEXT NOT IN (
    'COMPLETED', 'DISPUTED', 'CANCELLED_BY_STUDENT',
    'CANCELLED_BY_PROVIDER', 'PARTIALLY_REFUNDED', 'REFUNDED'
  ) THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE booking_id = p_booking_id
    AND status = 'PAID'
  ORDER BY paid_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_account
  FROM public.provider_payment_accounts
  WHERE provider_id = v_booking.provider_id
    AND gateway = 'STRIPE'
  ORDER BY updated_at DESC
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1
    FROM public.booking_disputes
    WHERE booking_id = p_booking_id
      AND status IN ('OPEN', 'AWAITING_RESPONSE', 'UNDER_REVIEW')
  ) INTO v_has_dispute;

  -- A resolved dispute is the authoritative source for its refund. For the
  -- commercial cancellation flow, bookings.refund_amount_in_cents is used.
  SELECT COALESCE(
    (
      SELECT d.refund_amount_in_cents
      FROM public.booking_disputes d
      WHERE d.booking_id = p_booking_id
      ORDER BY d.resolved_at DESC NULLS LAST, d.created_at DESC
      LIMIT 1
    ),
    COALESCE(v_booking.refund_amount_in_cents, 0)
  )::INTEGER INTO v_refund_amount;

  v_gateway_fee := GREATEST(0, COALESCE(v_payment.gateway_fee_in_cents, 0));
  v_amount := GREATEST(
    0,
    v_booking.total_in_cents
      - GREATEST(0, LEAST(v_booking.total_in_cents, v_refund_amount))
      - v_booking.platform_fee_in_cents
      - v_gateway_fee
  );
  v_release_at := COALESCE(
    v_booking.completed_at,
    v_booking.lesson_finished_at,
    v_booking.cancelled_at,
    v_booking.updated_at
  ) + make_interval(hours => public.get_payout_safety_period_hours());

  -- Full refund means no amount is owed to the PRO. Do not create a new zero
  -- payout, but neutralize an unpaid legacy row if one already exists.
  IF v_amount <= 0 THEN
    UPDATE public.payouts
    SET amount_in_cents = 0,
        status = CASE WHEN status IN ('PAID', 'PROCESSING') THEN status ELSE 'BLOCKED'::public.payout_status END,
        failure_reason = COALESCE(failure_reason, 'NO_PROVIDER_AMOUNT_DUE'),
        updated_at = NOW()
    WHERE booking_id = p_booking_id
      AND status NOT IN ('PAID', 'PROCESSING')
    RETURNING id INTO v_payout_id;
    RETURN v_payout_id;
  END IF;

  INSERT INTO public.payouts (
    provider_id, booking_id, amount_in_cents, status, scheduled_release_at,
    idempotency_key, gross_amount_in_cents, platform_fee_in_cents,
    gateway_fee_in_cents, gateway_fee_source, transfer_method,
    destination_key_type, destination_key, destination_key_masked,
    updated_at
  ) VALUES (
    v_booking.provider_id,
    p_booking_id,
    v_amount,
    CASE
      WHEN v_has_dispute THEN 'BLOCKED'::public.payout_status
      WHEN v_account.id IS NULL
        OR v_account.status <> 'ACTIVE'
        OR NOT v_account.payouts_enabled
        THEN 'BLOCKED'::public.payout_status
      ELSE 'PENDING'::public.payout_status
    END,
    v_release_at,
    'stripe-transfer:' || p_booking_id,
    v_booking.total_in_cents - GREATEST(0, LEAST(v_booking.total_in_cents, v_refund_amount)),
    v_booking.platform_fee_in_cents,
    v_gateway_fee,
    CASE WHEN v_payment.gateway_fee_in_cents IS NULL THEN 'CONFIGURED_ESTIMATE' ELSE 'GATEWAY_RESPONSE' END,
    'STRIPE_CONNECT',
    'STRIPE_ACCOUNT',
    NULLIF(v_account.external_account_id, ''),
    CASE WHEN NULLIF(v_account.external_account_id, '') IS NULL THEN NULL
      ELSE 'acct_…' || right(v_account.external_account_id, 6) END,
    NOW()
  ) ON CONFLICT (booking_id) DO UPDATE SET
    amount_in_cents = EXCLUDED.amount_in_cents,
    scheduled_release_at = EXCLUDED.scheduled_release_at,
    status = CASE
      WHEN public.payouts.status IN ('PAID', 'PROCESSING') THEN public.payouts.status
      ELSE EXCLUDED.status
    END,
    gross_amount_in_cents = EXCLUDED.gross_amount_in_cents,
    platform_fee_in_cents = EXCLUDED.platform_fee_in_cents,
    gateway_fee_in_cents = EXCLUDED.gateway_fee_in_cents,
    gateway_fee_source = EXCLUDED.gateway_fee_source,
    destination_key = EXCLUDED.destination_key,
    destination_key_masked = EXCLUDED.destination_key_masked,
    transfer_method = EXCLUDED.transfer_method,
    updated_at = NOW()
  RETURNING id INTO v_payout_id;

  RETURN v_payout_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_booking_payout(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_booking_payout(UUID) TO service_role, postgres;

CREATE OR REPLACE FUNCTION public.create_payout_after_eligible_booking_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF NEW.status::TEXT IN (
    'COMPLETED', 'DISPUTED', 'CANCELLED_BY_STUDENT',
    'CANCELLED_BY_PROVIDER', 'PARTIALLY_REFUNDED', 'REFUNDED'
  ) AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.ensure_booking_payout(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_payout_after_eligible_booking_status() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS create_payout_after_lesson_completion ON public.bookings;
DROP TRIGGER IF EXISTS create_payout_after_eligible_booking_status ON public.bookings;
CREATE TRIGGER create_payout_after_eligible_booking_status
AFTER UPDATE OF status ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.create_payout_after_eligible_booking_status();

-- Backfill paid historical cancellations/dispute rows without changing any
-- already PAID or PROCESSING payout amount.
SELECT public.ensure_booking_payout(id)
FROM public.bookings
WHERE status::TEXT IN (
  'COMPLETED', 'DISPUTED', 'CANCELLED_BY_STUDENT',
  'CANCELLED_BY_PROVIDER', 'PARTIALLY_REFUNDED', 'REFUNDED'
);

-- Earnings must include every payout with a positive provider amount. The
-- booking status is retained as a guard so unpaid future confirmations do not
-- enter the financial view.
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

  WITH authorized_providers AS (
    SELECT DISTINCT p.id
    FROM public.providers p
    WHERE (p.type::TEXT = 'INSTRUCTOR' AND p.user_id = v_uid
      AND public.current_user_has_permission('provider.finance.read_own'::public.app_permission))
       OR (p.type::TEXT = 'DRIVING_SCHOOL'
      AND public.current_user_has_permission('school.finance.read'::public.app_permission)
      AND (p.user_id = v_uid OR EXISTS (
        SELECT 1 FROM public.driving_school_staff dss
        WHERE dss.school_id = p.id AND dss.user_id = v_uid AND dss.is_active IS TRUE
      )))
  ),
  payout_base AS (
    SELECT po.id, po.booking_id, po.amount_in_cents, po.status::TEXT AS payout_status,
      po.scheduled_release_at, po.released_at, po.processed_at, po.updated_at,
      b.status::TEXT AS booking_status,
      COALESCE(b.completed_at, b.lesson_finished_at, b.cancelled_at, b.scheduled_end_at, po.created_at) AS earned_at,
      COALESCE(po.released_at, po.processed_at, po.updated_at) AS received_at
    FROM public.payouts po
    JOIN public.bookings b ON b.id = po.booking_id
    WHERE po.provider_id IN (SELECT id FROM authorized_providers)
      AND po.amount_in_cents > 0
      AND b.status::TEXT IN (
        'COMPLETED', 'DISPUTED', 'CANCELLED_BY_STUDENT',
        'CANCELLED_BY_PROVIDER', 'PARTIALLY_REFUNDED', 'REFUNDED'
      )
  ),
  periods AS (
    SELECT 'current'::TEXT AS period_key, p_date_from AS period_from, p_date_to AS period_to
    UNION ALL SELECT 'previous'::TEXT, p_date_from - v_period_length, p_date_from
  ),
  period_metrics AS (
    SELECT periods.period_key,
      COUNT(DISTINCT pb.booking_id) FILTER (WHERE pb.booking_status = 'COMPLETED') AS lessons_completed,
      COUNT(DISTINCT pb.booking_id) AS lessons_with_earnings,
      COALESCE(SUM(pb.amount_in_cents), 0)::BIGINT AS net_earned_cents,
      COALESCE(SUM(pb.amount_in_cents) FILTER (WHERE pb.payout_status = 'PAID'
        AND pb.received_at >= periods.period_from AND pb.received_at < periods.period_to), 0)::BIGINT AS received_cents,
      COALESCE(SUM(pb.amount_in_cents) FILTER (WHERE pb.payout_status IN ('PENDING','AVAILABLE','PROCESSING')), 0)::BIGINT AS to_receive_cents,
      COALESCE(SUM(pb.amount_in_cents) FILTER (WHERE pb.payout_status = 'BLOCKED'), 0)::BIGINT AS blocked_cents,
      COALESCE(SUM(pb.amount_in_cents) FILTER (WHERE pb.payout_status = 'FAILED'), 0)::BIGINT AS failed_cents
    FROM periods
    LEFT JOIN payout_base pb ON pb.earned_at >= periods.period_from AND pb.earned_at < periods.period_to
    GROUP BY periods.period_key
  ),
  series_rows AS (
    SELECT periods.period_key, business_day::DATE AS business_date,
      COALESCE(SUM(pb.amount_in_cents), 0)::BIGINT AS net_earned_cents,
      COUNT(DISTINCT pb.booking_id) FILTER (WHERE pb.booking_status = 'COMPLETED')::INTEGER AS lessons_completed,
      COUNT(DISTINCT pb.booking_id)::INTEGER AS lessons_with_earnings
    FROM periods
    CROSS JOIN LATERAL generate_series(
      (periods.period_from AT TIME ZONE 'America/Sao_Paulo')::DATE,
      ((periods.period_to - INTERVAL '1 microsecond') AT TIME ZONE 'America/Sao_Paulo')::DATE,
      INTERVAL '1 day'
    ) AS business_day
    LEFT JOIN payout_base pb ON (pb.earned_at AT TIME ZONE 'America/Sao_Paulo')::DATE = business_day::DATE
      AND pb.earned_at >= periods.period_from AND pb.earned_at < periods.period_to
    GROUP BY periods.period_key, business_day
  ),
  series_aggregates AS (
    SELECT period_key, JSONB_AGG(JSONB_BUILD_OBJECT(
      'date', business_date,
      'net_earned_cents', net_earned_cents,
      'lessons_completed', lessons_completed,
      'lessons_with_earnings', lessons_with_earnings
    ) ORDER BY business_date) AS series
    FROM series_rows GROUP BY period_key
  ),
  upcoming_by_date AS (
    SELECT (po.scheduled_release_at AT TIME ZONE 'America/Sao_Paulo')::DATE AS release_date,
      SUM(po.amount_in_cents)::BIGINT AS amount_in_cents, COUNT(*)::INTEGER AS payout_count
    FROM payout_base po
    WHERE po.payout_status IN ('PENDING','AVAILABLE','PROCESSING')
      AND po.scheduled_release_at >= v_now AND po.scheduled_release_at < v_now + INTERVAL '7 days'
    GROUP BY (po.scheduled_release_at AT TIME ZONE 'America/Sao_Paulo')::DATE
  ),
  reviews_summary AS (
    SELECT COUNT(*)::INTEGER AS review_count, COUNT(DISTINCT r.student_id)::INTEGER AS distinct_students_count,
      ROUND(AVG(r.rating_overall)::NUMERIC, 2) AS rating_overall,
      ROUND(AVG(r.rating_didactics)::NUMERIC, 2) AS rating_didactics,
      ROUND(AVG(r.rating_punctuality)::NUMERIC, 2) AS rating_punctuality,
      ROUND(AVG(r.rating_safety)::NUMERIC, 2) AS rating_safety,
      ROUND(AVG(r.rating_vehicle)::NUMERIC, 2) AS rating_vehicle,
      ROUND(AVG(r.rating_cordiality)::NUMERIC, 2) AS rating_cordiality
    FROM public.reviews r WHERE r.provider_id IN (SELECT id FROM authorized_providers)
  )
  SELECT JSONB_BUILD_OBJECT(
    'period', JSONB_BUILD_OBJECT('from', p_date_from, 'to', p_date_to, 'timezone', 'America/Sao_Paulo'),
    'current', JSONB_BUILD_OBJECT(
      'net_earned_cents', COALESCE(cm.net_earned_cents, 0), 'received_cents', COALESCE(cm.received_cents, 0),
      'to_receive_cents', COALESCE(cm.to_receive_cents, 0), 'blocked_cents', COALESCE(cm.blocked_cents, 0),
      'failed_cents', COALESCE(cm.failed_cents, 0), 'lessons_completed', COALESCE(cm.lessons_completed, 0),
      'lessons_with_earnings', COALESCE(cm.lessons_with_earnings, 0),
      'average_ticket_cents', CASE WHEN COALESCE(cm.lessons_with_earnings, 0) = 0 THEN NULL
        ELSE ROUND(cm.net_earned_cents::NUMERIC / cm.lessons_with_earnings)::BIGINT END
    ),
    'previous', JSONB_BUILD_OBJECT(
      'net_earned_cents', COALESCE(pm.net_earned_cents, 0), 'received_cents', COALESCE(pm.received_cents, 0),
      'to_receive_cents', COALESCE(pm.to_receive_cents, 0), 'blocked_cents', COALESCE(pm.blocked_cents, 0),
      'failed_cents', COALESCE(pm.failed_cents, 0), 'lessons_completed', COALESCE(pm.lessons_completed, 0),
      'lessons_with_earnings', COALESCE(pm.lessons_with_earnings, 0),
      'average_ticket_cents', CASE WHEN COALESCE(pm.lessons_with_earnings, 0) = 0 THEN NULL
        ELSE ROUND(pm.net_earned_cents::NUMERIC / pm.lessons_with_earnings)::BIGINT END
    ),
    'series', COALESCE(cs.series, '[]'::JSONB),
    'upcoming_payouts', COALESCE((SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
      'date', release_date, 'amount_in_cents', amount_in_cents, 'payout_count', payout_count
    ) ORDER BY release_date) FROM upcoming_by_date), '[]'::JSONB),
    'upcoming_total_cents', COALESCE((SELECT SUM(amount_in_cents)::BIGINT FROM upcoming_by_date), 0),
    'reviews', JSONB_BUILD_OBJECT(
      'review_count', COALESCE(rs.review_count, 0), 'distinct_students_count', COALESCE(rs.distinct_students_count, 0),
      'rating_overall', rs.rating_overall,
      'dimensions', JSONB_BUILD_OBJECT('didactics', rs.rating_didactics, 'punctuality', rs.rating_punctuality,
        'safety', rs.rating_safety, 'vehicle', rs.rating_vehicle, 'cordiality', rs.rating_cordiality)
    ),
    'generated_at', v_now
  ) INTO v_result
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

-- Expose the canonical payout state alongside provider bookings so the lesson
-- detail can show the amount without reading payouts directly from the client.
CREATE OR REPLACE FUNCTION public.get_my_provider_bookings(p_provider_id UUID)
RETURNS SETOF JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.providers p
    WHERE p.id = p_provider_id
      AND (
        p.user_id = v_uid
        OR EXISTS (
          SELECT 1 FROM public.driving_school_staff s
          WHERE s.school_id = p.id AND s.user_id = v_uid
            AND s.is_active AND s.membership_status = 'ACTIVE'
        )
        OR EXISTS (
          SELECT 1 FROM public.service_offerings o
          WHERE o.provider_id = p.id AND o.instructor_id = v_uid
        )
      )
  ) THEN
    RAISE EXCEPTION 'BOOKING_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT to_jsonb(b) || jsonb_build_object(
    'meeting_point', CASE
      WHEN b.status = 'PENDING_PAYMENT' AND b.snapshot_data->>'source' = 'AULA_AGORA' THEN
        jsonb_strip_nulls(jsonb_build_object(
          'type', 'REDACTED', 'label', 'Região do ponto de encontro',
          'neighborhood', b.meeting_point->>'neighborhood', 'city', b.meeting_point->>'city'
        ))
      WHEN b.meeting_point->>'type' = 'PROVIDER_ADDRESS' THEN
        jsonb_strip_nulls(COALESCE(b.meeting_point, '{}'::jsonb) || jsonb_build_object(
          'full_address', p.address->>'formatted', 'latitude', p.latitude, 'longitude', p.longitude
        ))
      ELSE b.meeting_point
    END,
    'snapshot_data', CASE
      WHEN b.status = 'PENDING_PAYMENT' AND b.snapshot_data->>'source' = 'AULA_AGORA' THEN
        (COALESCE(b.snapshot_data, '{}'::jsonb) - ARRAY['meetingPoint','meeting_point','fullMeetingPoint','latitude','longitude'])
        || jsonb_build_object('meetingPoint', jsonb_strip_nulls(jsonb_build_object(
          'type', 'REDACTED', 'label', 'Região do ponto de encontro',
          'neighborhood', b.meeting_point->>'neighborhood', 'city', b.meeting_point->>'city'
        )))
      ELSE b.snapshot_data
    END,
    'provider_payout', (
      SELECT jsonb_build_object(
        'id', po.id,
        'amount_in_cents', po.amount_in_cents,
        'status', po.status,
        'scheduled_release_at', po.scheduled_release_at,
        'released_at', po.released_at,
        'failure_reason', po.failure_reason
      )
      FROM public.payouts po
      WHERE po.booking_id = b.id
        AND po.provider_id = b.provider_id
      LIMIT 1
    )
  )
  FROM public.bookings b
  JOIN public.providers p ON p.id = b.provider_id
  WHERE b.provider_id = p_provider_id
  ORDER BY b.scheduled_start_at;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_provider_bookings(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_provider_bookings(UUID) TO authenticated;
