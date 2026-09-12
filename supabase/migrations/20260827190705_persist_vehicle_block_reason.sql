BEGIN;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS blocked_reason text;

UPDATE public.vehicles v
SET blocked_reason = NULLIF(btrim((a.new_value->>'reason')), '')
FROM public.audit_logs a
WHERE v.status = 'BLOCKED'
  AND v.blocked_reason IS NULL
  AND a.entity_type = 'Vehicle'
  AND a.entity_id = v.id::text
  AND a.action = 'REVIEW_VEHICLE'
  AND a.new_value->>'status' = 'BLOCKED';

CREATE OR REPLACE FUNCTION public.review_vehicle(
  p_vehicle_id uuid, p_status public.vehicle_status, p_reason text DEFAULT NULL)
RETURNS public.vehicles
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_uid uuid := auth.uid(); v_previous public.vehicles; v_updated public.vehicles;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000'; END IF;
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF p_status NOT IN ('ACTIVE','INACTIVE','BLOCKED') THEN RAISE EXCEPTION 'INVALID_VEHICLE_REVIEW_STATUS' USING ERRCODE='22023'; END IF;
  IF p_status = 'BLOCKED' AND NULLIF(btrim(p_reason), '') IS NULL THEN RAISE EXCEPTION 'MISSING_REASON' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_previous FROM public.vehicles WHERE id=p_vehicle_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'VEHICLE_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  UPDATE public.vehicles
  SET status=p_status,
      blocked_reason=CASE WHEN p_status='BLOCKED' THEN NULLIF(btrim(p_reason), '') ELSE NULL END,
      updated_at=now()
  WHERE id=p_vehicle_id RETURNING * INTO v_updated;
  INSERT INTO public.audit_logs(id,actor_id,action,entity_type,entity_id,previous_value,new_value,created_at)
  VALUES(gen_random_uuid(),v_uid,'REVIEW_VEHICLE','Vehicle',p_vehicle_id::text,
    jsonb_build_object('status',v_previous.status,'reason',v_previous.blocked_reason),
    jsonb_build_object('status',p_status,'reason',NULLIF(btrim(p_reason),'')),now());
  RETURN v_updated;
END;
$$;

COMMIT;
