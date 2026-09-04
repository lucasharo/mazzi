-- TASK-089 — Keep Aula Agora state consistent after a payment-hold cancellation.
-- A cancelled booking must never leave the student's instant request looking
-- matched, otherwise the Student modal blocks the next search.

UPDATE public.instant_lesson_offers io
SET status = 'DECLINED', updated_at = NOW()
FROM public.instant_lesson_requests ilr
JOIN public.bookings b ON b.id = ilr.booking_id
WHERE io.request_id = ilr.id
  AND ilr.status = 'MATCHED'
  AND b.status IN ('CANCELLED_BY_STUDENT', 'CANCELLED_BY_PROVIDER', 'EXPIRED', 'PAYMENT_FAILED')
  AND io.status IN ('PENDING', 'ACCEPTED');

UPDATE public.instant_lesson_requests ilr
SET status = 'CANCELLED', updated_at = NOW()
FROM public.bookings b
WHERE b.id = ilr.booking_id
  AND ilr.status = 'MATCHED'
  AND b.status IN ('CANCELLED_BY_STUDENT', 'CANCELLED_BY_PROVIDER', 'EXPIRED', 'PAYMENT_FAILED');

CREATE OR REPLACE FUNCTION public.get_my_active_instant_request()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req RECORD;
  v_offer RECORD;
BEGIN
  SELECT * INTO v_req
  FROM public.instant_lesson_requests ilr
  WHERE ilr.student_id = auth.uid()
    AND (
      ilr.status = 'SEARCHING'
      OR (
        ilr.status = 'MATCHED'
        AND EXISTS (
          SELECT 1
          FROM public.bookings b
          WHERE b.id = ilr.booking_id
            AND b.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS')
        )
      )
    )
  ORDER BY ilr.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT io.*, p.trade_name AS provider_name, o.category::TEXT, v.transmission::TEXT, o.duration_minutes
  INTO v_offer
  FROM public.instant_lesson_offers io
  JOIN public.providers p ON p.id = io.provider_id
  JOIN public.service_offerings o ON o.id = io.offering_id
  JOIN public.vehicles v ON v.id = io.vehicle_id
  WHERE io.request_id = v_req.id
    AND io.status = 'ACCEPTED'
  LIMIT 1;

  RETURN jsonb_build_object(
    'id', v_req.id,
    'student_id', v_req.student_id,
    'meeting_point', v_req.meeting_point,
    'category', v_req.category,
    'transmission', v_req.transmission,
    'max_price_in_cents', v_req.max_price_in_cents,
    'status', v_req.status,
    'expires_at', v_req.expires_at,
    'matched_provider_id', v_req.matched_provider_id,
    'matched_offering_id', v_req.matched_offering_id,
    'booking_id', v_req.booking_id,
    'offer', CASE WHEN v_offer.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_offer.id,
      'request_id', v_offer.request_id,
      'provider_id', v_offer.provider_id,
      'offering_id', v_offer.offering_id,
      'instructor_id', v_offer.instructor_id,
      'vehicle_id', v_offer.vehicle_id,
      'provider_name', v_offer.provider_name,
      'category', v_offer.category,
      'transmission', v_offer.transmission,
      'duration_minutes', v_offer.duration_minutes,
      'offered_price_in_cents', v_offer.offered_price_in_cents,
      'distance_meters', v_offer.distance_meters,
      'eta_minutes', v_offer.eta_minutes,
      'status', v_offer.status,
      'expires_at', v_offer.expires_at,
      'created_at', v_offer.created_at
    ) END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_pending_booking(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_booking RECORD;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Usuário não autenticado.' USING ERRCODE = '40100';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF v_booking IS NULL THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND: Agendamento não encontrado.' USING ERRCODE = '40401';
  END IF;

  IF v_booking.student_id <> v_actor_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED_STUDENT: Este agendamento pertence a outro aluno.' USING ERRCODE = '40301';
  END IF;

  IF v_booking.status::TEXT <> 'PENDING_PAYMENT' THEN
    RAISE EXCEPTION 'BOOKING_NOT_PENDING_PAYMENT: A reserva não está aguardando pagamento.' USING ERRCODE = '42200';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.payments
    WHERE booking_id = p_booking_id
      AND status::TEXT = 'PAID'
  ) THEN
    RAISE EXCEPTION 'BOOKING_ALREADY_PAID: Esta reserva já possui pagamento confirmado.' USING ERRCODE = '42201';
  END IF;

  UPDATE public.bookings
  SET status = 'CANCELLED_BY_STUDENT'::public.booking_status,
      cancelled_at = NOW(),
      cancelled_by = 'STUDENT',
      cancellation_reason = 'Reserva cancelada antes do pagamento',
      refund_amount_in_cents = 0,
      updated_at = NOW()
  WHERE id = p_booking_id;

  UPDATE public.instant_lesson_offers io
  SET status = 'DECLINED', updated_at = NOW()
  FROM public.instant_lesson_requests ilr
  WHERE io.request_id = ilr.id
    AND ilr.booking_id = p_booking_id
    AND io.status IN ('PENDING', 'ACCEPTED');

  UPDATE public.instant_lesson_requests
  SET status = 'CANCELLED', updated_at = NOW()
  WHERE booking_id = p_booking_id
    AND status = 'MATCHED';

  INSERT INTO public.audit_logs (
    id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at, ip_address
  ) VALUES (
    gen_random_uuid(), v_actor_id, 'BOOKING_CANCELLED_BEFORE_PAYMENT', 'Booking', p_booking_id,
    jsonb_build_object('status', 'PENDING_PAYMENT'),
    jsonb_build_object('status', 'CANCELLED_BY_STUDENT', 'reason', 'Reserva cancelada antes do pagamento'),
    NOW(), NULL
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'booking_id', p_booking_id,
    'status', 'CANCELLED_BY_STUDENT',
    'cancelled_at', NOW()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_active_instant_request() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_active_instant_request() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_pending_booking(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_pending_booking(UUID) TO authenticated;
