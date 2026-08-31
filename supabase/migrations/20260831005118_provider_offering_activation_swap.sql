-- Atomically replace an equivalent active offering when the provider confirms
-- the change in the PRO application.
CREATE OR REPLACE FUNCTION public.provider_replace_active_service_offering(
  p_offering_id uuid
)
RETURNS public.service_offerings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_target public.service_offerings;
  v_previous public.service_offerings;
  v_result public.service_offerings;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_target
  FROM public.service_offerings
  WHERE id = p_offering_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OFFERING_NOT_FOUND' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.providers p
    WHERE p.id = v_target.provider_id
      AND (
        p.user_id = auth.uid()
        OR public.is_school_admin(v_target.provider_id)
        OR public.is_platform_admin()
      )
  ) THEN
    RAISE EXCEPTION 'OFFERING_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_previous
  FROM public.service_offerings
  WHERE id <> v_target.id
    AND provider_id = v_target.provider_id
    AND instructor_id = v_target.instructor_id
    AND vehicle_id = v_target.vehicle_id
    AND category = v_target.category
    AND transmission = v_target.transmission
    AND duration_minutes = 50
    AND status = 'ACTIVE'
  ORDER BY id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DUPLICATE_ACTIVE_OFFERING_NOT_FOUND' USING ERRCODE = '22023';
  END IF;

  UPDATE public.service_offerings
  SET is_active = false,
      status = 'INACTIVE',
      updated_at = now()
  WHERE id = v_previous.id;

  SELECT * INTO v_result
  FROM public.provider_save_service_offering(
    v_target.id,
    v_target.provider_id,
    v_target.instructor_id,
    v_target.vehicle_id,
    v_target.category,
    v_target.transmission,
    50,
    v_target.price_in_cents,
    true
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.provider_replace_active_service_offering(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_replace_active_service_offering(uuid) TO authenticated, service_role;
