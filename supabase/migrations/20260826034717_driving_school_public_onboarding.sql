-- MAZZI — public, idempotent driving-school/CFC onboarding.
-- The authenticated human remains the only Auth identity and becomes the
-- school's SCHOOL_ADMIN. No browser supplied user_id, school_id or role is
-- accepted by this contract.

ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS commercial_email text;

CREATE OR REPLACE FUNCTION public.validate_cnpj(p_value text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_digits text := regexp_replace(coalesce(p_value, ''), '\\D', '', 'g');
  v_weights integer[] := ARRAY[5,4,3,2,9,8,7,6,5,4,3,2];
  v_sum integer := 0;
  v_index integer;
  v_digit integer;
  v_expected integer;
BEGIN
  IF length(v_digits) <> 14 OR v_digits ~ '^(.)\\1{13}$' THEN RETURN false; END IF;
  FOR v_index IN 1..12 LOOP
    v_sum := v_sum + substring(v_digits, v_index, 1)::integer * v_weights[v_index];
  END LOOP;
  v_expected := CASE WHEN v_sum % 11 < 2 THEN 0 ELSE 11 - (v_sum % 11) END;
  IF substring(v_digits, 13, 1)::integer <> v_expected THEN RETURN false; END IF;
  v_sum := 0;
  v_weights := ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2];
  FOR v_index IN 1..13 LOOP
    v_sum := v_sum + substring(v_digits, v_index, 1)::integer * v_weights[v_index];
  END LOOP;
  v_expected := CASE WHEN v_sum % 11 < 2 THEN 0 ELSE 11 - (v_sum % 11) END;
  RETURN substring(v_digits, 14, 1)::integer = v_expected;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_cnpj(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.onboard_my_driving_school(
  p_cnpj text,
  p_legal_name text,
  p_trade_name text,
  p_phone text,
  p_commercial_email text,
  p_postal_code text,
  p_address jsonb,
  p_latitude double precision,
  p_longitude double precision
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user public.users%ROWTYPE;
  v_school public.providers%ROWTYPE;
  v_cnpj text := regexp_replace(coalesce(p_cnpj, ''), '\\D', '', 'g');
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\\D', '', 'g');
  v_email text := lower(btrim(coalesce(p_commercial_email, '')));
  v_postal_code text := regexp_replace(coalesce(p_postal_code, ''), '\\D', '', 'g');
  v_state text := upper(btrim(coalesce(p_address->>'stateCode', p_address->>'state', '')));
  v_city text := btrim(coalesce(p_address->>'city', ''));
  v_neighborhood text := nullif(btrim(coalesce(p_address->>'neighborhood', '')), '');
  v_source text := upper(btrim(coalesce(p_address->>'source', '')));
  v_created boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;

  SELECT * INTO v_user FROM public.users WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND OR v_user.status <> 'ACTIVE'::public.user_status THEN
    RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE = '42501';
  END IF;
  IF NOT public.validate_cnpj(v_cnpj) THEN RAISE EXCEPTION 'CNPJ_INVALID' USING ERRCODE = '22023'; END IF;
  IF nullif(btrim(p_legal_name), '') IS NULL OR nullif(btrim(p_trade_name), '') IS NULL THEN
    RAISE EXCEPTION 'SCHOOL_NAME_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF v_phone !~ '^\\d{10,11}$' THEN RAISE EXCEPTION 'SCHOOL_PHONE_INVALID' USING ERRCODE = '22023'; END IF;
  IF v_email = '' OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'SCHOOL_EMAIL_INVALID' USING ERRCODE = '22023';
  END IF;
  IF v_postal_code !~ '^\\d{8}$' OR v_city = '' OR v_state !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'SCHOOL_ADDRESS_INVALID' USING ERRCODE = '22023';
  END IF;
  IF v_source NOT IN ('GEOAPIFY', 'MAP_PIN') OR coalesce((p_address->>'locationConfirmed')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'SCHOOL_LOCATION_NOT_CONFIRMED' USING ERRCODE = '22023';
  END IF;
  IF p_latitude IS NULL OR p_latitude NOT BETWEEN -90 AND 90 OR p_longitude IS NULL OR p_longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'SCHOOL_LOCATION_INVALID' USING ERRCODE = '22023';
  END IF;

  -- Serializes retries and double clicks for the same legal entity.
  PERFORM pg_advisory_xact_lock(hashtextextended('driving-school-cnpj:' || v_cnpj, 0));
  SELECT * INTO v_school
  FROM public.providers
  WHERE type = 'DRIVING_SCHOOL'::public.provider_type AND document_number = v_cnpj
  FOR UPDATE;

  IF FOUND THEN
    IF v_school.user_id IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'CNPJ_ALREADY_REGISTERED' USING ERRCODE = '23505';
    END IF;
  ELSE
    INSERT INTO public.providers (
      user_id, type, legal_name, trade_name, document_number, status,
      phone, public_contact, commercial_email, city, state, neighborhood, postal_code,
      address, latitude, longitude, service_radius_km
    ) VALUES (
      v_uid, 'DRIVING_SCHOOL'::public.provider_type, btrim(p_legal_name),
      btrim(p_trade_name), v_cnpj, 'DRAFT'::public.provider_status,
      v_phone, v_phone, v_email, v_city, v_state, v_neighborhood, v_postal_code,
      p_address, p_latitude,
      p_longitude, 8
    ) RETURNING * INTO v_school;
    v_created := true;
  END IF;

  -- Adds capabilities without removing the existing STUDENT/INSTRUCTOR roles.
  INSERT INTO public.user_roles(user_id, role, granted_by)
  VALUES (v_uid, 'SCHOOL_ADMIN'::public.user_role, v_uid)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.driving_school_staff(
    school_id, user_id, role, is_active, membership_status, accepted_at
  ) VALUES (
    v_school.id, v_uid, 'SCHOOL_ADMIN'::public.user_role, true,
    'ACTIVE'::public.school_membership_status, now()
  )
  ON CONFLICT (school_id, user_id) DO UPDATE
    SET role = 'SCHOOL_ADMIN'::public.user_role,
        membership_status = 'ACTIVE'::public.school_membership_status,
        is_active = true,
        accepted_at = coalesce(public.driving_school_staff.accepted_at, excluded.accepted_at),
        updated_at = now();

  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, previous_value, new_value)
  VALUES (
    v_uid, 'DRIVING_SCHOOL_ONBOARDING_COMPLETED', 'Provider', v_school.id::text,
    jsonb_build_object('created', v_created),
    jsonb_build_object('provider_type', 'DRIVING_SCHOOL', 'provider_status', v_school.status, 'school_admin_user_id', v_uid)
  );

  RETURN jsonb_build_object(
    'success', true,
    'is_idempotent', NOT v_created,
    'provider_id', v_school.id,
    'provider_status', v_school.status,
    'role', 'SCHOOL_ADMIN'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.onboard_my_driving_school(text, text, text, text, text, text, jsonb, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.onboard_my_driving_school(text, text, text, text, text, text, jsonb, double precision, double precision) TO authenticated;
