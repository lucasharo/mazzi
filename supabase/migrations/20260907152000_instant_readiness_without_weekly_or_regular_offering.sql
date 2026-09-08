-- Aula Agora tem requisitos próprios. Ela não depende da agenda semanal nem
-- de uma oferta regular ativa; depende da configuração instantânea do carro.
CREATE OR REPLACE FUNCTION public.is_provider_instructor_instant_ready(
  p_provider_id UUID,
  p_instructor_id UUID,
  p_category public.vehicle_category DEFAULT 'B'
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.providers p
    JOIN public.users u ON u.id = p_instructor_id AND u.status = 'ACTIVE'
    WHERE p.id = p_provider_id
      AND p.status = 'ACTIVE'
      AND (u.role = 'INSTRUCTOR' OR EXISTS (
        SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id AND ur.role = 'INSTRUCTOR'
      ))
      AND public.is_instructor_global_compliance_valid(p_instructor_id, p_category)
      AND (
        (p.type = 'INSTRUCTOR' AND p.user_id = p_instructor_id)
        OR (p.type = 'DRIVING_SCHOOL' AND EXISTS (
          SELECT 1 FROM public.driving_school_staff dss
          WHERE dss.school_id = p.id AND dss.user_id = p_instructor_id
            AND dss.role = 'INSTRUCTOR' AND dss.membership_status = 'ACTIVE' AND dss.is_active IS TRUE
            AND public.is_membership_compliance_valid(dss.id, p_category)
        ))
      )
      AND EXISTS (
        SELECT 1 FROM public.provider_payment_accounts ppa
        WHERE ppa.provider_id = p.id AND ppa.gateway = 'STRIPE' AND ppa.status = 'ACTIVE'
          AND ppa.charges_enabled IS TRUE AND ppa.payouts_enabled IS TRUE
          AND NULLIF(BTRIM(ppa.external_account_id), '') IS NOT NULL
      )
      AND EXISTS (
        SELECT 1
        FROM public.provider_instant_settings s
        JOIN public.service_offerings o ON o.id = s.offering_id AND o.instructor_id = p_instructor_id
        JOIN public.vehicles v ON v.id = o.vehicle_id AND v.provider_id = p.id
        WHERE s.provider_id = p.id AND s.instant_enabled IS TRUE
          AND v.status = 'ACTIVE' AND v.deleted_at IS NULL AND v.category = p_category
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_provider_instructor_instant_ready(UUID, UUID, public.vehicle_category) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_provider_instructor_instant_ready(UUID, UUID, public.vehicle_category) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_my_instant_instructor_online(
  p_provider_id UUID, p_instructor_id UUID, p_online BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_online BOOLEAN := COALESCE(p_online, FALSE);
  v_online_since TIMESTAMPTZ;
  v_online_expires_at TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_instructor_id THEN
    RAISE EXCEPTION 'INSTANT_INSTRUCTOR_SELF_ONLY' USING ERRCODE = '42501';
  END IF;
  IF NOT public.instant_is_provider_member(p_provider_id, auth.uid()) THEN
    RAISE EXCEPTION 'INSTANT_PROVIDER_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF v_online AND NOT public.is_provider_instructor_instant_ready(
    p_provider_id, p_instructor_id, 'B'::public.vehicle_category
  ) THEN
    RAISE EXCEPTION 'INSTANT_INSTRUCTOR_NOT_MARKETPLACE_READY' USING ERRCODE = '42501';
  END IF;
  IF v_online THEN
    v_online_since := NOW();
    v_online_expires_at := v_online_since + INTERVAL '1 hour';
  END IF;

  INSERT INTO public.provider_instant_instructor_status (
    provider_id, instructor_id, instant_online, online_since, online_expires_at, updated_at
  ) VALUES (
    p_provider_id, p_instructor_id, v_online, v_online_since, v_online_expires_at, NOW()
  )
  ON CONFLICT (provider_id, instructor_id) DO UPDATE SET
    instant_online = EXCLUDED.instant_online,
    online_since = EXCLUDED.online_since,
    online_expires_at = EXCLUDED.online_expires_at,
    updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object('success', TRUE, 'provider_id', p_provider_id,
    'instructor_id', p_instructor_id, 'instant_online', v_online,
    'online_since', v_online_since, 'online_expires_at', v_online_expires_at);
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_instant_instructor_online(UUID, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_instant_instructor_online(UUID, UUID, BOOLEAN) TO authenticated, service_role;
