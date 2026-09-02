ALTER TABLE public.booking_disputes ALTER COLUMN response_due_at SET DEFAULT (NOW() + INTERVAL '72 hours');

CREATE OR REPLACE FUNCTION public.update_contestation_response_hours(p_hours NUMERIC)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
BEGIN
  IF NOT public.current_user_has_permission('admin.platform.manage_settings'::public.app_permission) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF p_hours IS NULL OR p_hours < 1 OR p_hours > 720 THEN RAISE EXCEPTION 'INVALID_CONTESTATION_RESPONSE_HOURS' USING ERRCODE='22023'; END IF;
  INSERT INTO public.platform_configurations(key,value,updated_by,updated_at)
  VALUES ('platform_operations',jsonb_build_object('contestation_response_hours',p_hours),auth.uid(),NOW())
  ON CONFLICT ON CONSTRAINT platform_configurations_key_key DO UPDATE SET value=public.platform_configurations.value || excluded.value,updated_by=auth.uid(),updated_at=NOW();
END; $$;
REVOKE ALL ON FUNCTION public.update_contestation_response_hours(NUMERIC) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_contestation_response_hours(NUMERIC) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_contestation_response_deadline()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
DECLARE v_hours NUMERIC;
BEGIN
  SELECT COALESCE((value->>'contestation_response_hours')::NUMERIC,72) INTO v_hours FROM public.platform_configurations WHERE key='platform_operations';
  NEW.response_due_at := NOW() + make_interval(hours => v_hours::INTEGER);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_set_contestation_response_deadline ON public.booking_disputes;
CREATE TRIGGER trg_set_contestation_response_deadline BEFORE INSERT ON public.booking_disputes FOR EACH ROW EXECUTE FUNCTION public.set_contestation_response_deadline();
