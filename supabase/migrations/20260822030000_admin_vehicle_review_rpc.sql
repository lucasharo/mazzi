-- MAZZI — Admin vehicle review workflow
-- Centralizes vehicle approval/rejection/blocking with RBAC and audit logging.

CREATE OR REPLACE FUNCTION public.review_vehicle(
  p_vehicle_id UUID,
  p_status public.vehicle_status,
  p_reason TEXT DEFAULT NULL
)
RETURNS public.vehicles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_previous public.vehicles;
  v_updated public.vehicles;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('ACTIVE', 'INACTIVE', 'BLOCKED') THEN
    RAISE EXCEPTION 'INVALID_VEHICLE_REVIEW_STATUS' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_previous
  FROM public.vehicles
  WHERE id = p_vehicle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VEHICLE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.vehicles
  SET status = p_status,
      updated_at = now()
  WHERE id = p_vehicle_id
  RETURNING * INTO v_updated;

  INSERT INTO public.audit_logs (
    id, actor_id, action, entity_type, entity_id,
    previous_value, new_value, created_at
  ) VALUES (
    gen_random_uuid(), v_uid, 'REVIEW_VEHICLE', 'Vehicle', p_vehicle_id::text,
    jsonb_build_object('status', v_previous.status, 'reason', NULL),
    jsonb_build_object('status', p_status, 'reason', NULLIF(btrim(p_reason), '')),
    now()
  );

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.review_vehicle(UUID, public.vehicle_status, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_vehicle(UUID, public.vehicle_status, TEXT) TO authenticated;
