-- Reactivation is a request for Admin approval, not an immediate activation.
CREATE OR REPLACE FUNCTION public.provider_activate_vehicle(p_vehicle_id uuid)
RETURNS public.vehicles
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v public.vehicles; v_previous_status public.vehicle_status;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_current_user_active() THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  SELECT * INTO v FROM public.vehicles WHERE id=p_vehicle_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.providers p WHERE p.id=v.provider_id AND p.user_id=auth.uid()) THEN RAISE EXCEPTION 'VEHICLE_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  IF v.status <> 'INACTIVE' THEN RAISE EXCEPTION 'VEHICLE_ACTIVATION_INVALID' USING ERRCODE='22023'; END IF;
  v_previous_status := v.status;
  UPDATE public.vehicles SET status='ACTIVE', updated_at=now() WHERE id=p_vehicle_id RETURNING * INTO v;
  INSERT INTO public.audit_logs(id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at)
  VALUES(gen_random_uuid(), auth.uid(), 'VEHICLE_ACTIVATED', 'Vehicle', p_vehicle_id::text,
    jsonb_build_object('status', v_previous_status), jsonb_build_object('status', 'ACTIVE'), now());
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.provider_activate_vehicle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_activate_vehicle(uuid) TO authenticated, service_role;
