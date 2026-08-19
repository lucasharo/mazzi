-- ============================================================================
-- MAZZI PLATFORM — SPRINT 18: SECURE PROVIDER PROFILE UPDATE RPC
-- Migration: 20260818000046_update_provider_profile_rpc.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_provider_profile(
  p_provider_id UUID,
  p_name TEXT DEFAULT NULL,
  p_public_contact TEXT DEFAULT NULL,
  p_neighborhood TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_service_radius_km INTEGER DEFAULT NULL,
  p_bio TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID;
  v_clean_name TEXT;
  v_clean_contact TEXT;
  v_clean_neighborhood TEXT;
  v_clean_city TEXT;
  v_clean_state TEXT;
  v_clean_bio TEXT;
BEGIN
  -- 1. Authentication Check
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Usuário não autenticado.' USING ERRCODE = '28000';
  END IF;

  -- 2. Authorization Check (Provider Owner OR Driving School Admin)
  IF NOT (
    public.is_provider_owner(p_provider_id)
    OR public.is_school_admin(p_provider_id)
  ) THEN
    RAISE EXCEPTION 'PROVIDER_PROFILE_ACCESS_DENIED: Você não tem permissão para atualizar este perfil de prestador.' USING ERRCODE = '42501';
  END IF;

  -- 3. Input Validation & Normalization
  -- trade_name (p_name): NOT NULL in schema
  IF p_name IS NOT NULL THEN
    v_clean_name := trim(p_name);
    IF v_clean_name = '' THEN
      RAISE EXCEPTION 'PROVIDER_NAME_INVALID: O nome do prestador não pode ser vazio.' USING ERRCODE = '22000';
    END IF;
  END IF;

  -- public_contact: Optional/Nullable
  IF p_public_contact IS NOT NULL THEN
    v_clean_contact := trim(p_public_contact);
    IF v_clean_contact <> '' THEN
      IF NOT (v_clean_contact ~ '^\d{10,11}$') THEN
        RAISE EXCEPTION 'PROVIDER_CONTACT_INVALID: O contato público deve conter 10 ou 11 dígitos numéricos.' USING ERRCODE = '22000';
      END IF;
    ELSE
      v_clean_contact := NULL;
    END IF;
  END IF;

  -- neighborhood: Optional/Nullable
  IF p_neighborhood IS NOT NULL THEN
    v_clean_neighborhood := trim(p_neighborhood);
    IF v_clean_neighborhood = '' THEN
      v_clean_neighborhood := NULL;
    END IF;
  END IF;

  -- city: NOT NULL in schema
  IF p_city IS NOT NULL THEN
    v_clean_city := trim(p_city);
    IF v_clean_city = '' THEN
      RAISE EXCEPTION 'PROVIDER_CITY_INVALID: A cidade do prestador não pode ser vazia.' USING ERRCODE = '22000';
    END IF;
  END IF;

  -- state: NOT NULL in schema (must be 2 uppercase letters)
  IF p_state IS NOT NULL THEN
    v_clean_state := upper(trim(p_state));
    IF v_clean_state = '' OR NOT (v_clean_state ~ '^[A-Z]{2}$') THEN
      RAISE EXCEPTION 'PROVIDER_STATE_INVALID: O estado (UF) deve ter exatamente 2 letras.' USING ERRCODE = '22000';
    END IF;
  END IF;

  -- service_radius_km: 1 to 100
  IF p_service_radius_km IS NOT NULL THEN
    IF p_service_radius_km < 1 OR p_service_radius_km > 100 THEN
      RAISE EXCEPTION 'SERVICE_RADIUS_INVALID: O raio de atendimento deve estar entre 1 e 100 km.' USING ERRCODE = '22000';
    END IF;
  END IF;

  -- bio: Optional/Nullable
  IF p_bio IS NOT NULL THEN
    v_clean_bio := trim(p_bio);
    IF v_clean_bio = '' THEN
      v_clean_bio := NULL;
    END IF;
  END IF;

  -- 4. Execute Update (Modifying ONLY allowed columns, trade_name instead of name)
  UPDATE public.providers
  SET
    trade_name = COALESCE(v_clean_name, trade_name),
    public_contact = CASE WHEN p_public_contact IS NOT NULL THEN v_clean_contact ELSE public_contact END,
    neighborhood = CASE WHEN p_neighborhood IS NOT NULL THEN v_clean_neighborhood ELSE neighborhood END,
    city = COALESCE(v_clean_city, city),
    state = COALESCE(v_clean_state, state),
    service_radius_km = COALESCE(p_service_radius_km, service_radius_km),
    bio = CASE WHEN p_bio IS NOT NULL THEN v_clean_bio ELSE bio END,
    updated_at = NOW()
  WHERE id = p_provider_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_provider_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_provider_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_provider_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT) TO authenticated, service_role;
