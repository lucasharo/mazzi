-- TASK-096A4M-R10A: preserve canonical vehicle review state forward-only.
-- Preserve rows, IDs, timestamps and audit history.

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

REVOKE ALL ON FUNCTION public.provider_save_vehicle(uuid,uuid,text,text,integer,text,text,public.vehicle_category,public.vehicle_type,public.vehicle_transmission,boolean,boolean,text,text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_save_vehicle(uuid,uuid,text,text,integer,text,text,public.vehicle_category,public.vehicle_type,public.vehicle_transmission,boolean,boolean,text,text[]) TO authenticated;
