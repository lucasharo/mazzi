-- availability_exceptions has no updated_at column in the canonical schema.
-- Keep the soft-deactivation and edit RPCs compatible with that schema.

CREATE OR REPLACE FUNCTION public.provider_save_availability_exception(
  p_id UUID,
  p_provider_id UUID,
  p_instructor_id UUID,
  p_vehicle_id UUID,
  p_type VARCHAR,
  p_reason_category VARCHAR,
  p_reason VARCHAR,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  p_is_active BOOLEAN DEFAULT TRUE
) RETURNS SETOF public.availability_exceptions
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_existing public.availability_exceptions%ROWTYPE;
  v_saved public.availability_exceptions%ROWTYPE;
  v_provider_id UUID := p_provider_id;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_start_at IS NULL OR p_end_at IS NULL OR p_end_at <= p_start_at THEN RAISE EXCEPTION 'INVALID_AVAILABILITY_EXCEPTION_RANGE' USING ERRCODE = '22023'; END IF;
  IF p_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.availability_exceptions WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'AVAILABILITY_EXCEPTION_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
    IF v_existing.provider_id IS DISTINCT FROM p_provider_id THEN RAISE EXCEPTION 'PROVIDER_SCOPE_MISMATCH' USING ERRCODE = '42501'; END IF;
    v_provider_id := v_existing.provider_id;
  END IF;
  IF NOT public.can_manage_provider_schedule(v_provider_id) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('provider-schedule:' || v_provider_id::TEXT, 0));
  IF p_type = 'BLOCK' AND COALESCE(p_is_active, TRUE) AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.provider_id = v_provider_id
      AND b.status IN ('CONFIRMED','IN_PROGRESS','PENDING_PAYMENT')
      AND (b.status <> 'PENDING_PAYMENT' OR b.hold_expires_at IS NULL OR b.hold_expires_at > NOW())
      AND b.scheduled_start_at < p_end_at AND p_start_at < b.scheduled_end_at
      AND (p_instructor_id IS NULL OR b.instructor_id = p_instructor_id)
      AND (p_vehicle_id IS NULL OR b.vehicle_id = p_vehicle_id)
  ) THEN RAISE EXCEPTION 'AVAILABILITY_BLOCK_BOOKING_CONFLICT' USING ERRCODE = '23P01'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.availability_exceptions (provider_id,instructor_id,vehicle_id,type,reason_category,reason,start_at,end_at,is_active)
    VALUES (p_provider_id,p_instructor_id,p_vehicle_id,p_type,p_reason_category,p_reason,p_start_at,p_end_at,COALESCE(p_is_active,TRUE))
    RETURNING * INTO v_saved;
  ELSE
    UPDATE public.availability_exceptions SET instructor_id=p_instructor_id, vehicle_id=p_vehicle_id,
      type=p_type, reason_category=p_reason_category, reason=p_reason, start_at=p_start_at, end_at=p_end_at,
      is_active=COALESCE(p_is_active,TRUE)
    WHERE id=p_id RETURNING * INTO v_saved;
  END IF;
  RETURN NEXT v_saved;
END;
$$;

CREATE OR REPLACE FUNCTION public.provider_set_availability_exception_active(p_id UUID, p_is_active BOOLEAN)
RETURNS SETOF public.availability_exceptions
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_exception public.availability_exceptions%ROWTYPE;
  v_saved public.availability_exceptions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_exception FROM public.availability_exceptions WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'AVAILABILITY_EXCEPTION_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.can_manage_provider_schedule(v_exception.provider_id) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('provider-schedule:' || v_exception.provider_id::TEXT, 0));
  IF p_is_active AND v_exception.type='BLOCK' AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.provider_id=v_exception.provider_id AND b.status IN ('CONFIRMED','IN_PROGRESS','PENDING_PAYMENT')
      AND (b.status <> 'PENDING_PAYMENT' OR b.hold_expires_at IS NULL OR b.hold_expires_at > NOW())
      AND b.scheduled_start_at < v_exception.end_at AND v_exception.start_at < b.scheduled_end_at
      AND (v_exception.instructor_id IS NULL OR b.instructor_id=v_exception.instructor_id)
      AND (v_exception.vehicle_id IS NULL OR b.vehicle_id=v_exception.vehicle_id)
  ) THEN RAISE EXCEPTION 'AVAILABILITY_BLOCK_BOOKING_CONFLICT' USING ERRCODE = '23P01'; END IF;
  UPDATE public.availability_exceptions SET is_active=p_is_active WHERE id=p_id RETURNING * INTO v_saved;
  RETURN NEXT v_saved;
END;
$$;
