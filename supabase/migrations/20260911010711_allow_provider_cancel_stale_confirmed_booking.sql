-- Allow authorized participants to resolve stale CONFIRMED bookings that never started.
-- A booking with lesson_started_at already set must continue through the
-- completion/no-show/dispute flow instead of commercial cancellation.
DO $migration$
DECLARE
  v_function_name CONSTANT text := 'public.cancel_booking_v2(uuid,text,text)';
  v_definition text;
  v_expected CONSTANT text := $sql$IF ((v_user_role = 'STUDENT' AND v_booking.lesson_started_at IS NOT NULL) OR (v_user_role <> 'STUDENT' AND v_booking.scheduled_start_at <= NOW())) THEN$sql$;
  v_replacement CONSTANT text := $sql$IF v_booking.lesson_started_at IS NOT NULL THEN$sql$;
BEGIN
  SELECT pg_get_functiondef(v_function_name::regprocedure) INTO v_definition;

  IF v_definition IS NULL OR position(v_expected IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Expected cancellation time guard was not found in %', v_function_name;
  END IF;

  v_definition := replace(v_definition, v_expected, v_replacement);
  EXECUTE v_definition;
END;
$migration$;
