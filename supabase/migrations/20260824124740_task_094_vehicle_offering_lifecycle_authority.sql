-- TASK-094: authoritative vehicle and service offering lifecycle mutations.

CREATE OR REPLACE FUNCTION public.provider_save_vehicle(
  p_vehicle_id uuid DEFAULT NULL,
  p_provider_id uuid DEFAULT NULL,
  p_brand text DEFAULT NULL,
  p_model text DEFAULT NULL,
  p_year integer DEFAULT NULL,
  p_license_plate text DEFAULT NULL,
  p_renavam text DEFAULT NULL,
  p_category public.vehicle_category DEFAULT NULL,
  p_vehicle_type public.vehicle_type DEFAULT NULL,
  p_transmission public.vehicle_transmission DEFAULT NULL,
  p_has_dual_pedal boolean DEFAULT false,
  p_has_dashcam boolean DEFAULT false,
  p_color text DEFAULT NULL,
  p_photos text[] DEFAULT NULL
)
RETURNS public.vehicles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_vehicle public.vehicles;
  v_material_changed boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  IF NOT public.is_current_user_active() THEN RAISE EXCEPTION 'INACTIVE_USER' USING ERRCODE = '42501'; END IF;
  IF p_provider_id IS NULL THEN RAISE EXCEPTION 'PROVIDER_REQUIRED' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.providers p
    WHERE p.id = p_provider_id
      AND (p.user_id = auth.uid() OR public.is_school_admin(p.id) OR public.is_platform_admin())
  ) THEN RAISE EXCEPTION 'VEHICLE_PROVIDER_ACCESS_DENIED' USING ERRCODE = '42501'; END IF;

  IF p_vehicle_id IS NULL THEN
    IF p_brand IS NULL OR p_model IS NULL OR p_year IS NULL OR p_license_plate IS NULL
       OR p_category IS NULL OR p_vehicle_type IS NULL OR p_transmission IS NULL
    THEN RAISE EXCEPTION 'VEHICLE_REQUIRED_FIELDS' USING ERRCODE = '22023'; END IF;
    INSERT INTO public.vehicles (
      provider_id, brand, model, year, license_plate, license_plate_masked, renavam,
      category, vehicle_type, transmission, has_dual_pedal, has_dashcam, color, photos, status
    ) VALUES (
      p_provider_id, p_brand, p_model, p_year, p_license_plate,
      CASE WHEN length(p_license_plate) >= 4 THEN '***' || right(p_license_plate, 4) ELSE '***' END,
      p_renavam, p_category, p_vehicle_type, p_transmission, coalesce(p_has_dual_pedal, false),
      coalesce(p_has_dashcam, false), p_color, p_photos, 'PENDING'
    ) RETURNING * INTO v_vehicle;
  ELSE
    SELECT * INTO v_vehicle FROM public.vehicles WHERE id = p_vehicle_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'VEHICLE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
    IF v_vehicle.provider_id <> p_provider_id THEN RAISE EXCEPTION 'VEHICLE_PROVIDER_IMMUTABLE' USING ERRCODE = '42501'; END IF;
    IF v_vehicle.status = 'BLOCKED' THEN RAISE EXCEPTION 'BLOCKED_VEHICLE_MUTATION_DENIED' USING ERRCODE = '42501'; END IF;
    v_material_changed :=
      v_vehicle.brand IS DISTINCT FROM coalesce(p_brand, v_vehicle.brand)
      OR v_vehicle.model IS DISTINCT FROM coalesce(p_model, v_vehicle.model)
      OR v_vehicle.year IS DISTINCT FROM coalesce(p_year, v_vehicle.year)
      OR v_vehicle.license_plate IS DISTINCT FROM coalesce(p_license_plate, v_vehicle.license_plate)
      OR v_vehicle.renavam IS DISTINCT FROM coalesce(p_renavam, v_vehicle.renavam)
      OR v_vehicle.category IS DISTINCT FROM coalesce(p_category, v_vehicle.category)
      OR v_vehicle.vehicle_type IS DISTINCT FROM coalesce(p_vehicle_type, v_vehicle.vehicle_type)
      OR v_vehicle.transmission IS DISTINCT FROM coalesce(p_transmission, v_vehicle.transmission)
      OR v_vehicle.has_dual_pedal IS DISTINCT FROM coalesce(p_has_dual_pedal, v_vehicle.has_dual_pedal);
    UPDATE public.vehicles SET
      brand=coalesce(p_brand, brand), model=coalesce(p_model, model), year=coalesce(p_year, year),
      license_plate=coalesce(p_license_plate, license_plate),
      license_plate_masked=CASE WHEN p_license_plate IS NULL THEN license_plate_masked ELSE '***' || right(p_license_plate, 4) END,
      renavam=coalesce(p_renavam, renavam), category=coalesce(p_category, category), vehicle_type=coalesce(p_vehicle_type, vehicle_type),
      transmission=coalesce(p_transmission, transmission), has_dual_pedal=coalesce(p_has_dual_pedal, has_dual_pedal),
      has_dashcam=coalesce(p_has_dashcam, has_dashcam), color=coalesce(p_color, color), photos=coalesce(p_photos, photos),
      status=CASE WHEN v_material_changed AND status IN ('ACTIVE','INACTIVE') THEN 'IN_REVIEW' ELSE status END,
      updated_at=now()
    WHERE id=p_vehicle_id RETURNING * INTO v_vehicle;
  END IF;
  RETURN v_vehicle;
END;
$$;

CREATE OR REPLACE FUNCTION public.provider_deactivate_vehicle(p_vehicle_id uuid)
RETURNS public.vehicles
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v public.vehicles;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_current_user_active() THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  SELECT * INTO v FROM public.vehicles WHERE id=p_vehicle_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.providers p WHERE p.id=v.provider_id AND p.user_id=auth.uid()) THEN
    RAISE EXCEPTION 'VEHICLE_ACCESS_DENIED' USING ERRCODE='42501';
  END IF;
  IF v.status <> 'ACTIVE' THEN RAISE EXCEPTION 'VEHICLE_DEACTIVATION_INVALID' USING ERRCODE='22023'; END IF;
  UPDATE public.vehicles SET status='INACTIVE', updated_at=now() WHERE id=p_vehicle_id RETURNING * INTO v;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.provider_save_service_offering(
  p_offering_id uuid DEFAULT NULL,
  p_provider_id uuid DEFAULT NULL,
  p_instructor_id uuid DEFAULT NULL,
  p_vehicle_id uuid DEFAULT NULL,
  p_category public.vehicle_category DEFAULT NULL,
  p_transmission public.vehicle_transmission DEFAULT NULL,
  p_duration_minutes integer DEFAULT 50,
  p_price_in_cents integer DEFAULT NULL,
  p_active boolean DEFAULT false
)
RETURNS public.service_offerings
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v public.service_offerings;
  v_vehicle public.vehicles;
  v_provider public.providers;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_current_user_active() THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_provider_id IS NULL OR p_vehicle_id IS NULL OR p_instructor_id IS NULL THEN RAISE EXCEPTION 'OFFERING_REQUIRED_FIELDS' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_provider FROM public.providers WHERE id=p_provider_id;
  IF NOT FOUND OR NOT (v_provider.user_id=auth.uid() OR public.is_school_admin(p_provider_id) OR public.is_platform_admin()) THEN
    RAISE EXCEPTION 'OFFERING_PROVIDER_ACCESS_DENIED' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_vehicle FROM public.vehicles WHERE id=p_vehicle_id AND deleted_at IS NULL;
  IF NOT FOUND OR v_vehicle.provider_id<>p_provider_id THEN RAISE EXCEPTION 'OFFERING_VEHICLE_PROVIDER_MISMATCH' USING ERRCODE='23514'; END IF;
  IF p_category IS NULL OR p_transmission IS NULL OR p_category<>v_vehicle.category OR p_transmission<>v_vehicle.transmission THEN
    RAISE EXCEPTION 'OFFERING_VEHICLE_ATTRIBUTES_MISMATCH' USING ERRCODE='23514';
  END IF;
  IF p_duration_minutes <> 50 THEN RAISE EXCEPTION 'OFFERING_DURATION_MUST_BE_50' USING ERRCODE='22023'; END IF;
  IF p_price_in_cents IS NULL OR p_price_in_cents <= 0 OR p_price_in_cents <> trunc(p_price_in_cents) THEN RAISE EXCEPTION 'OFFERING_PRICE_INVALID' USING ERRCODE='22023'; END IF;
  IF NOT public.can_manage_service_offering(p_provider_id,p_instructor_id,p_vehicle_id) THEN RAISE EXCEPTION 'OFFERING_INSTRUCTOR_SCOPE_DENIED' USING ERRCODE='42501'; END IF;
  IF p_active THEN
    IF v_provider.status <> 'ACTIVE' THEN RAISE EXCEPTION 'OFFERING_PROVIDER_NOT_ACTIVE' USING ERRCODE='22023'; END IF;
    IF v_vehicle.status <> 'ACTIVE' THEN RAISE EXCEPTION 'OFFERING_VEHICLE_NOT_ACTIVE' USING ERRCODE='22023'; END IF;
    IF NOT public.is_provider_instructor_eligible(p_provider_id,p_instructor_id,p_category) THEN RAISE EXCEPTION 'OFFERING_INSTRUCTOR_NOT_ELIGIBLE' USING ERRCODE='22023'; END IF;
  END IF;
  IF p_offering_id IS NULL THEN
    IF p_active AND EXISTS (SELECT 1 FROM public.service_offerings WHERE provider_id=p_provider_id AND instructor_id=p_instructor_id AND vehicle_id=p_vehicle_id AND category=p_category AND transmission=p_transmission AND duration_minutes=50 AND status='ACTIVE') THEN
      RAISE EXCEPTION 'DUPLICATE_ACTIVE_OFFERING' USING ERRCODE='23505';
    END IF;
    INSERT INTO public.service_offerings(provider_id,instructor_id,vehicle_id,category,transmission,duration_minutes,price_in_cents,is_active,status)
    VALUES(p_provider_id,p_instructor_id,p_vehicle_id,p_category,p_transmission,50,p_price_in_cents,p_active,CASE WHEN p_active THEN 'ACTIVE' ELSE 'INACTIVE' END)
    RETURNING * INTO v;
  ELSE
    SELECT * INTO v FROM public.service_offerings WHERE id=p_offering_id FOR UPDATE;
    IF NOT FOUND OR v.provider_id<>p_provider_id THEN RAISE EXCEPTION 'OFFERING_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
    IF p_active AND v.status<>'ACTIVE' AND EXISTS (SELECT 1 FROM public.service_offerings WHERE id<>p_offering_id AND provider_id=p_provider_id AND instructor_id=p_instructor_id AND vehicle_id=p_vehicle_id AND category=p_category AND transmission=p_transmission AND duration_minutes=50 AND status='ACTIVE') THEN
      RAISE EXCEPTION 'DUPLICATE_ACTIVE_OFFERING' USING ERRCODE='23505';
    END IF;
    UPDATE public.service_offerings SET instructor_id=p_instructor_id,vehicle_id=p_vehicle_id,category=p_category,transmission=p_transmission,duration_minutes=50,price_in_cents=p_price_in_cents,is_active=p_active,status=CASE WHEN p_active THEN 'ACTIVE' ELSE 'INACTIVE' END,updated_at=now()
    WHERE id=p_offering_id RETURNING * INTO v;
  END IF;
  RETURN v;
END;
$$;

ALTER TABLE public.service_offerings
  ADD CONSTRAINT service_offerings_lifecycle_consistency_check
  CHECK ((status='ACTIVE' AND is_active=true) OR (status<>'ACTIVE' AND is_active=false));

ALTER TABLE public.service_offerings
  ADD CONSTRAINT service_offerings_duration_mvp_check CHECK (duration_minutes=50);

CREATE UNIQUE INDEX IF NOT EXISTS service_offerings_active_equivalence_idx
  ON public.service_offerings(provider_id,instructor_id,vehicle_id,category,transmission,duration_minutes)
  WHERE status='ACTIVE';

DROP POLICY IF EXISTS vehicles_owner_insert ON public.vehicles;
DROP POLICY IF EXISTS vehicles_owner_update ON public.vehicles;
DROP POLICY IF EXISTS offerings_owner_insert ON public.service_offerings;
DROP POLICY IF EXISTS offerings_owner_update ON public.service_offerings;

REVOKE INSERT, UPDATE, DELETE ON public.vehicles FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.service_offerings FROM authenticated;
REVOKE SELECT ON public.vehicles FROM anon;
REVOKE SELECT ON public.service_offerings FROM anon;
GRANT SELECT ON public.vehicles, public.service_offerings TO authenticated;

REVOKE ALL ON FUNCTION public.provider_save_vehicle(uuid,uuid,text,text,integer,text,text,public.vehicle_category,public.vehicle_type,public.vehicle_transmission,boolean,boolean,text,text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_save_vehicle(uuid,uuid,text,text,integer,text,text,public.vehicle_category,public.vehicle_type,public.vehicle_transmission,boolean,boolean,text,text[]) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.provider_deactivate_vehicle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_deactivate_vehicle(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.provider_save_service_offering(uuid,uuid,uuid,uuid,public.vehicle_category,public.vehicle_transmission,integer,integer,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_save_service_offering(uuid,uuid,uuid,uuid,public.vehicle_category,public.vehicle_transmission,integer,integer,boolean) TO authenticated, service_role;
