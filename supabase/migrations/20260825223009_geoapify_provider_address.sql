-- MAZZI — Canonical Geoapify provider address persistence
-- Forward-only DEV migration. Exact latitude/longitude remain private.

ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS address jsonb,
  ADD COLUMN IF NOT EXISTS postal_code text;

DROP FUNCTION IF EXISTS public.update_provider_profile(uuid, text, text, text, text, text, integer, text);

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
  p_longitude double precision DEFAULT NULL
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
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Usuário não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT (public.is_provider_owner(p_provider_id) OR public.is_school_admin(p_provider_id)) THEN
    RAISE EXCEPTION 'PROVIDER_PROFILE_ACCESS_DENIED: Você não tem permissão para atualizar este perfil de prestador.' USING ERRCODE = '42501';
  END IF;

  IF p_name IS NOT NULL THEN
    v_clean_name := trim(p_name);
    IF v_clean_name = '' THEN
      RAISE EXCEPTION 'PROVIDER_NAME_INVALID: O nome do prestador não pode ser vazio.' USING ERRCODE = '22000';
    END IF;
  END IF;
  IF p_public_contact IS NOT NULL THEN
    v_clean_contact := trim(p_public_contact);
    IF v_clean_contact <> '' AND NOT (v_clean_contact ~ '^\d{10,11}$') THEN
      RAISE EXCEPTION 'PROVIDER_CONTACT_INVALID: O contato público deve conter 10 ou 11 dígitos numéricos.' USING ERRCODE = '22000';
    END IF;
    IF v_clean_contact = '' THEN v_clean_contact := NULL; END IF;
  END IF;
  IF p_neighborhood IS NOT NULL THEN
    v_clean_neighborhood := NULLIF(trim(p_neighborhood), '');
  END IF;
  IF p_city IS NOT NULL THEN
    v_clean_city := trim(p_city);
    IF v_clean_city = '' THEN
      RAISE EXCEPTION 'PROVIDER_CITY_INVALID: A cidade do prestador não pode ser vazia.' USING ERRCODE = '22000';
    END IF;
  END IF;
  IF p_state IS NOT NULL THEN
    v_clean_state := upper(trim(p_state));
    IF v_clean_state = '' OR NOT (v_clean_state ~ '^[A-Z]{2}$') THEN
      RAISE EXCEPTION 'PROVIDER_STATE_INVALID: O estado (UF) deve ter exatamente 2 letras.' USING ERRCODE = '22000';
    END IF;
  END IF;
  IF p_service_radius_km IS NOT NULL AND (p_service_radius_km < 1 OR p_service_radius_km > 100) THEN
    RAISE EXCEPTION 'SERVICE_RADIUS_INVALID: O raio de atendimento deve estar entre 1 e 100 km.' USING ERRCODE = '22000';
  END IF;
  IF p_bio IS NOT NULL THEN v_clean_bio := NULLIF(trim(p_bio), ''); END IF;
  IF p_postal_code IS NOT NULL THEN v_clean_postal_code := NULLIF(trim(p_postal_code), ''); END IF;
  IF p_latitude IS NOT NULL AND (p_latitude < -90 OR p_latitude > 90) THEN
    RAISE EXCEPTION 'PROVIDER_LATITUDE_INVALID' USING ERRCODE = '22000';
  END IF;
  IF p_longitude IS NOT NULL AND (p_longitude < -180 OR p_longitude > 180) THEN
    RAISE EXCEPTION 'PROVIDER_LONGITUDE_INVALID' USING ERRCODE = '22000';
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
      updated_at = now()
  WHERE id = p_provider_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_provider_profile(uuid, text, text, text, text, text, integer, text, text, jsonb, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_provider_profile(uuid, text, text, text, text, text, integer, text, text, jsonb, double precision, double precision) TO authenticated;
