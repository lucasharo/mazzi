-- Allow a student to cancel a confirmed lesson after its scheduled time when
-- the lesson was never actually started. The server remains authoritative:
-- once lesson_started_at exists, cancellation is rejected.
DO $$
DECLARE
  v_function_name CONSTANT text := 'public.cancel_booking_v2(uuid,text,text)';
  v_definition text;
  v_replacement text := 'IF ((v_user_role = ''STUDENT'' AND v_booking.lesson_started_at IS NOT NULL) OR (v_user_role <> ''STUDENT'' AND v_booking.scheduled_start_at <= NOW())) THEN';
BEGIN
  SELECT pg_get_functiondef(v_function_name::regprocedure) INTO v_definition;

  IF v_definition IS NULL OR v_definition !~ 'IF v_booking\.scheduled_start_at\s*<=\s*NOW\(\)\s*THEN' THEN
    RAISE EXCEPTION 'Expected cancellation time guard was not found in %', v_function_name;
  END IF;

  v_definition := regexp_replace(
    v_definition,
    'IF v_booking\.scheduled_start_at\s*<=\s*NOW\(\)\s*THEN',
    v_replacement,
    1,
    1,
    'n'
  );
  EXECUTE v_definition;
END;
$$;
