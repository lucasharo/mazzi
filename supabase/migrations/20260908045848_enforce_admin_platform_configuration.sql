-- Keep every value exposed in Admin as the only source for operational rules.
-- Missing or malformed configuration must stop the operation instead of
-- silently selecting a business default in a backend function.

BEGIN;

CREATE OR REPLACE FUNCTION public.validate_platform_configuration_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  v_value numeric;
  v_other_value numeric;
BEGIN
  IF NEW.key = 'platform_fees' THEN
    IF NEW.value ? 'default_percentage' THEN
      IF NEW.value->>'default_percentage' !~ '^[0-9]+([.][0-9]+)?$'
         OR (NEW.value->>'default_percentage')::numeric NOT BETWEEN 0 AND 100 THEN
        RAISE EXCEPTION 'INVALID_FEE_PERCENTAGE' USING ERRCODE = '22023';
      END IF;
    END IF;
    IF NEW.value ? 'mercadopago_fee_percentage' THEN
      IF NEW.value->>'mercadopago_fee_percentage' !~ '^[0-9]+([.][0-9]+)?$'
         OR (NEW.value->>'mercadopago_fee_percentage')::numeric NOT BETWEEN 0 AND 100 THEN
        RAISE EXCEPTION 'INVALID_GATEWAY_FEE_PERCENTAGE' USING ERRCODE = '22023';
      END IF;
    END IF;
    IF NEW.value ? 'max_total_fee_percentage' THEN
      IF NEW.value->>'max_total_fee_percentage' !~ '^[0-9]+([.][0-9]+)?$'
         OR (NEW.value->>'max_total_fee_percentage')::numeric NOT BETWEEN 0 AND 100 THEN
        RAISE EXCEPTION 'INVALID_TOTAL_FEE_PERCENTAGE' USING ERRCODE = '22023';
      END IF;
    END IF;
    IF NEW.value ? 'mercadopago_fee_percentage' AND NEW.value ? 'max_total_fee_percentage' THEN
      v_value := (NEW.value->>'mercadopago_fee_percentage')::numeric;
      v_other_value := (NEW.value->>'max_total_fee_percentage')::numeric;
      IF v_value > v_other_value THEN
        RAISE EXCEPTION 'GATEWAY_FEE_EXCEEDS_TOTAL_FEE_CAP' USING ERRCODE = '22023';
      END IF;
    END IF;
  ELSIF NEW.key = 'quote_settings' AND NEW.value ? 'expiration_minutes' THEN
    IF NEW.value->>'expiration_minutes' !~ '^[0-9]+$'
       OR (NEW.value->>'expiration_minutes')::integer < 1 THEN
      RAISE EXCEPTION 'INVALID_QUOTE_EXPIRATION' USING ERRCODE = '22023';
    END IF;
  ELSIF NEW.key = 'scheduling_settings' AND NEW.value ? 'max_booking_horizon_days' THEN
    IF NEW.value->>'max_booking_horizon_days' !~ '^[0-9]+$'
       OR (NEW.value->>'max_booking_horizon_days')::integer NOT BETWEEN 1 AND 365 THEN
      RAISE EXCEPTION 'INVALID_AVAILABILITY_HORIZON' USING ERRCODE = '22023';
    END IF;
  ELSIF NEW.key = 'platform_operations' THEN
    IF NEW.value ? 'minimum_notice_hours' THEN
      IF NEW.value->>'minimum_notice_hours' !~ '^[0-9]+([.][0-9]+)?$'
         OR (NEW.value->>'minimum_notice_hours')::numeric < 0 THEN
        RAISE EXCEPTION 'INVALID_MINIMUM_BOOKING_NOTICE' USING ERRCODE = '22023';
      END IF;
    END IF;
    IF NEW.value ? 'payout_safety_period_hours' THEN
      IF NEW.value->>'payout_safety_period_hours' !~ '^[0-9]+([.][0-9]+)?$'
         OR (NEW.value->>'payout_safety_period_hours')::numeric < 0 THEN
        RAISE EXCEPTION 'INVALID_PAYOUT_SAFETY_PERIOD' USING ERRCODE = '22023';
      END IF;
    END IF;
    IF NEW.value ? 'search_radius_km' THEN
      IF NEW.value->>'search_radius_km' !~ '^[0-9]+([.][0-9]+)?$'
         OR (NEW.value->>'search_radius_km')::numeric <= 0
         OR (NEW.value->>'search_radius_km')::numeric > 50 THEN
        RAISE EXCEPTION 'INVALID_SEARCH_RADIUS' USING ERRCODE = '22023';
      END IF;
    END IF;
    IF NEW.value ? 'checkin_window_before_minutes' THEN
      IF NEW.value->>'checkin_window_before_minutes' !~ '^[0-9]+$'
         OR (NEW.value->>'checkin_window_before_minutes')::integer NOT BETWEEN 1 AND 60 THEN
        RAISE EXCEPTION 'INVALID_CHECKIN_WINDOW' USING ERRCODE = '22023';
      END IF;
    END IF;
    IF NEW.value ? 'contestation_response_hours' THEN
      IF NEW.value->>'contestation_response_hours' !~ '^[0-9]+([.][0-9]+)?$'
         OR (NEW.value->>'contestation_response_hours')::numeric NOT BETWEEN 1 AND 720 THEN
        RAISE EXCEPTION 'INVALID_CONTESTATION_RESPONSE_HOURS' USING ERRCODE = '22023';
      END IF;
    END IF;
  ELSIF NEW.key = 'instant_lesson_settings' THEN
    IF NEW.value ? 'max_eta_minutes' THEN
      IF NEW.value->>'max_eta_minutes' !~ '^[0-9]+$'
         OR (NEW.value->>'max_eta_minutes')::integer NOT BETWEEN 1 AND 120 THEN
        RAISE EXCEPTION 'INVALID_INSTANT_MAX_ETA' USING ERRCODE = '22023';
      END IF;
    END IF;
    IF NEW.value ? 'offer_expiration_seconds' THEN
      IF NEW.value->>'offer_expiration_seconds' !~ '^[0-9]+$'
         OR (NEW.value->>'offer_expiration_seconds')::integer NOT BETWEEN 5 AND 120 THEN
        RAISE EXCEPTION 'INVALID_INSTANT_OFFER_EXPIRATION' USING ERRCODE = '22023';
      END IF;
    END IF;
    IF NEW.value ? 'payment_expiration_minutes' THEN
      IF NEW.value->>'payment_expiration_minutes' !~ '^[0-9]+$'
         OR (NEW.value->>'payment_expiration_minutes')::integer NOT BETWEEN 1 AND 60 THEN
        RAISE EXCEPTION 'INVALID_INSTANT_LESSON_EXPIRATION' USING ERRCODE = '22023';
      END IF;
    END IF;
    FOREACH v_value IN ARRAY ARRAY[
      CASE WHEN NEW.value ? 'instant_refund_on_way_initial_percent' THEN (NEW.value->>'instant_refund_on_way_initial_percent')::numeric END,
      CASE WHEN NEW.value ? 'instant_refund_on_way_middle_percent' THEN (NEW.value->>'instant_refund_on_way_middle_percent')::numeric END,
      CASE WHEN NEW.value ? 'instant_refund_on_way_late_percent' THEN (NEW.value->>'instant_refund_on_way_late_percent')::numeric END,
      CASE WHEN NEW.value ? 'instant_refund_after_arrival_percent' THEN (NEW.value->>'instant_refund_after_arrival_percent')::numeric END
    ] LOOP
      IF v_value IS NOT NULL AND v_value NOT BETWEEN 0 AND 100 THEN
        RAISE EXCEPTION 'INVALID_INSTANT_REFUND_PERCENTAGE' USING ERRCODE = '22023';
      END IF;
    END LOOP;
    IF NEW.value ? 'instant_refund_initial_window_minutes' THEN
      IF NEW.value->>'instant_refund_initial_window_minutes' !~ '^[0-9]+$'
         OR (NEW.value->>'instant_refund_initial_window_minutes')::integer < 1 THEN
        RAISE EXCEPTION 'INVALID_INSTANT_REFUND_WINDOW' USING ERRCODE = '22023';
      END IF;
    END IF;
    IF NEW.value ? 'instant_refund_middle_window_minutes' THEN
      IF NEW.value->>'instant_refund_middle_window_minutes' !~ '^[0-9]+$'
         OR (NEW.value->>'instant_refund_middle_window_minutes')::integer < 2 THEN
        RAISE EXCEPTION 'INVALID_INSTANT_REFUND_WINDOW' USING ERRCODE = '22023';
      END IF;
    END IF;
    IF NEW.value ? 'instant_refund_initial_window_minutes'
       AND NEW.value ? 'instant_refund_middle_window_minutes'
       AND (NEW.value->>'instant_refund_middle_window_minutes')::integer
           <= (NEW.value->>'instant_refund_initial_window_minutes')::integer THEN
      RAISE EXCEPTION 'INVALID_INSTANT_REFUND_WINDOW_ORDER' USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_platform_configuration ON public.platform_configurations;
CREATE TRIGGER trg_validate_platform_configuration
  BEFORE INSERT OR UPDATE OF value ON public.platform_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_platform_configuration_row();

REVOKE ALL ON FUNCTION public.validate_platform_configuration_row() FROM PUBLIC, anon, authenticated;

-- The trigger below is the only writer of this field. A static default would
-- bypass the Admin setting if the trigger were ever changed or skipped.
ALTER TABLE public.booking_disputes
  ALTER COLUMN response_due_at DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.get_payout_safety_period_hours()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_safety integer;
BEGIN
  SELECT CASE
    WHEN pc.value->>'payout_safety_period_hours' ~ '^[0-9]+$'
      THEN (pc.value->>'payout_safety_period_hours')::integer
  END
    INTO v_safety
    FROM public.platform_configurations AS pc
   WHERE pc.key = 'platform_operations'
   LIMIT 1;

  IF v_safety IS NULL OR v_safety < 0 THEN
    RAISE EXCEPTION 'PLATFORM_CONFIGURATION_INVALID: payoutSafetyPeriodHours não está configurado.' USING ERRCODE = '22023';
  END IF;
  RETURN v_safety;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_payout_safety_period_hours() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_payout_safety_period_hours() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_contestation_response_deadline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_hours numeric;
BEGIN
  SELECT CASE
    WHEN pc.value->>'contestation_response_hours' ~ '^[0-9]+([.][0-9]+)?$'
      THEN (pc.value->>'contestation_response_hours')::numeric
  END
    INTO v_hours
    FROM public.platform_configurations AS pc
   WHERE pc.key = 'platform_operations'
   LIMIT 1;

  IF v_hours IS NULL OR v_hours NOT BETWEEN 1 AND 720 THEN
    RAISE EXCEPTION 'PLATFORM_CONFIGURATION_INVALID: contestationResponseHours não está configurado.' USING ERRCODE = '22023';
  END IF;
  NEW.response_due_at := now() + make_interval(secs => (v_hours * 3600)::double precision);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_contestation_response_deadline ON public.booking_disputes;
CREATE TRIGGER trg_set_contestation_response_deadline
  BEFORE INSERT ON public.booking_disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_contestation_response_deadline();

REVOKE ALL ON FUNCTION public.set_contestation_response_deadline() FROM PUBLIC, anon, authenticated;

-- Keep the legacy helper signatures used by existing check-in RPCs, but make
-- them read the same Admin row without a fallback value.
CREATE OR REPLACE FUNCTION public.get_checkin_window_before_minutes()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_window integer;
BEGIN
  SELECT CASE
    WHEN pc.value->>'checkin_window_before_minutes' ~ '^[0-9]+$'
      THEN (pc.value->>'checkin_window_before_minutes')::integer
  END
    INTO v_window
    FROM public.platform_configurations AS pc
   WHERE pc.key = 'platform_operations'
   LIMIT 1;

  IF v_window IS NULL OR v_window NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'PLATFORM_CONFIGURATION_INVALID: checkInWindowBeforeMinutes não está configurado.' USING ERRCODE = '22023';
  END IF;
  RETURN v_window;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_checkin_window_before_minutes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_checkin_window_before_minutes() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_public_booking_horizon_days()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_horizon integer;
BEGIN
  SELECT CASE
    WHEN pc.value->>'max_booking_horizon_days' ~ '^[0-9]+$'
      THEN (pc.value->>'max_booking_horizon_days')::integer
  END
    INTO v_horizon
    FROM public.platform_configurations AS pc
   WHERE pc.key = 'scheduling_settings'
   LIMIT 1;

  IF v_horizon IS NULL OR v_horizon NOT BETWEEN 1 AND 365 THEN
    RAISE EXCEPTION 'PLATFORM_CONFIGURATION_INVALID: availabilityHorizonDays não está configurado.' USING ERRCODE = '22023';
  END IF;
  RETURN v_horizon;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_public_booking_horizon_days() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_booking_horizon_days() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_instant_lesson_platform_config()
RETURNS TABLE(max_eta_minutes integer, offer_expiration_seconds integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_max_eta integer;
  v_offer_expiration integer;
BEGIN
  SELECT CASE
    WHEN pc.value->>'max_eta_minutes' ~ '^[0-9]+$'
      THEN (pc.value->>'max_eta_minutes')::integer
  END,
  CASE
    WHEN pc.value->>'offer_expiration_seconds' ~ '^[0-9]+$'
      THEN (pc.value->>'offer_expiration_seconds')::integer
  END
    INTO v_max_eta, v_offer_expiration
    FROM public.platform_configurations AS pc
   WHERE pc.key = 'instant_lesson_settings'
   LIMIT 1;

  IF v_max_eta IS NULL OR v_max_eta NOT BETWEEN 1 AND 120
     OR v_offer_expiration IS NULL OR v_offer_expiration NOT BETWEEN 5 AND 120 THEN
    RAISE EXCEPTION 'PLATFORM_CONFIGURATION_INVALID: parâmetros Aula Agora não estão configurados.' USING ERRCODE = '22023';
  END IF;
  max_eta_minutes := v_max_eta;
  offer_expiration_seconds := v_offer_expiration;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_instant_lesson_platform_config() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_instant_lesson_platform_config() TO authenticated, service_role;

-- Re-emit the public contract after tightening the search-radius bound. This
-- keeps already deployed environments on the same validation rules as new
-- environments without exposing financial or dispute configuration.
CREATE OR REPLACE FUNCTION public.get_public_platform_configuration()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_quote integer;
  v_horizon integer;
  v_notice numeric;
  v_radius numeric;
  v_checkin integer;
  v_max_eta integer;
  v_offer_expiration integer;
  v_lesson_expiration integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  SELECT CASE WHEN pc.value->>'expiration_minutes' ~ '^[0-9]+$'
    THEN (pc.value->>'expiration_minutes')::integer END
    INTO v_quote FROM public.platform_configurations AS pc WHERE pc.key = 'quote_settings' LIMIT 1;
  SELECT CASE WHEN pc.value->>'max_booking_horizon_days' ~ '^[0-9]+$'
    THEN (pc.value->>'max_booking_horizon_days')::integer END
    INTO v_horizon FROM public.platform_configurations AS pc WHERE pc.key = 'scheduling_settings' LIMIT 1;
  SELECT
    CASE WHEN pc.value->>'minimum_notice_hours' ~ '^[0-9]+([.][0-9]+)?$' THEN (pc.value->>'minimum_notice_hours')::numeric END,
    CASE WHEN pc.value->>'search_radius_km' ~ '^[0-9]+([.][0-9]+)?$' THEN (pc.value->>'search_radius_km')::numeric END,
    CASE WHEN pc.value->>'checkin_window_before_minutes' ~ '^[0-9]+$' THEN (pc.value->>'checkin_window_before_minutes')::integer END
    INTO v_notice, v_radius, v_checkin
    FROM public.platform_configurations AS pc WHERE pc.key = 'platform_operations' LIMIT 1;
  SELECT
    CASE WHEN pc.value->>'max_eta_minutes' ~ '^[0-9]+$' THEN (pc.value->>'max_eta_minutes')::integer END,
    CASE WHEN pc.value->>'offer_expiration_seconds' ~ '^[0-9]+$' THEN (pc.value->>'offer_expiration_seconds')::integer END,
    CASE WHEN pc.value->>'payment_expiration_minutes' ~ '^[0-9]+$' THEN (pc.value->>'payment_expiration_minutes')::integer END
    INTO v_max_eta, v_offer_expiration, v_lesson_expiration
    FROM public.platform_configurations AS pc WHERE pc.key = 'instant_lesson_settings' LIMIT 1;

  IF v_quote IS NULL OR v_quote < 1
     OR v_horizon IS NULL OR v_horizon NOT BETWEEN 1 AND 365
     OR v_notice IS NULL OR v_notice < 0
     OR v_radius IS NULL OR v_radius <= 0 OR v_radius > 50
     OR v_checkin IS NULL OR v_checkin NOT BETWEEN 1 AND 60
     OR v_max_eta IS NULL OR v_max_eta NOT BETWEEN 1 AND 120
     OR v_offer_expiration IS NULL OR v_offer_expiration NOT BETWEEN 5 AND 120
     OR v_lesson_expiration IS NULL OR v_lesson_expiration NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'PUBLIC_PLATFORM_CONFIGURATION_INVALID' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'quote_expiration_minutes', v_quote,
    'availability_horizon_days', v_horizon,
    'minimum_booking_notice_hours', v_notice,
    'search_radius_defaults_km', v_radius,
    'checkin_window_before_minutes', v_checkin,
    'instant_max_eta_minutes', v_max_eta,
    'instant_offer_expiration_seconds', v_offer_expiration,
    'instant_lesson_expiration_minutes', v_lesson_expiration
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_public_platform_configuration() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_platform_configuration() TO authenticated, service_role;

COMMIT;
