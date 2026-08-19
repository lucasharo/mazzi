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
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Usuário não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.providers p
    WHERE p.id = p_provider_id
      AND (p.user_id = v_uid OR EXISTS (
        SELECT 1 FROM public.driving_school_staff s
        WHERE s.school_id = p.id AND s.user_id = v_uid
          AND s.is_active = true AND s.role IN ('OWNER', 'SCHOOL_ADMIN')
      ))
  ) THEN
    RAISE EXCEPTION 'PROVIDER_PROFILE_ACCESS_DENIED: Você não tem permissão para atualizar este perfil de prestador.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.providers
  SET
    name = COALESCE(NULLIF(trim(p_name), ''), name),
    public_contact = COALESCE(NULLIF(trim(p_public_contact), ''), public_contact),
    neighborhood = COALESCE(NULLIF(trim(p_neighborhood), ''), neighborhood),
    city = COALESCE(NULLIF(trim(p_city), ''), city),
    state = COALESCE(NULLIF(trim(p_state), ''), state),
    service_radius_km = CASE
      WHEN p_service_radius_km IS NOT NULL AND p_service_radius_km >= 1 AND p_service_radius_km <= 100
      THEN p_service_radius_km
      ELSE service_radius_km
    END,
    bio = COALESCE(p_bio, bio),
    updated_at = NOW()
  WHERE id = p_provider_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_provider_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_provider_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_provider_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT) TO authenticated, service_role;
