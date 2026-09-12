-- MAZZI — Aula Agora — cancelamento do aluno com pagamento Stripe
-- O aluno não chama o Stripe nem grava um estorno diretamente. A Edge
-- Function autenticada reserva a operação, confirma o gateway e só então
-- finaliza esta transação com service_role.
-- REQUIRES_REGULATORY_VALIDATION before any commercial activation.

BEGIN;

CREATE OR REPLACE FUNCTION public.prepare_instant_booking_cancellation(
  p_booking_id uuid,
  p_reason text DEFAULT NULL,
  p_reason_code text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_booking record;
  v_payment record;
  v_existing public.refunds%rowtype;
  v_calc record;
  v_on_way_at timestamptz;
  v_key text;
  v_reason text;
  v_external_payment_id text;
  v_refund_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;
  PERFORM public.lock_student_profile(v_uid);
  PERFORM public.assert_current_user_student();

  SELECT b.*, so.source AS offering_source
    INTO v_booking
    FROM public.bookings b
    JOIN public.service_offerings so ON so.id = b.offering_id
   WHERE b.id = p_booking_id
   FOR UPDATE OF b;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_booking.offering_source <> 'AULA_AGORA' THEN
    RAISE EXCEPTION 'INSTANT_BOOKING_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF v_booking.student_id <> v_uid THEN
    RAISE EXCEPTION 'UNAUTHORIZED_STUDENT' USING ERRCODE = '42501';
  END IF;
  IF v_booking.status::text = 'IN_PROGRESS' OR v_booking.lesson_started_at IS NOT NULL THEN
    RAISE EXCEPTION 'INSTANT_CANCELLATION_STARTED' USING ERRCODE = '42204';
  END IF;
  IF v_booking.status::text <> 'CONFIRMED' THEN
    RAISE EXCEPTION 'INSTANT_CANCELLATION_STATUS_INVALID' USING ERRCODE = '42200';
  END IF;

  SELECT * INTO v_payment
    FROM public.payments
   WHERE booking_id = p_booking_id
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;
  IF NOT FOUND OR v_payment.status::text <> 'PAID' THEN
    RAISE EXCEPTION 'PAYMENT_NOT_CONFIRMED' USING ERRCODE = '42201';
  END IF;
  IF lower(coalesce(v_payment.gateway_provider, '')) NOT LIKE 'stripe%' THEN
    RAISE EXCEPTION 'STRIPE_CANCELLATION_GATEWAY_REQUIRED' USING ERRCODE = '42203';
  END IF;

  v_external_payment_id := coalesce(
    nullif(v_payment.external_transaction_id, ''),
    nullif(v_payment.metadata->>'stripe_payment_intent_id', '')
  );
  IF v_external_payment_id IS NULL OR v_external_payment_id !~ '^pi_[A-Za-z0-9]+$' THEN
    RAISE EXCEPTION 'STRIPE_PAYMENT_INTENT_REQUIRED' USING ERRCODE = '42203';
  END IF;

  v_key := coalesce(nullif(btrim(p_idempotency_key), ''), 'instant_cancel:' || p_booking_id::text || ':' || v_uid::text);
  v_reason := coalesce(nullif(btrim(p_reason), ''), nullif(btrim(p_reason_code), ''), 'Cancelamento Aula Agora');
  SELECT * INTO v_existing
    FROM public.refunds
   WHERE idempotency_key = v_key
   FOR UPDATE;
  IF FOUND THEN
    IF v_existing.booking_id <> p_booking_id OR v_existing.payment_id <> v_payment.id THEN
      RAISE EXCEPTION 'REFUND_IDEMPOTENCY_COLLISION' USING ERRCODE = '23505';
    END IF;
    IF v_existing.status NOT IN ('PENDING', 'PROCESSED') THEN
      RAISE EXCEPTION 'REFUND_STATE_INVALID' USING ERRCODE = '22000';
    END IF;
    v_refund_id := v_existing.id;
  END IF;

  v_on_way_at := nullif(v_booking.snapshot_data->>'provider_on_the_way_at', '')::timestamptz;
  SELECT * INTO v_calc
    FROM mazzi_internal.calculate_instant_cancellation(
      v_payment.amount_in_cents::bigint,
      v_on_way_at,
      v_booking.checkin_instructor_at,
      v_booking.lesson_started_at,
      'STUDENT',
      now()
    );

  IF v_calc.refund_amount_in_cents > 0 AND v_refund_id IS NULL THEN
    INSERT INTO public.refunds (
      payment_id, booking_id, amount_in_cents, reason, external_refund_id,
      idempotency_key, status
    ) VALUES (
      v_payment.id, p_booking_id, v_calc.refund_amount_in_cents::integer,
      v_reason, NULL, v_key, 'PENDING'
    ) RETURNING id INTO v_refund_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'payment_id', v_payment.id,
    'external_payment_id', v_external_payment_id,
    'gateway_provider', v_payment.gateway_provider,
    'refund_id', v_refund_id,
    'refund_amount_in_cents', v_calc.refund_amount_in_cents,
    'retained_amount_in_cents', v_calc.retained_amount_in_cents,
    'refund_percentage', v_calc.refund_percentage,
    'cancellation_stage', v_calc.cancellation_stage,
    'reason', v_reason,
    'idempotency_key', v_key,
    'existing_refund_status', coalesce(v_existing.status, 'PENDING')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_instant_booking_cancellation(
  p_booking_id uuid,
  p_reason text,
  p_reason_code text,
  p_idempotency_key text,
  p_refund_amount_in_cents integer,
  p_external_refund_id text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_service_role boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
  v_booking record;
  v_payment record;
  v_existing public.refunds%rowtype;
  v_refund public.refunds%rowtype;
  v_calc record;
  v_on_way_at timestamptz;
  v_key text := nullif(btrim(p_idempotency_key), '');
  v_reason text := coalesce(nullif(btrim(p_reason), ''), nullif(btrim(p_reason_code), ''), 'Cancelamento Aula Agora');
  v_cancellation_data jsonb;
  v_provider_user_id uuid;
BEGIN
  IF NOT v_is_service_role OR p_actor_id IS NULL THEN
    RAISE EXCEPTION 'SERVER_CONFIRMATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'REFUND_IDEMPOTENCY_KEY_REQUIRED' USING ERRCODE = '22000';
  END IF;
  IF p_refund_amount_in_cents IS NULL OR p_refund_amount_in_cents < 0 THEN
    RAISE EXCEPTION 'REFUND_AMOUNT_INVALID' USING ERRCODE = '22000';
  END IF;

  SELECT b.*, so.source AS offering_source
    INTO v_booking
    FROM public.bookings b
    JOIN public.service_offerings so ON so.id = b.offering_id
   WHERE b.id = p_booking_id
   FOR UPDATE OF b;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_booking.offering_source <> 'AULA_AGORA' THEN
    RAISE EXCEPTION 'INSTANT_BOOKING_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF v_booking.student_id <> p_actor_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED_STUDENT' USING ERRCODE = '42501';
  END IF;
  IF v_booking.status::text IN ('CANCELLED_BY_STUDENT', 'CANCELLED_BY_PROVIDER') THEN
    SELECT * INTO v_existing FROM public.refunds WHERE idempotency_key = v_key FOR UPDATE;
    RETURN jsonb_build_object(
      'success', true, 'is_idempotent', true, 'booking_id', p_booking_id,
      'status', v_booking.status::text,
      'refund_id', v_existing.id,
      'refund_amount_in_cents', coalesce(v_booking.refund_amount_in_cents, 0),
      'cancellation_data', coalesce(v_booking.cancellation_data, '{}'::jsonb)
    );
  END IF;
  IF v_booking.status::text = 'IN_PROGRESS' OR v_booking.lesson_started_at IS NOT NULL THEN
    RAISE EXCEPTION 'INSTANT_CANCELLATION_STARTED' USING ERRCODE = '42204';
  END IF;
  IF v_booking.status::text <> 'CONFIRMED' THEN
    RAISE EXCEPTION 'INSTANT_CANCELLATION_STATUS_INVALID' USING ERRCODE = '42200';
  END IF;

  SELECT * INTO v_payment
    FROM public.payments
   WHERE booking_id = p_booking_id
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;
  IF NOT FOUND OR v_payment.status::text <> 'PAID' THEN
    RAISE EXCEPTION 'PAYMENT_NOT_CONFIRMED' USING ERRCODE = '42201';
  END IF;
  IF lower(coalesce(v_payment.gateway_provider, '')) NOT LIKE 'stripe%' THEN
    RAISE EXCEPTION 'STRIPE_CANCELLATION_GATEWAY_REQUIRED' USING ERRCODE = '42203';
  END IF;

  v_on_way_at := nullif(v_booking.snapshot_data->>'provider_on_the_way_at', '')::timestamptz;
  SELECT * INTO v_calc
    FROM mazzi_internal.calculate_instant_cancellation(
      v_payment.amount_in_cents::bigint,
      v_on_way_at,
      v_booking.checkin_instructor_at,
      v_booking.lesson_started_at,
      'STUDENT',
      now()
    );
  IF p_refund_amount_in_cents <> v_calc.refund_amount_in_cents::integer THEN
    RAISE EXCEPTION 'REFUND_AMOUNT_MISMATCH' USING ERRCODE = '22000';
  END IF;

  SELECT * INTO v_existing FROM public.refunds WHERE idempotency_key = v_key FOR UPDATE;
  IF p_refund_amount_in_cents > 0 THEN
    IF NOT FOUND OR v_existing.payment_id <> v_payment.id OR v_existing.booking_id <> p_booking_id THEN
      RAISE EXCEPTION 'REFUND_CONFIRMATION_NOT_PREPARED' USING ERRCODE = '22000';
    END IF;
    IF v_existing.status = 'PROCESSED' THEN
      RETURN jsonb_build_object(
        'success', true, 'is_idempotent', true, 'booking_id', p_booking_id,
        'status', v_booking.status::text, 'refund_id', v_existing.id,
        'refund_amount_in_cents', v_existing.amount_in_cents,
        'cancellation_data', coalesce(v_booking.cancellation_data, '{}'::jsonb)
      );
    END IF;
    IF v_existing.status <> 'PENDING' THEN
      RAISE EXCEPTION 'REFUND_STATE_INVALID' USING ERRCODE = '22000';
    END IF;
    IF p_external_refund_id IS NULL OR btrim(p_external_refund_id) = '' THEN
      RAISE EXCEPTION 'GATEWAY_REFUND_CONFIRMATION_REQUIRED' USING ERRCODE = '42501';
    END IF;
    UPDATE public.refunds
       SET status = 'PROCESSED', external_refund_id = p_external_refund_id
     WHERE id = v_existing.id
     RETURNING * INTO v_refund;
  END IF;

  v_cancellation_data := jsonb_build_object(
    'policy', 'AULA_AGORA_INSTANT_V1',
    'source', 'AULA_AGORA',
    'cancellation_stage', v_calc.cancellation_stage,
    'reason_code', v_calc.reason_code,
    'reason', v_reason,
    'cancelled_by', 'STUDENT',
    'refund_percentage', v_calc.refund_percentage,
    'refund_amount_in_cents', v_calc.refund_amount_in_cents,
    'retained_amount_in_cents', v_calc.retained_amount_in_cents,
    'provider_on_the_way_at', v_on_way_at,
    'provider_arrived_at', v_booking.checkin_instructor_at,
    'lesson_started_at', v_booking.lesson_started_at,
    'cancelled_at', now(),
    'refund_status', CASE WHEN p_refund_amount_in_cents > 0 THEN 'PROCESSED' ELSE 'NOT_REQUIRED' END,
    'external_refund_id', p_external_refund_id,
    'settings_snapshot', v_calc.settings_snapshot
  );

  IF p_refund_amount_in_cents > 0 THEN
    UPDATE public.payments
       SET status = CASE WHEN p_refund_amount_in_cents = v_payment.amount_in_cents THEN 'REFUNDED'::public.payment_status ELSE 'PARTIALLY_REFUNDED'::public.payment_status END,
           updated_at = now()
     WHERE id = v_payment.id;
  END IF;
  UPDATE public.bookings
     SET status = 'CANCELLED_BY_STUDENT'::public.booking_status,
         cancelled_at = now(), cancelled_by = 'STUDENT',
         cancellation_reason = v_reason,
         refund_amount_in_cents = p_refund_amount_in_cents,
         cancellation_data = v_cancellation_data,
         updated_at = now()
   WHERE id = p_booking_id;

  UPDATE public.instant_lesson_offers
     SET status = 'DECLINED', updated_at = now()
   WHERE request_id IN (SELECT id FROM public.instant_lesson_requests WHERE booking_id = p_booking_id)
     AND status IN ('PENDING', 'ACCEPTED');
  UPDATE public.instant_lesson_requests
     SET status = 'CANCELLED', updated_at = now()
   WHERE booking_id = p_booking_id AND status NOT IN ('CANCELLED', 'EXPIRED');

  INSERT INTO public.audit_logs (id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at, ip_address)
  VALUES (
    gen_random_uuid(), p_actor_id, 'INSTANT_BOOKING_CANCELLED', 'Booking', p_booking_id,
    jsonb_build_object('status', v_booking.status::text, 'payment_status', v_payment.status::text),
    v_cancellation_data || jsonb_build_object('payment_status', CASE WHEN p_refund_amount_in_cents = v_payment.amount_in_cents THEN 'REFUNDED' ELSE 'PARTIALLY_REFUNDED' END, 'refund_id', CASE WHEN p_refund_amount_in_cents > 0 THEN v_refund.id ELSE NULL END),
    now(), NULL
  );

  SELECT user_id INTO v_provider_user_id FROM public.providers WHERE id = v_booking.provider_id;
  IF v_provider_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id, app_context, navigation_action)
    VALUES (v_provider_user_id, 'BOOKING_CANCELLED', 'Aula Agora cancelada', 'O aluno cancelou a Aula Agora.', 'booking', p_booking_id, 'PRO', 'booking');
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'is_idempotent', false, 'booking_id', p_booking_id,
    'status', 'CANCELLED_BY_STUDENT', 'refund_percentage', v_calc.refund_percentage,
    'refund_amount_in_cents', p_refund_amount_in_cents,
    'retained_amount_in_cents', v_calc.retained_amount_in_cents,
    'cancellation_stage', v_calc.cancellation_stage,
    'cancellation_data', v_cancellation_data, 'cancelled_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_instant_booking_cancellation(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_instant_booking_cancellation(uuid, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.finalize_instant_booking_cancellation(uuid, text, text, text, integer, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_instant_booking_cancellation(uuid, text, text, text, integer, text, uuid) TO service_role;

COMMIT;
