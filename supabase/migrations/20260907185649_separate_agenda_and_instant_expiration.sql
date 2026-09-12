-- Keep the Agenda quote deadline independent from the Aula Agora deadline.
-- Agenda uses quote_settings.expiration_minutes; Aula Agora uses the
-- payment_expiration_minutes field below.

BEGIN;

-- Requested live defaults after splitting the flows: Agenda 10 minutes and
-- Aula Agora 5 minutes.
INSERT INTO public.platform_configurations (key, value, description)
VALUES (
  'quote_settings',
  jsonb_build_object('expiration_minutes', 10),
  'Prazo de expiração das cotações da Agenda.'
)
ON CONFLICT (key) DO UPDATE SET
  value = public.platform_configurations.value || jsonb_build_object(
    'expiration_minutes', COALESCE(public.platform_configurations.value->'expiration_minutes', '10'::jsonb)
  );

INSERT INTO public.platform_configurations (key, value, description)
VALUES (
  'instant_lesson_settings',
  jsonb_build_object(
    'max_eta_minutes', 30,
    'offer_expiration_seconds', 15,
    'payment_expiration_minutes', 5
  ),
  'Parâmetros operacionais das ofertas Aula Agora.'
)
ON CONFLICT (key) DO UPDATE SET
  value = public.platform_configurations.value || jsonb_build_object(
    'payment_expiration_minutes', COALESCE(public.platform_configurations.value->'payment_expiration_minutes', '5'::jsonb)
  );

-- New overload used by the Admin UI. The previous two-argument RPC remains
-- available for old clients, while new writes persist the separate deadline.
CREATE OR REPLACE FUNCTION public.update_admin_instant_lesson_config(
  p_max_eta_minutes integer,
  p_offer_expiration_seconds integer,
  p_payment_expiration_minutes integer
)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.current_user_has_permission('admin.platform.manage_settings'::public.app_permission) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_max_eta_minutes IS NULL OR p_max_eta_minutes NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'INVALID_INSTANT_MAX_ETA' USING ERRCODE = '22023';
  END IF;
  IF p_offer_expiration_seconds IS NULL OR p_offer_expiration_seconds NOT BETWEEN 5 AND 120 THEN
    RAISE EXCEPTION 'INVALID_INSTANT_OFFER_EXPIRATION' USING ERRCODE = '22023';
  END IF;
  IF p_payment_expiration_minutes IS NULL OR p_payment_expiration_minutes NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'INVALID_INSTANT_LESSON_EXPIRATION' USING ERRCODE = '22023';
  END IF;

  SELECT value INTO v_before
    FROM public.platform_configurations
   WHERE key = 'instant_lesson_settings'
   FOR UPDATE;

  INSERT INTO public.platform_configurations (key, value, description, updated_by, updated_at)
  VALUES (
    'instant_lesson_settings',
    jsonb_build_object(
      'max_eta_minutes', p_max_eta_minutes,
      'offer_expiration_seconds', p_offer_expiration_seconds,
      'payment_expiration_minutes', p_payment_expiration_minutes
    ),
    'Parâmetros operacionais das ofertas Aula Agora.',
    v_uid,
    now()
  )
  ON CONFLICT (key) DO UPDATE SET
    value = public.platform_configurations.value || jsonb_build_object(
      'max_eta_minutes', excluded.value->'max_eta_minutes',
      'offer_expiration_seconds', excluded.value->'offer_expiration_seconds',
      'payment_expiration_minutes', excluded.value->'payment_expiration_minutes'
    ),
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  SELECT value INTO v_after
    FROM public.platform_configurations
   WHERE key = 'instant_lesson_settings';

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, previous_value, new_value, created_at)
  VALUES (v_uid, 'PLATFORM_CONFIG_UPDATED', 'PlatformConfiguration', 'instant_lesson_settings', COALESCE(v_before, '{}'::jsonb), v_after, now());
END;
$function$;

REVOKE ALL ON FUNCTION public.update_admin_instant_lesson_config(integer, integer, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_admin_instant_lesson_config(integer, integer, integer) TO authenticated;

-- Aula Agora's search and accepted-offer payment deadline must use the same
-- setting. The instructor offer response window remains in seconds and is
-- intentionally unchanged.
CREATE OR REPLACE FUNCTION public.create_instant_lesson_request(
  p_meeting_point jsonb,
  p_latitude double precision,
  p_longitude double precision,
  p_category text,
  p_transmission text,
  p_max_price_in_cents integer,
  p_idempotency_key varchar
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_existing public.instant_lesson_requests%rowtype;
  v_id uuid;
  v_expiration_minutes integer;
  v_now timestamptz := now();
BEGIN
  IF v_uid IS NULL OR NOT public.user_has_role(v_uid, 'STUDENT'::public.user_role) THEN
    RAISE EXCEPTION 'INSTANT_STUDENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'INSTANT_IDEMPOTENCY_KEY_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_meeting_point IS NULL OR p_latitude IS NULL OR p_longitude IS NULL OR p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'INSTANT_LOCATION_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_category NOT IN ('A', 'B') OR p_transmission NOT IN ('ALL', 'MANUAL', 'AUTOMATIC', 'NOT_APPLICABLE') THEN
    RAISE EXCEPTION 'INSTANT_FILTER_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_max_price_in_cents IS NOT NULL AND p_max_price_in_cents <= 0 THEN
    RAISE EXCEPTION 'INSTANT_PRICE_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
    FROM public.instant_lesson_requests
   WHERE student_id = v_uid
     AND idempotency_key = NULLIF(btrim(p_idempotency_key), '');
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'is_idempotent', true, 'request_id', v_existing.id, 'status', v_existing.status, 'expires_at', v_existing.expires_at);
  END IF;

  SELECT CASE
    WHEN value->>'payment_expiration_minutes' ~ '^[0-9]+$'
      THEN (value->>'payment_expiration_minutes')::integer
  END
    INTO v_expiration_minutes
    FROM public.platform_configurations
   WHERE key = 'instant_lesson_settings';
  IF v_expiration_minutes IS NULL OR v_expiration_minutes NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'PLATFORM_CONFIGURATION_INVALID: instantLessonExpirationMinutes não está configurado.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.instant_lesson_requests
     SET status = 'EXPIRED', updated_at = v_now
   WHERE student_id = v_uid AND status = 'SEARCHING' AND expires_at <= v_now;

  INSERT INTO public.instant_lesson_requests (
    student_id, meeting_point, latitude, longitude, category, transmission,
    max_price_in_cents, idempotency_key, expires_at
  )
  VALUES (
    v_uid, p_meeting_point, p_latitude, p_longitude, p_category::public.vehicle_category,
    p_transmission, p_max_price_in_cents, NULLIF(btrim(p_idempotency_key), ''),
    v_now + make_interval(mins => v_expiration_minutes)
  )
  RETURNING id INTO v_id;

  PERFORM public.dispatch_instant_lesson_request(v_id);
  SELECT * INTO v_existing FROM public.instant_lesson_requests WHERE id = v_id;
  RETURN jsonb_build_object('success', true, 'is_idempotent', false, 'request_id', v_existing.id, 'status', v_existing.status, 'expires_at', v_existing.expires_at);
END;
$function$;

REVOKE ALL ON FUNCTION public.create_instant_lesson_request(jsonb, double precision, double precision, text, text, integer, varchar) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_instant_lesson_request(jsonb, double precision, double precision, text, text, integer, varchar) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_to_instant_offer(p_offer_id uuid, p_action text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_offer public.instant_lesson_offers%rowtype;
  v_req public.instant_lesson_requests%rowtype;
  v_uid uuid := auth.uid();
  v_quote_id uuid;
  v_booking jsonb;
  v_fee_pct numeric;
  v_fee integer;
  v_payment_expiration_minutes integer;
  v_now timestamptz := now();
BEGIN
  SELECT io.* INTO v_offer FROM public.instant_lesson_offers io WHERE io.id = p_offer_id FOR UPDATE;
  IF NOT FOUND OR NOT (v_offer.instructor_id = v_uid OR EXISTS (SELECT 1 FROM public.providers p WHERE p.id = v_offer.provider_id AND p.user_id = v_uid)) THEN
    RAISE EXCEPTION 'INSTANT_OFFER_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF p_action = 'DECLINE' THEN
    IF v_offer.status = 'PENDING' THEN UPDATE public.instant_lesson_offers SET status = 'DECLINED', updated_at = v_now WHERE id = p_offer_id; END IF;
    RETURN jsonb_build_object('success', true, 'status', 'DECLINED');
  END IF;
  IF p_action <> 'ACCEPT' THEN RAISE EXCEPTION 'INSTANT_ACTION_INVALID' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_req FROM public.instant_lesson_requests WHERE id = v_offer.request_id FOR UPDATE;
  IF v_offer.status <> 'PENDING' OR v_offer.expires_at <= v_now THEN
    UPDATE public.instant_lesson_offers SET status = 'EXPIRED', updated_at = v_now WHERE id = p_offer_id AND status = 'PENDING';
    RAISE EXCEPTION 'INSTANT_OFFER_EXPIRED' USING ERRCODE = '22023';
  END IF;
  IF v_req.status <> 'SEARCHING' THEN
    UPDATE public.instant_lesson_offers SET status = 'LOST_RACE', updated_at = v_now WHERE id = p_offer_id;
    RAISE EXCEPTION 'INSTANT_REQUEST_ALREADY_MATCHED' USING ERRCODE = '40001';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM public.provider_instant_settings s
      JOIN public.service_offerings o ON o.id = s.offering_id AND o.source = 'AULA_AGORA' AND o.status = 'ACTIVE' AND o.is_active
      JOIN public.vehicles v ON v.id = o.vehicle_id AND v.status = 'ACTIVE' AND v.deleted_at IS NULL
     WHERE s.provider_id = v_offer.provider_id AND s.offering_id = v_offer.offering_id
       AND s.instant_enabled = true AND o.instructor_id = v_offer.instructor_id AND o.vehicle_id = v_offer.vehicle_id
  ) THEN
    UPDATE public.instant_lesson_offers SET status = 'EXPIRED', updated_at = v_now WHERE id = p_offer_id AND status = 'PENDING';
    RAISE EXCEPTION 'INSTANT_VEHICLE_UNAVAILABLE' USING ERRCODE = '22023';
  END IF;

  SELECT CASE
    WHEN value->>'payment_expiration_minutes' ~ '^[0-9]+$'
      THEN (value->>'payment_expiration_minutes')::integer
  END
    INTO v_payment_expiration_minutes
    FROM public.platform_configurations
   WHERE key = 'instant_lesson_settings';
  IF v_payment_expiration_minutes IS NULL OR v_payment_expiration_minutes NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'PLATFORM_CONFIGURATION_INVALID: instantLessonExpirationMinutes não está configurado.' USING ERRCODE = '22023';
  END IF;

  SELECT CASE WHEN value->>'default_percentage' ~ '^[0-9]+([.][0-9]+)?$'
    THEN (value->>'default_percentage')::numeric END INTO v_fee_pct
    FROM public.platform_configurations WHERE key = 'platform_fees';
  IF v_fee_pct IS NULL OR v_fee_pct < 0 OR v_fee_pct > 100 THEN
    RAISE EXCEPTION 'PLATFORM_CONFIGURATION_INVALID: platformFeeDefaultPercentage não está configurado.' USING ERRCODE = '22023';
  END IF;
  v_fee := round((v_offer.offered_price_in_cents * v_fee_pct) / 100.0)::integer;
  v_quote_id := gen_random_uuid();
  INSERT INTO public.quotes (
    id, student_id, provider_id, instructor_id, vehicle_id, offering_id,
    scheduled_start_at, scheduled_end_at, price_in_cents, platform_fee_in_cents,
    total_in_cents, status, expires_at, idempotency_key
  )
  VALUES (
    v_quote_id, v_req.student_id, v_offer.provider_id, v_offer.instructor_id,
    v_offer.vehicle_id, v_offer.offering_id,
    v_now + make_interval(mins => v_offer.eta_minutes),
    v_now + make_interval(mins => v_offer.eta_minutes + (SELECT duration_minutes FROM public.service_offerings WHERE id = v_offer.offering_id)),
    v_offer.offered_price_in_cents, v_fee, v_offer.offered_price_in_cents, 'ACTIVE',
    v_now + make_interval(mins => v_payment_expiration_minutes),
    'instant_quote:' || v_offer.request_id::text
  );
  v_booking := public.create_instant_booking_hold(
    p_offer_id, v_quote_id, v_req.student_id,
    'instant_booking:' || v_req.id::text, v_payment_expiration_minutes
  );
  UPDATE public.bookings
     SET meeting_point = v_req.meeting_point,
         snapshot_data = snapshot_data || jsonb_build_object('source', 'AULA_AGORA', 'offeredPriceInCents', v_offer.offered_price_in_cents)
   WHERE id = (v_booking->>'booking_id')::uuid;
  UPDATE public.instant_lesson_requests
     SET status = 'MATCHED', matched_provider_id = v_offer.provider_id,
         matched_offering_id = v_offer.offering_id, booking_id = (v_booking->>'booking_id')::uuid,
         updated_at = v_now
   WHERE id = v_req.id;
  UPDATE public.instant_lesson_offers SET status = 'ACCEPTED', updated_at = v_now WHERE id = v_offer.id;
  UPDATE public.instant_lesson_offers SET status = 'LOST_RACE', updated_at = v_now WHERE request_id = v_req.id AND id <> v_offer.id AND status = 'PENDING';
  RETURN jsonb_build_object('success', true, 'status', 'ACCEPTED', 'booking_id', (v_booking->>'booking_id')::uuid, 'request_id', v_req.id, 'vehicle_id', v_offer.vehicle_id);
EXCEPTION WHEN exclusion_violation THEN
  RAISE EXCEPTION 'INSTANT_SCHEDULE_CONFLICT' USING ERRCODE = '23P01';
END;
$function$;

REVOKE ALL ON FUNCTION public.respond_to_instant_offer(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_instant_offer(uuid, text) TO authenticated;

COMMIT;
