-- Aula Agora só pode ser publicada depois que o instrutor estiver 100% pronto
-- para aparecer no marketplace. A configuração do veículo continua permitida;
-- esta trava se aplica apenas à publicação (instant_online = TRUE).
CREATE OR REPLACE FUNCTION public.set_my_instant_instructor_online(
  p_provider_id UUID, p_instructor_id UUID, p_online BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_online BOOLEAN := COALESCE(p_online, FALSE);
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_instructor_id THEN
    RAISE EXCEPTION 'INSTANT_INSTRUCTOR_SELF_ONLY' USING ERRCODE = '42501';
  END IF;
  IF NOT public.instant_is_provider_member(p_provider_id, auth.uid()) THEN
    RAISE EXCEPTION 'INSTANT_PROVIDER_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF v_online AND NOT public.is_provider_instructor_marketplace_ready(
    p_provider_id, p_instructor_id, 'B'::public.vehicle_category
  ) THEN
    RAISE EXCEPTION 'INSTANT_INSTRUCTOR_NOT_MARKETPLACE_READY' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.provider_instant_instructor_status (provider_id, instructor_id, instant_online, updated_at)
  VALUES (p_provider_id, p_instructor_id, v_online, NOW())
  ON CONFLICT (provider_id, instructor_id) DO UPDATE
    SET instant_online = EXCLUDED.instant_online, updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object(
    'success', TRUE,
    'provider_id', p_provider_id,
    'instructor_id', p_instructor_id,
    'instant_online', v_online
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_instant_instructor_online(UUID, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_instant_instructor_online(UUID, UUID, BOOLEAN) TO authenticated, service_role;
