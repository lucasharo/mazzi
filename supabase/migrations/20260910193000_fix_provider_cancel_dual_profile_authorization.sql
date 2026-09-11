-- MAZZI — Permite que um usuário com perfil de aluno e vínculo de PRO
-- cancele a Aula Agora atribuída ao seu próprio provider.
-- O vínculo com a reserva é a fonte de autorização do PRO; o papel legado
-- em public.users não pode transformar esse ator em aluno por engano.

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
  IF v_user_role = 'STUDENT' THEN
    PERFORM public.lock_student_profile(v_uid);
    PERFORM public.assert_current_user_student();
  END IF;
$old$;
  v_new := $new$
$new$;
  IF position(v_old in v_definition) = 0 THEN
    RAISE EXCEPTION 'Bloco de perfil do prepare não encontrado.';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $old$
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
$old$;
  v_new := $new$
  SELECT user_id, type::text INTO v_provider_user_id, v_provider_type
    FROM public.providers WHERE id = v_booking.provider_id;
  IF v_provider_user_id = v_uid AND v_provider_type = 'INSTRUCTOR' THEN
    v_cancelled_by := 'PROVIDER';
  ELSIF v_user_role = 'STUDENT' THEN
    PERFORM public.lock_student_profile(v_uid);
    PERFORM public.assert_current_user_student();
    IF v_booking.student_id <> v_uid THEN
      RAISE EXCEPTION 'UNAUTHORIZED_STUDENT' USING ERRCODE = '42501';
    END IF;
    v_cancelled_by := 'STUDENT';
  ELSIF v_user_role = 'INSTRUCTOR' THEN
    RAISE EXCEPTION 'UNAUTHORIZED_PROVIDER' USING ERRCODE = '42501';
  ELSIF v_user_role IN ('SCHOOL_ADMIN', 'DRIVING_SCHOOL') THEN
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
$new$;
  IF position(v_old in v_definition) = 0 THEN
    RAISE EXCEPTION 'Bloco de autorização do prepare não encontrado.';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

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
$old$;
  v_new := $new$
  SELECT user_id, type::text INTO v_provider_user_id, v_provider_type
    FROM public.providers WHERE id = v_booking.provider_id;
  IF v_provider_user_id = p_actor_id AND v_provider_type = 'INSTRUCTOR' THEN
    v_cancelled_by := 'PROVIDER';
  ELSIF v_user_role = 'STUDENT' THEN
    IF v_booking.student_id <> p_actor_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED_STUDENT' USING ERRCODE = '42501';
    END IF;
    v_cancelled_by := 'STUDENT';
  ELSIF v_user_role = 'INSTRUCTOR' THEN
    RAISE EXCEPTION 'UNAUTHORIZED_PROVIDER' USING ERRCODE = '42501';
  ELSIF v_user_role IN ('SCHOOL_ADMIN', 'DRIVING_SCHOOL') THEN
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
$new$;
  IF position(v_old in v_definition) = 0 THEN
    RAISE EXCEPTION 'Bloco de autorização do finalize não encontrado.';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  EXECUTE v_definition;
END;
$$;
