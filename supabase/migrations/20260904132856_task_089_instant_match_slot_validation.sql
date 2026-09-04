-- TASK-089: regular scheduled slots are aligned to full hours, while an
-- accepted Aula Agora starts at NOW() + ETA. Reusing the regular slot
-- validator incorrectly rejected every non-zero-minute instant start.
-- Concurrency remains protected by the booking exclusion constraints and the
-- provider advisory lock in create_instant_booking_hold().
DO $migration$
DECLARE
  v_definition text;
  v_updated_definition text;
  v_slot_check text := E'  IF NOT public.is_offering_slot_available(v_quote.offering_id, v_quote.scheduled_start_at) THEN\n    RAISE EXCEPTION ''SLOT_NO_LONGER_AVAILABLE'' USING ERRCODE = ''23P01'';\n  END IF;\n';
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'create_instant_booking_hold'
     AND pg_get_function_identity_arguments(p.oid) =
       'p_offer_id uuid, p_quote_id uuid, p_student_id uuid, p_idempotency_key character varying, p_hold_duration_minutes integer';

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'INSTANT_BOOKING_HOLD_FUNCTION_NOT_FOUND';
  END IF;
  v_updated_definition := replace(v_definition, v_slot_check, '');
  IF v_updated_definition = v_definition THEN
    RAISE EXCEPTION 'INSTANT_BOOKING_HOLD_SLOT_CHECK_NOT_FOUND';
  END IF;
  EXECUTE v_updated_definition;
END;
$migration$;
