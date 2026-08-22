-- MAZZI — TASK-076: safe instructor onboarding and verified security cleanup
-- Forward-only. The client never supplies a role, provider id, or tenant id.

CREATE OR REPLACE FUNCTION public.onboard_my_instructor()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_user public.users%ROWTYPE;
  v_provider public.providers%ROWTYPE;
  v_role_added BOOLEAN := FALSE;
  v_role_inserted_count INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_user
  FROM public.users
  WHERE id = v_uid
  FOR UPDATE;

  IF NOT FOUND OR v_user.status <> 'ACTIVE'::public.user_status THEN
    RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE = '42501';
  END IF;
  IF v_user.cpf IS NULL OR NOT public.validate_cpf(v_user.cpf) THEN
    RAISE EXCEPTION 'CPF_REQUIRED_OR_INVALID' USING ERRCODE = '22023';
  END IF;
  IF v_user.birth_date IS NULL OR v_user.birth_date > (CURRENT_DATE - INTERVAL '18 years') THEN
    RAISE EXCEPTION 'MINIMUM_AGE_VIOLATION' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(BTRIM(v_user.phone), '') IS NULL THEN
    RAISE EXCEPTION 'PHONE_REQUIRED' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_roles(user_id, role, granted_by)
  VALUES (v_uid, 'INSTRUCTOR'::public.user_role, v_uid)
  ON CONFLICT (user_id, role) DO NOTHING;
  GET DIAGNOSTICS v_role_inserted_count = ROW_COUNT;
  v_role_added := v_role_inserted_count > 0;

  SELECT * INTO v_provider
  FROM public.providers
  WHERE user_id = v_uid AND type = 'INSTRUCTOR'::public.provider_type
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.providers (
      user_id, type, legal_name, trade_name, document_number, status,
      phone, city, state
    ) VALUES (
      v_uid, 'INSTRUCTOR'::public.provider_type, v_user.name, v_user.name,
      v_user.cpf, 'DRAFT'::public.provider_status, v_user.phone, 'São Paulo', 'SP'
    )
    RETURNING * INTO v_provider;
  END IF;

  INSERT INTO public.audit_logs (
    actor_id, action, entity_type, entity_id, previous_value, new_value
  ) VALUES (
    v_uid, 'INSTRUCTOR_ONBOARDING_COMPLETED', 'USER', v_uid::TEXT,
    jsonb_build_object('instructor_role', FALSE),
    jsonb_build_object('instructor_role', TRUE, 'provider_id', v_provider.id, 'provider_status', v_provider.status)
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'role', 'INSTRUCTOR',
    'role_added', v_role_added,
    'provider_id', v_provider.id,
    'provider_status', v_provider.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.onboard_my_instructor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.onboard_my_instructor() TO authenticated;

-- Preserve behavior while fixing mutable search_path findings.
ALTER FUNCTION public.validate_cpf(TEXT) SET search_path TO public, pg_temp;
ALTER FUNCTION public.trigger_validate_user_student_identity() SET search_path TO public, pg_temp;

-- Advisor-confirmed duplicate definitions; the retained names are used by the
-- current application and keep the index coverage unchanged.
DROP INDEX IF EXISTS public.idx_messages_conversation_dates;
DROP INDEX IF EXISTS public.idx_offerings_vehicle;
