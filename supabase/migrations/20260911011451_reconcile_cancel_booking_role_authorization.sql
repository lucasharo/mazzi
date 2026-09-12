-- Resolve the canonical professional role before cancel_booking_v2 authorization.
-- Some dual-role accounts keep STUDENT in users.role while their active
-- professional role is stored in user_roles. The booking/provider relationship
-- remains mandatory, so this does not broaden access to another provider.
DO $migration$
DECLARE
  v_function_name CONSTANT text := 'public.cancel_booking_v2(uuid,text,text)';
  v_definition text;
  v_injection CONSTANT text := $sql$
  IF v_user_role = 'STUDENT' THEN
    SELECT CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.providers p ON p.user_id = ur.user_id
        WHERE ur.user_id = v_actor_id
          AND ur.role::TEXT = 'INSTRUCTOR'
          AND p.id = v_booking.provider_id
          AND p.type::TEXT = 'INSTRUCTOR'
      ) THEN 'INSTRUCTOR'
      WHEN EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.providers p ON p.user_id = ur.user_id
        WHERE ur.user_id = v_actor_id
          AND ur.role::TEXT IN ('SCHOOL_ADMIN', 'DRIVING_SCHOOL')
          AND p.id = v_booking.provider_id
          AND p.type::TEXT = 'DRIVING_SCHOOL'
      ) THEN 'SCHOOL_ADMIN'
      WHEN EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.driving_school_staff ds ON ds.user_id = ur.user_id
        WHERE ur.user_id = v_actor_id
          AND ur.role::TEXT IN ('SCHOOL_ADMIN', 'DRIVING_SCHOOL')
          AND ds.school_id = v_booking.provider_id
          AND ds.role::TEXT IN ('SCHOOL_ADMIN', 'DRIVING_SCHOOL')
          AND ds.is_active = TRUE
      ) THEN 'SCHOOL_ADMIN'
      WHEN EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = v_actor_id
          AND ur.role::TEXT = 'SCHOOL_STAFF'
      ) THEN 'SCHOOL_STAFF'
      WHEN EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = v_actor_id
          AND ur.role::TEXT = 'PLATFORM_ADMIN'
      ) THEN 'PLATFORM_ADMIN'
      ELSE v_user_role
    END INTO v_user_role;
  END IF;$sql$;
BEGIN
  SELECT pg_get_functiondef(v_function_name::regprocedure) INTO v_definition;

  IF v_definition IS NULL OR v_definition !~ 'IF v_booking IS NULL THEN[[:space:][:print:]]*END IF;' THEN
    RAISE EXCEPTION 'Booking lookup guard was not found in %', v_function_name;
  END IF;

  v_definition := regexp_replace(
    v_definition,
    '(IF v_booking IS NULL THEN.*?END IF;)',
    '\1' || E'\n' || v_injection,
    1,
    1,
    'n'
  );
  EXECUTE v_definition;
END;
$migration$;
