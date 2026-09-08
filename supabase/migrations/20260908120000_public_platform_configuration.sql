-- Expose only the operational configuration required by authenticated apps.
-- Fees, payout safety, dispute deadlines and refund policy remain backend-only.

BEGIN;

INSERT INTO public.platform_configurations (key, value, description)
VALUES
  ('quote_settings', jsonb_build_object('expiration_minutes', 10), 'Prazo das cotações da Agenda.'),
  ('scheduling_settings', jsonb_build_object('max_booking_horizon_days', 90), 'Parâmetros de disponibilidade da Agenda.'),
  ('platform_operations', jsonb_build_object(
    'minimum_notice_hours', 2,
    'search_radius_km', 15,
    'checkin_window_before_minutes', 15
  ), 'Parâmetros operacionais da plataforma.'),
  ('instant_lesson_settings', jsonb_build_object(
    'max_eta_minutes', 30,
    'offer_expiration_seconds', 15,
    'payment_expiration_minutes', 5
  ), 'Parâmetros operacionais das ofertas Aula Agora.')
ON CONFLICT (key) DO NOTHING;

-- Existing environments may already have these rows from earlier migrations.
-- Fill only missing operational keys so an Admin value is never overwritten.
UPDATE public.platform_configurations AS pc
SET value = CASE pc.key
  WHEN 'quote_settings' THEN pc.value || jsonb_build_object(
    'expiration_minutes', COALESCE(pc.value->'expiration_minutes', '10'::jsonb)
  )
  WHEN 'scheduling_settings' THEN pc.value || jsonb_build_object(
    'max_booking_horizon_days', COALESCE(pc.value->'max_booking_horizon_days', '90'::jsonb)
  )
  WHEN 'platform_operations' THEN pc.value || jsonb_build_object(
    'minimum_notice_hours', COALESCE(pc.value->'minimum_notice_hours', '2'::jsonb),
    'search_radius_km', COALESCE(pc.value->'search_radius_km', '15'::jsonb),
    'checkin_window_before_minutes', COALESCE(pc.value->'checkin_window_before_minutes', '15'::jsonb)
  )
  WHEN 'instant_lesson_settings' THEN pc.value || jsonb_build_object(
    'max_eta_minutes', COALESCE(pc.value->'max_eta_minutes', '30'::jsonb),
    'offer_expiration_seconds', COALESCE(pc.value->'offer_expiration_seconds', '15'::jsonb),
    'payment_expiration_minutes', COALESCE(pc.value->'payment_expiration_minutes', '5'::jsonb)
  )
  ELSE pc.value
END,
updated_at = now()
WHERE pc.key IN ('quote_settings', 'scheduling_settings', 'platform_operations', 'instant_lesson_settings');

CREATE OR REPLACE FUNCTION public.get_public_platform_configuration()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_quote_expiration_minutes integer;
  v_availability_horizon_days integer;
  v_minimum_booking_notice_hours numeric;
  v_search_radius_defaults_km numeric;
  v_checkin_window_before_minutes integer;
  v_instant_max_eta_minutes integer;
  v_instant_offer_expiration_seconds integer;
  v_instant_lesson_expiration_minutes integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  SELECT CASE WHEN pc.value->>'expiration_minutes' ~ '^[0-9]+$'
    THEN (pc.value->>'expiration_minutes')::integer END
    INTO v_quote_expiration_minutes
    FROM public.platform_configurations AS pc
   WHERE pc.key = 'quote_settings'
   LIMIT 1;
  SELECT CASE WHEN pc.value->>'max_booking_horizon_days' ~ '^[0-9]+$'
    THEN (pc.value->>'max_booking_horizon_days')::integer END
    INTO v_availability_horizon_days
    FROM public.platform_configurations AS pc
   WHERE pc.key = 'scheduling_settings'
   LIMIT 1;
  SELECT CASE WHEN pc.value->>'minimum_notice_hours' ~ '^[0-9]+([.][0-9]+)?$'
    THEN (pc.value->>'minimum_notice_hours')::numeric END,
    CASE WHEN pc.value->>'search_radius_km' ~ '^[0-9]+([.][0-9]+)?$'
      THEN (pc.value->>'search_radius_km')::numeric END,
    CASE WHEN pc.value->>'checkin_window_before_minutes' ~ '^[0-9]+$'
      THEN (pc.value->>'checkin_window_before_minutes')::integer END
    INTO v_minimum_booking_notice_hours, v_search_radius_defaults_km, v_checkin_window_before_minutes
    FROM public.platform_configurations AS pc
   WHERE pc.key = 'platform_operations'
   LIMIT 1;
  SELECT CASE WHEN pc.value->>'max_eta_minutes' ~ '^[0-9]+$'
    THEN (pc.value->>'max_eta_minutes')::integer END,
    CASE WHEN pc.value->>'offer_expiration_seconds' ~ '^[0-9]+$'
      THEN (pc.value->>'offer_expiration_seconds')::integer END,
    CASE WHEN pc.value->>'payment_expiration_minutes' ~ '^[0-9]+$'
      THEN (pc.value->>'payment_expiration_minutes')::integer END
    INTO v_instant_max_eta_minutes, v_instant_offer_expiration_seconds, v_instant_lesson_expiration_minutes
    FROM public.platform_configurations AS pc
   WHERE pc.key = 'instant_lesson_settings'
   LIMIT 1;

  IF v_quote_expiration_minutes IS NULL OR v_quote_expiration_minutes < 1
     OR v_availability_horizon_days IS NULL OR v_availability_horizon_days NOT BETWEEN 1 AND 365
     OR v_minimum_booking_notice_hours IS NULL OR v_minimum_booking_notice_hours < 0
     OR v_search_radius_defaults_km IS NULL OR v_search_radius_defaults_km <= 0 OR v_search_radius_defaults_km > 50
     OR v_checkin_window_before_minutes IS NULL OR v_checkin_window_before_minutes NOT BETWEEN 1 AND 60
     OR v_instant_max_eta_minutes IS NULL OR v_instant_max_eta_minutes NOT BETWEEN 1 AND 120
     OR v_instant_offer_expiration_seconds IS NULL OR v_instant_offer_expiration_seconds NOT BETWEEN 5 AND 120
     OR v_instant_lesson_expiration_minutes IS NULL OR v_instant_lesson_expiration_minutes NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'PUBLIC_PLATFORM_CONFIGURATION_INVALID' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'quote_expiration_minutes', v_quote_expiration_minutes,
    'availability_horizon_days', v_availability_horizon_days,
    'minimum_booking_notice_hours', v_minimum_booking_notice_hours,
    'search_radius_defaults_km', v_search_radius_defaults_km,
    'checkin_window_before_minutes', v_checkin_window_before_minutes,
    'instant_max_eta_minutes', v_instant_max_eta_minutes,
    'instant_offer_expiration_seconds', v_instant_offer_expiration_seconds,
    'instant_lesson_expiration_minutes', v_instant_lesson_expiration_minutes
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_public_platform_configuration() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_platform_configuration() TO authenticated, service_role;

-- The minimum notice is a platform rule, so enforce it at the quote boundary
-- instead of relying on the Student UI. Aula Agora quotes are intentionally
-- exempt because their start time is calculated from the live ETA flow.
CREATE OR REPLACE FUNCTION public.enforce_configured_booking_notice()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  v_notice_hours numeric;
BEGIN
  IF COALESCE(NEW.idempotency_key, '') LIKE 'instant_quote:%' THEN
    RETURN NEW;
  END IF;

  SELECT CASE WHEN pc.value->>'minimum_notice_hours' ~ '^[0-9]+([.][0-9]+)?$'
    THEN (pc.value->>'minimum_notice_hours')::numeric END
    INTO v_notice_hours
    FROM public.platform_configurations AS pc
   WHERE pc.key = 'platform_operations'
   LIMIT 1;

  IF v_notice_hours IS NULL OR v_notice_hours < 0 THEN
    RAISE EXCEPTION 'PUBLIC_PLATFORM_CONFIGURATION_INVALID' USING ERRCODE = '22023';
  END IF;

  IF NEW.scheduled_start_at < now() + make_interval(mins => round(v_notice_hours * 60)::integer) THEN
    RAISE EXCEPTION 'MINIMUM_BOOKING_NOTICE_NOT_MET: Esta aula precisa ser agendada com a antecedência mínima configurada.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_configured_booking_notice ON public.quotes;
CREATE TRIGGER trg_enforce_configured_booking_notice
  BEFORE INSERT ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_configured_booking_notice();

REVOKE ALL ON FUNCTION public.enforce_configured_booking_notice() FROM PUBLIC, anon, authenticated;

COMMIT;
