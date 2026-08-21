-- MAZZI — runtime eligibility gates for the booking funnel

CREATE OR REPLACE FUNCTION public.is_offering_slot_available(
  p_offering_id UUID,
  p_scheduled_start_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  o public.service_offerings%ROWTYPE;
  p public.providers%ROWTYPE;
  v public.vehicles%ROWTYPE;
  e TIMESTAMPTZ;
  local_start TIMESTAMP;
  local_end TIMESTAMP;
  dow INTEGER;
BEGIN
  SELECT * INTO o FROM public.service_offerings WHERE id = p_offering_id;
  IF NOT FOUND OR o.status <> 'ACTIVE' OR o.is_active IS NOT TRUE OR o.instructor_id IS NULL THEN RETURN FALSE; END IF;
  SELECT * INTO p FROM public.providers WHERE id=o.provider_id;
  IF NOT FOUND OR p.status <> 'ACTIVE' THEN RETURN FALSE; END IF;
  IF NOT public.is_provider_instructor_eligible(o.provider_id,o.instructor_id,o.category) THEN RETURN FALSE; END IF;
  SELECT * INTO v FROM public.vehicles WHERE id=o.vehicle_id;
  IF NOT FOUND OR v.status <> 'ACTIVE' OR v.deleted_at IS NOT NULL OR v.provider_id<>o.provider_id THEN RETURN FALSE; END IF;
  IF p_scheduled_start_at IS NULL OR p_scheduled_start_at <= NOW() THEN RETURN FALSE; END IF;
  e := p_scheduled_start_at + make_interval(mins=>o.duration_minutes);
  IF EXISTS (SELECT 1 FROM public.instructor_global_blocks b WHERE b.instructor_id=o.instructor_id AND b.start_at<p_scheduled_start_at+make_interval(mins=>o.duration_minutes) AND b.end_at>p_scheduled_start_at) THEN RETURN FALSE; END IF;
  IF EXISTS (SELECT 1 FROM public.availability_exceptions x WHERE x.provider_id=o.provider_id AND x.type='BLOCK' AND (x.instructor_id IS NULL OR x.instructor_id=o.instructor_id) AND (x.vehicle_id IS NULL OR x.vehicle_id=o.vehicle_id) AND x.start_at<e AND x.end_at>p_scheduled_start_at) THEN RETURN FALSE; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.availability_exceptions x WHERE x.provider_id=o.provider_id AND x.type='AVAILABLE_OVERRIDE' AND (x.instructor_id IS NULL OR x.instructor_id=o.instructor_id) AND (x.vehicle_id IS NULL OR x.vehicle_id=o.vehicle_id) AND x.start_at<=p_scheduled_start_at AND x.end_at>=e) THEN
    local_start := p_scheduled_start_at AT TIME ZONE 'America/Sao_Paulo';
    local_end := e AT TIME ZONE 'America/Sao_Paulo';
    dow := EXTRACT(ISODOW FROM local_start)::INTEGER;
    IF NOT EXISTS (SELECT 1 FROM public.availabilities a WHERE a.provider_id=o.provider_id AND a.is_active AND (a.instructor_id IS NULL OR a.instructor_id=o.instructor_id) AND (a.vehicle_id IS NULL OR a.vehicle_id=o.vehicle_id) AND a.day_of_week IN (dow,dow%7) AND a.start_time<=local_start::TIME AND a.end_time>=local_end::TIME) THEN RETURN FALSE; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.bookings b WHERE b.instructor_id=o.instructor_id AND b.status IN ('PENDING_PAYMENT','CONFIRMED','IN_PROGRESS') AND b.slot_range && tstzrange(p_scheduled_start_at,e,'[)')) THEN RETURN FALSE; END IF;
  IF EXISTS (SELECT 1 FROM public.bookings b WHERE b.vehicle_id=o.vehicle_id AND b.status IN ('PENDING_PAYMENT','CONFIRMED','IN_PROGRESS') AND b.slot_range && tstzrange(p_scheduled_start_at,e,'[)')) THEN RETURN FALSE; END IF;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_provider_booking_context_public(p_provider_id UUID)
RETURNS TABLE (
  provider_id UUID, provider_name TEXT, offering_id UUID, instructor_id UUID, instructor_name TEXT,
  vehicle_id UUID, category TEXT, transmission TEXT, duration_minutes INT, price_in_cents INT,
  vehicle_brand TEXT, vehicle_model TEXT, vehicle_year INT, vehicle_category TEXT,
  vehicle_transmission TEXT, vehicle_color TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public, pg_temp
AS $$
  SELECT p.id,p.trade_name::TEXT,o.id,o.instructor_id,u.name::TEXT,v.id,o.category::TEXT,o.transmission::TEXT,
    o.duration_minutes,o.price_in_cents,v.brand::TEXT,v.model::TEXT,v.year,v.category::TEXT,v.transmission::TEXT,v.color::TEXT
  FROM public.providers p
  JOIN public.service_offerings o ON o.provider_id=p.id
  JOIN public.users u ON u.id=o.instructor_id
  JOIN public.vehicles v ON v.id=o.vehicle_id AND v.provider_id=p.id
  WHERE p.id=p_provider_id AND p.status='ACTIVE' AND o.status='ACTIVE' AND o.is_active
    AND o.category::TEXT='B' AND v.status='ACTIVE' AND v.deleted_at IS NULL
    AND public.is_provider_instructor_eligible(p.id,o.instructor_id,o.category)
  ORDER BY o.price_in_cents,o.id;
$$;

CREATE OR REPLACE FUNCTION public.enforce_quote_instructor_eligibility()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
BEGIN
  IF NOT public.is_provider_instructor_eligible(NEW.provider_id,NEW.instructor_id,NULL) THEN
    RAISE EXCEPTION 'INSTRUCTOR_NOT_ELIGIBLE' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_quote_instructor_eligibility ON public.quotes;
CREATE TRIGGER enforce_quote_instructor_eligibility
BEFORE INSERT ON public.quotes FOR EACH ROW
EXECUTE FUNCTION public.enforce_quote_instructor_eligibility();

CREATE OR REPLACE FUNCTION public.enforce_booking_instructor_eligibility()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
BEGIN
  IF NOT public.is_provider_instructor_eligible(NEW.provider_id,NEW.instructor_id,NULL) THEN
    RAISE EXCEPTION 'INSTRUCTOR_NOT_ELIGIBLE' USING ERRCODE='42501';
  END IF;
  IF NEW.selection_mode IS NULL THEN NEW.selection_mode := 'SPECIFIC_INSTRUCTOR'; END IF;
  IF TG_OP='UPDATE' AND ((NEW.checkin_instructor_at IS DISTINCT FROM OLD.checkin_instructor_at AND NEW.checkin_instructor_at IS NOT NULL)
    OR (NEW.lesson_started_at IS DISTINCT FROM OLD.lesson_started_at AND NEW.lesson_started_at IS NOT NULL)) THEN
    IF NOT public.is_provider_instructor_eligible(NEW.provider_id,NEW.instructor_id,NULL) THEN
      RAISE EXCEPTION 'INSTRUCTOR_COMPLIANCE_INVALID_AT_LESSON_START' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_booking_instructor_eligibility ON public.bookings;
CREATE TRIGGER enforce_booking_instructor_eligibility
BEFORE INSERT OR UPDATE ON public.bookings FOR EACH ROW
EXECUTE FUNCTION public.enforce_booking_instructor_eligibility();

REVOKE ALL ON FUNCTION public.is_offering_slot_available(UUID,TIMESTAMPTZ) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_offering_slot_available(UUID,TIMESTAMPTZ) TO authenticated,service_role;
