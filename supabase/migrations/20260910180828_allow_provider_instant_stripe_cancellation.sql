-- MAZZI — Permite cancelamento Stripe da Aula Agora pelo PRO autorizado.
-- O endpoint Stripe era originalmente exclusivo do aluno, embora o fluxo
-- tradicional já aceitasse o instrutor/proprietário responsável.

DO $$
DECLARE
  v_definition text;
  v_old text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'prepare_instant_booking_cancellation'
     AND pg_get_function_identity_arguments(p.oid) = 'p_booking_id uuid, p_reason text, p_reason_code text, p_idempotency_key text';

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'A função prepare_instant_booking_cancellation não está disponível.';
  END IF;

  v_old := $old$
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
$old$;
  v_new := $new$
DECLARE
  v_uid uuid := auth.uid();
  v_user_role text;
  v_cancelled_by text;
  v_provider_user_id uuid;
  v_provider_type text;
  v_is_authorized_school_admin boolean := false;
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
  SELECT role::text INTO v_user_role FROM public.users WHERE id = v_uid;
  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_user_role = 'STUDENT' THEN
    PERFORM public.lock_student_profile(v_uid);
    PERFORM public.assert_current_user_student();
  END IF;
$new$;
  IF position(v_old in v_definition) = 0 THEN
    RAISE EXCEPTION 'Bloco de autenticação do prepare não encontrado.';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $old$
  IF v_booking.student_id <> v_uid THEN
    RAISE EXCEPTION 'UNAUTHORIZED_STUDENT' USING ERRCODE = '42501';
  END IF;
$old$;
  v_new := $new$
  IF v_user_role = 'STUDENT' THEN
    IF v_booking.student_id <> v_uid THEN
      RAISE EXCEPTION 'UNAUTHORIZED_STUDENT' USING ERRCODE = '42501';
    END IF;
    v_cancelled_by := 'STUDENT';
  ELSIF v_user_role = 'INSTRUCTOR' THEN
    SELECT user_id, type::text INTO v_provider_user_id, v_provider_type
      FROM public.providers WHERE id = v_booking.provider_id;
    IF v_provider_user_id IS DISTINCT FROM v_uid OR v_provider_type IS DISTINCT FROM 'INSTRUCTOR' THEN
      RAISE EXCEPTION 'UNAUTHORIZED_PROVIDER' USING ERRCODE = '42501';
    END IF;
    v_cancelled_by := 'PROVIDER';
  ELSIF v_user_role IN ('SCHOOL_ADMIN', 'DRIVING_SCHOOL') THEN
    SELECT user_id INTO v_provider_user_id FROM public.providers WHERE id = v_booking.provider_id;
    IF v_provider_user_id = v_uid THEN
      v_is_authorized_school_admin := true;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.driving_school_staff
         WHERE school_id = v_booking.provider_id
           AND user_id = v_uid
           AND role::text IN ('SCHOOL_ADMIN', 'DRIVING_SCHOOL')
           AND is_active = true
      ) INTO v_is_authorized_school_admin;
    END IF;
    IF NOT v_is_authorized_school_admin THEN
      RAISE EXCEPTION 'UNAUTHORIZED_SCHOOL_ADMIN' USING ERRCODE = '42501';
    END IF;
    v_cancelled_by := 'PROVIDER';
  ELSE
    RAISE EXCEPTION 'UNAUTHORIZED_ROLE' USING ERRCODE = '42501';
  END IF;
  IF v_cancelled_by = 'PROVIDER' THEN
    IF p_reason_code IS NULL OR trim(p_reason_code) = '' THEN
      RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = '42201';
    END IF;
    IF p_reason_code NOT IN ('VEHICLE_ISSUE', 'PERSONAL_EMERGENCY', 'SCHEDULE_CONFLICT', 'WEATHER_OR_SAFETY', 'OPERATIONAL_ISSUE', 'OTHER') THEN
      RAISE EXCEPTION 'REASON_CODE_INVALID' USING ERRCODE = '42202';
    END IF;
    IF p_reason_code = 'OTHER' AND (p_reason IS NULL OR trim(p_reason) = '') THEN
      RAISE EXCEPTION 'REASON_DESCRIPTION_REQUIRED' USING ERRCODE = '42203';
    END IF;
  END IF;
$new$;
  IF position(v_old in v_definition) = 0 THEN
    RAISE EXCEPTION 'Bloco de autorização do prepare não encontrado.';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $old$
  v_reason := coalesce(nullif(btrim(p_reason), ''), nullif(btrim(p_reason_code), ''), 'Cancelamento Aula Agora');
$old$;
  v_new := $new$
  v_reason := CASE WHEN v_cancelled_by = 'STUDENT'
    THEN coalesce(nullif(nullif(btrim(p_reason), 'STUDENT_REQUEST'), ''), nullif(nullif(btrim(p_reason_code), 'STUDENT_REQUEST'), ''), 'Cancelamento solicitado pelo aluno, sem motivo informado.')
    ELSE coalesce(nullif(nullif(btrim(p_reason), 'STUDENT_REQUEST'), ''), nullif(nullif(btrim(p_reason_code), 'STUDENT_REQUEST'), ''), 'Cancelamento solicitado pelo profissional, sem motivo informado.')
  END;
$new$;
  IF position(v_old in v_definition) = 0 THEN
    RAISE EXCEPTION 'Bloco de motivo do prepare não encontrado.';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_definition := replace(v_definition,
    $block$      'STUDENT',
      now()
    );$block$,
    $block$      v_cancelled_by,
      now()
    );$block$);

  EXECUTE v_definition;
END;
$$;

DO $$
DECLARE
  v_definition text;
  v_old text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'finalize_instant_booking_cancellation'
     AND pg_get_function_identity_arguments(p.oid) = 'p_booking_id uuid, p_reason text, p_reason_code text, p_idempotency_key text, p_refund_amount_in_cents integer, p_external_refund_id text, p_actor_id uuid';

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'A função finalize_instant_booking_cancellation não está disponível.';
  END IF;

  v_old := $old$
  v_provider_user_id uuid;
BEGIN
$old$;
  v_new := $new$
  v_provider_user_id uuid;
  v_user_role text;
  v_cancelled_by text;
  v_provider_type text;
  v_is_authorized_school_admin boolean := false;
BEGIN
$new$;
  IF position(v_old in v_definition) = 0 THEN
    RAISE EXCEPTION 'Bloco de declaração do finalize não encontrado.';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $old$
  IF v_booking.student_id <> p_actor_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED_STUDENT' USING ERRCODE = '42501';
  END IF;
$old$;
  v_new := $new$
  SELECT role::text INTO v_user_role FROM public.users WHERE id = p_actor_id;
  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_user_role = 'STUDENT' THEN
    IF v_booking.student_id <> p_actor_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED_STUDENT' USING ERRCODE = '42501';
    END IF;
    v_cancelled_by := 'STUDENT';
  ELSIF v_user_role = 'INSTRUCTOR' THEN
    SELECT user_id, type::text INTO v_provider_user_id, v_provider_type
      FROM public.providers WHERE id = v_booking.provider_id;
    IF v_provider_user_id IS DISTINCT FROM p_actor_id OR v_provider_type IS DISTINCT FROM 'INSTRUCTOR' THEN
      RAISE EXCEPTION 'UNAUTHORIZED_PROVIDER' USING ERRCODE = '42501';
    END IF;
    v_cancelled_by := 'PROVIDER';
  ELSIF v_user_role IN ('SCHOOL_ADMIN', 'DRIVING_SCHOOL') THEN
    SELECT user_id INTO v_provider_user_id FROM public.providers WHERE id = v_booking.provider_id;
    IF v_provider_user_id = p_actor_id THEN
      v_is_authorized_school_admin := true;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.driving_school_staff
         WHERE school_id = v_booking.provider_id
           AND user_id = p_actor_id
           AND role::text IN ('SCHOOL_ADMIN', 'DRIVING_SCHOOL')
           AND is_active = true
      ) INTO v_is_authorized_school_admin;
    END IF;
    IF NOT v_is_authorized_school_admin THEN
      RAISE EXCEPTION 'UNAUTHORIZED_SCHOOL_ADMIN' USING ERRCODE = '42501';
    END IF;
    v_cancelled_by := 'PROVIDER';
  ELSE
    RAISE EXCEPTION 'UNAUTHORIZED_ROLE' USING ERRCODE = '42501';
  END IF;
  v_reason := CASE WHEN v_cancelled_by = 'STUDENT'
    THEN coalesce(nullif(nullif(btrim(p_reason), 'STUDENT_REQUEST'), ''), nullif(nullif(btrim(p_reason_code), 'STUDENT_REQUEST'), ''), 'Cancelamento solicitado pelo aluno, sem motivo informado.')
    ELSE coalesce(nullif(nullif(btrim(p_reason), 'STUDENT_REQUEST'), ''), nullif(nullif(btrim(p_reason_code), 'STUDENT_REQUEST'), ''), 'Cancelamento solicitado pelo profissional, sem motivo informado.')
  END;
$new$;
  IF position(v_old in v_definition) = 0 THEN
    RAISE EXCEPTION 'Bloco de autorização do finalize não encontrado.';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_definition := replace(v_definition,
    $block$      'STUDENT',
      now()
    );$block$,
    $block$      v_cancelled_by,
      now()
    );$block$);
  v_definition := replace(v_definition, $text$'cancelled_by', 'STUDENT'$text$, $text$'cancelled_by', v_cancelled_by$text$);
  v_definition := replace(v_definition, $text$status = 'CANCELLED_BY_STUDENT'::public.booking_status,$text$, $text$status = CASE WHEN v_cancelled_by = 'STUDENT' THEN 'CANCELLED_BY_STUDENT'::public.booking_status ELSE 'CANCELLED_BY_PROVIDER'::public.booking_status END,$text$);
  v_definition := replace(v_definition, $text$cancelled_by = 'STUDENT',$text$, $text$cancelled_by = v_cancelled_by,$text$);
  v_definition := replace(v_definition, $text$'status', 'CANCELLED_BY_STUDENT'$text$, $text$'status', CASE WHEN v_cancelled_by = 'STUDENT' THEN 'CANCELLED_BY_STUDENT' ELSE 'CANCELLED_BY_PROVIDER' END$text$);

  v_old := $old$
  SELECT user_id INTO v_provider_user_id FROM public.providers WHERE id = v_booking.provider_id;
  IF v_provider_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id, app_context, navigation_action)
    VALUES (v_provider_user_id, 'BOOKING_CANCELLED', 'Aula Agora cancelada', 'O aluno cancelou a Aula Agora.', 'booking', p_booking_id, 'PRO', 'details')
    ON CONFLICT (user_id, type, entity_type, entity_id)
      WHERE type IN ('BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'LESSON_COMPLETED', 'REVIEW_AVAILABLE')
    DO NOTHING;
  END IF;
$old$;
  v_new := $new$
  SELECT user_id INTO v_provider_user_id FROM public.providers WHERE id = v_booking.provider_id;
  IF v_cancelled_by = 'STUDENT' THEN
    IF v_provider_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id, app_context, navigation_action)
      VALUES (v_provider_user_id, 'BOOKING_CANCELLED', 'Aula Agora cancelada', 'O aluno cancelou a Aula Agora.', 'booking', p_booking_id, 'PRO', 'details')
      ON CONFLICT (user_id, type, entity_type, entity_id)
        WHERE type IN ('BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'LESSON_COMPLETED', 'REVIEW_AVAILABLE')
      DO NOTHING;
    END IF;
  ELSE
    INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id, app_context, navigation_action)
    VALUES (v_booking.student_id, 'BOOKING_CANCELLED', 'Aula Agora cancelada', 'A Aula Agora foi cancelada pelo prestador. O reembolso integral será processado.', 'booking', p_booking_id, 'STUDENT', 'details')
    ON CONFLICT (user_id, type, entity_type, entity_id)
      WHERE type IN ('BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'LESSON_COMPLETED', 'REVIEW_AVAILABLE')
    DO NOTHING;
  END IF;
$new$;
  IF position(v_old in v_definition) = 0 THEN
    RAISE EXCEPTION 'Bloco de notificação do finalize não encontrado.';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  EXECUTE v_definition;
END;
$$;
