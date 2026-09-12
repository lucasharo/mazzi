BEGIN;

-- Reconcile TASK-089 hotfixes that were previously applied outside the
-- canonical migration ledger. The patch is intentionally idempotent so it is
-- a no-op in environments that already contain the corrected function while
-- still making a clean migration replay produce the same schema.
DO $migration$
DECLARE
  v_definition text;
  v_updated_definition text;
  v_self_booking_block text := E'  IF public.is_self_booking_context(v_quote.provider_id, v_quote.instructor_id) THEN\n    RAISE EXCEPTION ''SELF_BOOKING_NOT_ALLOWED'' USING ERRCODE = ''42501'';\n  END IF;\n';
  v_slot_check text := E'  IF NOT public.is_offering_slot_available(v_quote.offering_id, v_quote.scheduled_start_at) THEN\n    RAISE EXCEPTION ''SLOT_NO_LONGER_AVAILABLE'' USING ERRCODE = ''23P01'';\n  END IF;\n';
  v_actor_lock text := 'PERFORM pg_advisory_xact_lock(hashtextextended(''student-profile:'' || p_student_id::text, 0));';
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

  v_updated_definition := replace(
    v_definition,
    'PERFORM public.lock_student_profile(p_student_id);',
    v_actor_lock
  );
  v_updated_definition := replace(v_updated_definition, v_self_booking_block, '');
  v_updated_definition := replace(v_updated_definition, v_slot_check, '');

  IF strpos(v_updated_definition, v_actor_lock) = 0 THEN
    RAISE EXCEPTION 'INSTANT_BOOKING_HOLD_ACTOR_LOCK_RECONCILIATION_FAILED';
  END IF;
  IF strpos(v_updated_definition, 'SELF_BOOKING_NOT_ALLOWED') > 0 THEN
    RAISE EXCEPTION 'INSTANT_BOOKING_HOLD_SELF_BOOKING_RECONCILIATION_FAILED';
  END IF;
  IF strpos(v_updated_definition, v_slot_check) > 0 THEN
    RAISE EXCEPTION 'INSTANT_BOOKING_HOLD_SLOT_RECONCILIATION_FAILED';
  END IF;

  IF v_updated_definition <> v_definition THEN
    EXECUTE v_updated_definition;
  END IF;
END;
$migration$;

-- Atomically replace an equivalent active offering when the provider confirms
-- the change in the PRO application.
CREATE OR REPLACE FUNCTION public.provider_replace_active_service_offering(
  p_offering_id uuid
)
RETURNS public.service_offerings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_target public.service_offerings;
  v_previous public.service_offerings;
  v_result public.service_offerings;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_target
  FROM public.service_offerings
  WHERE id = p_offering_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OFFERING_NOT_FOUND' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.providers p
    WHERE p.id = v_target.provider_id
      AND (
        p.user_id = auth.uid()
        OR public.is_school_admin(v_target.provider_id)
        OR public.is_platform_admin()
      )
  ) THEN
    RAISE EXCEPTION 'OFFERING_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_previous
  FROM public.service_offerings
  WHERE id <> v_target.id
    AND provider_id = v_target.provider_id
    AND instructor_id = v_target.instructor_id
    AND vehicle_id = v_target.vehicle_id
    AND category = v_target.category
    AND transmission = v_target.transmission
    AND duration_minutes = 50
    AND status = 'ACTIVE'
  ORDER BY id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DUPLICATE_ACTIVE_OFFERING_NOT_FOUND' USING ERRCODE = '22023';
  END IF;

  UPDATE public.service_offerings
  SET is_active = false,
      status = 'INACTIVE',
      updated_at = now()
  WHERE id = v_previous.id;

  SELECT * INTO v_result
  FROM public.provider_save_service_offering(
    v_target.id,
    v_target.provider_id,
    v_target.instructor_id,
    v_target.vehicle_id,
    v_target.category,
    v_target.transmission,
    50,
    v_target.price_in_cents,
    true
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.provider_replace_active_service_offering(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_replace_active_service_offering(uuid) TO authenticated, service_role;

-- Require a numbered operational address for providers. The address picker
-- remains the source of normalized address data.
CREATE OR REPLACE FUNCTION public.update_provider_profile(
  p_provider_id uuid,
  p_name text DEFAULT NULL,
  p_public_contact text DEFAULT NULL,
  p_neighborhood text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_service_radius_km integer DEFAULT NULL,
  p_bio text DEFAULT NULL,
  p_postal_code text DEFAULT NULL,
  p_address jsonb DEFAULT NULL,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_legal_name text DEFAULT NULL,
  p_commercial_email text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_clean_name text;
  v_clean_contact text;
  v_clean_neighborhood text;
  v_clean_city text;
  v_clean_state text;
  v_clean_postal_code text;
  v_clean_bio text;
  v_clean_legal_name text;
  v_clean_commercial_email text;
  v_house_number text;
  v_location_mode text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Usuário não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT (public.is_provider_owner(p_provider_id) OR public.is_school_admin(p_provider_id)) THEN
    RAISE EXCEPTION 'PROVIDER_PROFILE_ACCESS_DENIED: Você não tem permissão para atualizar este perfil de prestador.'
      USING ERRCODE = '42501';
  END IF;

  IF (p_legal_name IS NOT NULL OR p_commercial_email IS NOT NULL)
    AND NOT public.is_school_admin(p_provider_id) THEN
    RAISE EXCEPTION 'SCHOOL_PROFILE_ACCESS_DENIED: Somente o administrador da autoescola pode atualizar os dados comerciais.'
      USING ERRCODE = '42501';
  END IF;

  IF p_name IS NOT NULL THEN
    v_clean_name := btrim(p_name);
    IF v_clean_name = '' THEN
      RAISE EXCEPTION 'PROVIDER_NAME_INVALID: O nome do prestador não pode ser vazio.' USING ERRCODE = '22000';
    END IF;
  END IF;

  IF p_public_contact IS NOT NULL THEN
    v_clean_contact := btrim(p_public_contact);
    IF v_clean_contact <> '' AND v_clean_contact !~ '^\d{10,11}$' THEN
      RAISE EXCEPTION 'PROVIDER_CONTACT_INVALID: O contato público deve conter 10 ou 11 dígitos numéricos.'
        USING ERRCODE = '22000';
    END IF;
    v_clean_contact := NULLIF(v_clean_contact, '');
  END IF;

  IF p_neighborhood IS NOT NULL THEN
    v_clean_neighborhood := NULLIF(btrim(p_neighborhood), '');
  END IF;

  IF p_city IS NOT NULL THEN
    v_clean_city := btrim(p_city);
    IF v_clean_city = '' THEN
      RAISE EXCEPTION 'PROVIDER_CITY_INVALID: A cidade do prestador não pode ser vazia.' USING ERRCODE = '22000';
    END IF;
  END IF;

  IF p_state IS NOT NULL THEN
    v_clean_state := upper(btrim(p_state));
    IF v_clean_state = '' OR v_clean_state !~ '^[A-Z]{2}$' THEN
      RAISE EXCEPTION 'PROVIDER_STATE_INVALID: O estado (UF) deve ter exatamente 2 letras.' USING ERRCODE = '22000';
    END IF;
  END IF;

  IF p_service_radius_km IS NOT NULL AND (p_service_radius_km < 1 OR p_service_radius_km > 100) THEN
    RAISE EXCEPTION 'SERVICE_RADIUS_INVALID: O raio de atendimento deve estar entre 1 e 100 km.' USING ERRCODE = '22000';
  END IF;

  IF p_bio IS NOT NULL THEN
    v_clean_bio := NULLIF(btrim(p_bio), '');
  END IF;
  IF p_postal_code IS NOT NULL THEN
    v_clean_postal_code := NULLIF(btrim(p_postal_code), '');
  END IF;
  IF p_latitude IS NOT NULL AND (p_latitude < -90 OR p_latitude > 90) THEN
    RAISE EXCEPTION 'PROVIDER_LATITUDE_INVALID' USING ERRCODE = '22000';
  END IF;
  IF p_longitude IS NOT NULL AND (p_longitude < -180 OR p_longitude > 180) THEN
    RAISE EXCEPTION 'PROVIDER_LONGITUDE_INVALID' USING ERRCODE = '22000';
  END IF;

  IF p_address IS NOT NULL THEN
    v_house_number := NULLIF(btrim(coalesce(p_address->>'houseNumber', '')), '');
    v_location_mode := upper(coalesce(NULLIF(btrim(p_address->>'locationMode'), ''), 'STANDARD_ADDRESS'));
    IF v_house_number IS NULL OR v_house_number ~* '^(NA|N/A|SN|S/N|SEM\s+N[UÚ]MERO)$' THEN
      RAISE EXCEPTION 'PROVIDER_ADDRESS_NUMBER_REQUIRED: O endereço operacional deve conter um número real.' USING ERRCODE = '22000';
    END IF;
    IF v_location_mode <> 'STANDARD_ADDRESS' OR lower(coalesce(p_address->>'noHouseNumber', 'false')) = 'true' THEN
      RAISE EXCEPTION 'PROVIDER_ADDRESS_NUMBER_REQUIRED: O endereço sem número não é aceito para profissionais.' USING ERRCODE = '22000';
    END IF;
  END IF;

  IF p_legal_name IS NOT NULL THEN
    v_clean_legal_name := btrim(p_legal_name);
    IF v_clean_legal_name = '' THEN
      RAISE EXCEPTION 'PROVIDER_LEGAL_NAME_INVALID' USING ERRCODE = '22000';
    END IF;
  END IF;

  IF p_commercial_email IS NOT NULL THEN
    v_clean_commercial_email := NULLIF(lower(btrim(p_commercial_email)), '');
    IF v_clean_commercial_email IS NOT NULL
      AND v_clean_commercial_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
      RAISE EXCEPTION 'PROVIDER_COMMERCIAL_EMAIL_INVALID' USING ERRCODE = '22000';
    END IF;
  END IF;

  UPDATE public.providers
  SET trade_name = COALESCE(v_clean_name, trade_name),
      public_contact = CASE WHEN p_public_contact IS NOT NULL THEN v_clean_contact ELSE public_contact END,
      neighborhood = CASE WHEN p_neighborhood IS NOT NULL THEN v_clean_neighborhood ELSE neighborhood END,
      city = COALESCE(v_clean_city, city),
      state = COALESCE(v_clean_state, state),
      postal_code = CASE WHEN p_postal_code IS NOT NULL THEN v_clean_postal_code ELSE postal_code END,
      address = CASE WHEN p_address IS NOT NULL THEN p_address ELSE address END,
      latitude = CASE WHEN p_latitude IS NOT NULL THEN p_latitude ELSE latitude END,
      longitude = CASE WHEN p_longitude IS NOT NULL THEN p_longitude ELSE longitude END,
      service_radius_km = COALESCE(p_service_radius_km, service_radius_km),
      bio = CASE WHEN p_bio IS NOT NULL THEN v_clean_bio ELSE bio END,
      legal_name = CASE WHEN p_legal_name IS NOT NULL THEN v_clean_legal_name ELSE legal_name END,
      commercial_email = CASE WHEN p_commercial_email IS NOT NULL THEN v_clean_commercial_email ELSE commercial_email END,
      updated_at = now()
  WHERE id = p_provider_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_provider_profile(
  uuid, text, text, text, text, text, integer, text,
  text, jsonb, double precision, double precision, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_provider_profile(
  uuid, text, text, text, text, text, integer, text,
  text, jsonb, double precision, double precision, text, text
) TO authenticated;

COMMIT;
