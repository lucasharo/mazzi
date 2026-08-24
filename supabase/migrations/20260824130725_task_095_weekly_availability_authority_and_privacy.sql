-- TASK-095: authoritative weekly availability mutations and raw schedule privacy.

CREATE OR REPLACE FUNCTION public.validate_availability_resource_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_provider public.providers;
BEGIN
  SELECT * INTO v_provider FROM public.providers WHERE id = NEW.provider_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'AVAILABILITY_PROVIDER_NOT_FOUND' USING ERRCODE='23503'; END IF;

  IF NEW.vehicle_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.id=NEW.vehicle_id AND v.provider_id=NEW.provider_id AND v.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'AVAILABILITY_VEHICLE_SCOPE_INVALID' USING ERRCODE='23514';
  END IF;

  IF NEW.instructor_id IS NOT NULL AND (
    (v_provider.type='INSTRUCTOR'::public.provider_type AND NEW.instructor_id<>v_provider.user_id)
    OR
    (v_provider.type='DRIVING_SCHOOL'::public.provider_type AND NOT EXISTS (
      SELECT 1 FROM public.driving_school_staff dss
      WHERE dss.school_id=NEW.provider_id AND dss.user_id=NEW.instructor_id
        AND dss.role='INSTRUCTOR'::public.user_role
        AND dss.membership_status='ACTIVE'::public.school_membership_status
        AND dss.is_active IS TRUE
    ))
  ) THEN
    RAISE EXCEPTION 'AVAILABILITY_INSTRUCTOR_SCOPE_INVALID' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_availabilities_resource_scope ON public.availabilities;
CREATE TRIGGER trg_availabilities_resource_scope
BEFORE INSERT OR UPDATE ON public.availabilities
FOR EACH ROW EXECUTE FUNCTION public.validate_availability_resource_scope();

CREATE OR REPLACE FUNCTION public.provider_save_availability_rule(
  p_id uuid DEFAULT NULL,
  p_provider_id uuid DEFAULT NULL,
  p_instructor_id uuid DEFAULT NULL,
  p_vehicle_id uuid DEFAULT NULL,
  p_day_of_week integer DEFAULT NULL,
  p_start_time time DEFAULT NULL,
  p_end_time time DEFAULT NULL,
  p_timezone text DEFAULT 'America/Sao_Paulo',
  p_is_active boolean DEFAULT true
)
RETURNS public.availabilities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v public.availabilities;
  v_provider_id uuid := p_provider_id;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000'; END IF;
  IF NOT public.is_current_user_active() THEN RAISE EXCEPTION 'INACTIVE_USER' USING ERRCODE='42501'; END IF;
  IF v_provider_id IS NULL OR NOT public.can_manage_provider_schedule(v_provider_id) THEN
    RAISE EXCEPTION 'AVAILABILITY_PROVIDER_ACCESS_DENIED' USING ERRCODE='42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('provider-schedule:' || v_provider_id::text, 0));
  IF p_id IS NOT NULL THEN
    SELECT * INTO v FROM public.availabilities WHERE id=p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'AVAILABILITY_NOT_FOUND' USING ERRCODE='P0002'; END IF;
    IF v.provider_id IS DISTINCT FROM v_provider_id THEN
      RAISE EXCEPTION 'AVAILABILITY_PROVIDER_IMMUTABLE' USING ERRCODE='42501';
    END IF;
  END IF;
  IF p_day_of_week IS NULL OR p_day_of_week < 0 OR p_day_of_week > 6 THEN
    RAISE EXCEPTION 'AVAILABILITY_DAY_INVALID' USING ERRCODE='22023';
  END IF;
  IF p_start_time IS NULL OR p_end_time IS NULL
     OR extract(minute from p_start_time) <> 0 OR extract(second from p_start_time) <> 0
     OR extract(minute from p_end_time) <> 0 OR extract(second from p_end_time) <> 0 THEN
    RAISE EXCEPTION 'AVAILABILITY_FULL_HOUR_REQUIRED' USING ERRCODE='22023';
  END IF;
  IF p_start_time >= p_end_time THEN
    RAISE EXCEPTION 'AVAILABILITY_TIME_RANGE_INVALID' USING ERRCODE='22023';
  END IF;
  IF p_timezone IS NULL OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name=p_timezone) THEN
    RAISE EXCEPTION 'AVAILABILITY_TIMEZONE_INVALID' USING ERRCODE='22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.availabilities a
    WHERE a.provider_id=v_provider_id
      AND a.id IS DISTINCT FROM p_id
      AND a.instructor_id IS NOT DISTINCT FROM p_instructor_id
      AND a.vehicle_id IS NOT DISTINCT FROM p_vehicle_id
      AND a.day_of_week=p_day_of_week
      AND a.start_time=p_start_time AND a.end_time=p_end_time
      AND a.timezone=p_timezone AND a.is_active=coalesce(p_is_active,true)
  ) THEN
    RAISE EXCEPTION 'AVAILABILITY_RULE_DUPLICATE' USING ERRCODE='23505';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.availabilities(provider_id,instructor_id,vehicle_id,day_of_week,start_time,end_time,timezone,is_active)
    VALUES(v_provider_id,p_instructor_id,p_vehicle_id,p_day_of_week,p_start_time,p_end_time,p_timezone,coalesce(p_is_active,true))
    RETURNING * INTO v;
  ELSE
    UPDATE public.availabilities SET
      instructor_id=p_instructor_id, vehicle_id=p_vehicle_id, day_of_week=p_day_of_week,
      start_time=p_start_time, end_time=p_end_time, timezone=p_timezone,
      is_active=coalesce(p_is_active,true)
    WHERE id=p_id RETURNING * INTO v;
  END IF;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.provider_delete_availability_rule(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_provider_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000'; END IF;
  IF NOT public.is_current_user_active() THEN RAISE EXCEPTION 'INACTIVE_USER' USING ERRCODE='42501'; END IF;
  SELECT provider_id INTO v_provider_id FROM public.availabilities WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'AVAILABILITY_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF NOT public.can_manage_provider_schedule(v_provider_id) THEN
    RAISE EXCEPTION 'AVAILABILITY_PROVIDER_ACCESS_DENIED' USING ERRCODE='42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('provider-schedule:' || v_provider_id::text, 0));
  DELETE FROM public.availabilities WHERE id=p_id AND provider_id=v_provider_id;
END;
$$;

DROP POLICY IF EXISTS availabilities_public_select ON public.availabilities;
DROP POLICY IF EXISTS availabilities_owner_insert ON public.availabilities;
DROP POLICY IF EXISTS availabilities_owner_update ON public.availabilities;
DROP POLICY IF EXISTS availabilities_owner_delete ON public.availabilities;

CREATE POLICY availabilities_manager_select ON public.availabilities
FOR SELECT TO authenticated
USING (public.can_manage_provider_schedule(provider_id));

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.availabilities FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.availabilities FROM authenticated;
GRANT SELECT ON public.availabilities TO authenticated;

REVOKE ALL ON FUNCTION public.provider_save_availability_rule(uuid,uuid,uuid,uuid,integer,time,time,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_save_availability_rule(uuid,uuid,uuid,uuid,integer,time,time,text,boolean) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.provider_delete_availability_rule(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_delete_availability_rule(uuid) TO authenticated, service_role;
