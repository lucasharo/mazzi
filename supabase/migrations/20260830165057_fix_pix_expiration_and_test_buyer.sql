-- Mercado Pago Pix requires an expiration between 30 minutes and 30 days.
-- Keep one minute of safety margin: the gateway code subtracts 20 seconds
-- from the booking hold when creating the Pix payment.

CREATE OR REPLACE FUNCTION public.create_booking_hold_at_meeting_point(
  p_quote_id uuid,
  p_student_id uuid,
  p_idempotency_key varchar DEFAULT NULL,
  p_meeting_point jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_booking_id uuid;
  v_point jsonb;
  v_quote record;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_student_id THEN
    RAISE EXCEPTION 'STUDENT_ACCESS_DENIED' USING errcode = '42501';
  END IF;

  IF COALESCE(p_meeting_point->>'type', '') = 'STUDENT_ADDRESS' THEN
    IF NULLIF(BTRIM(p_meeting_point->>'address'), '') IS NULL
       OR p_meeting_point->>'latitude' IS NULL
       OR p_meeting_point->>'longitude' IS NULL
       OR (p_meeting_point->>'latitude')::double precision NOT BETWEEN -90 AND 90
       OR (p_meeting_point->>'longitude')::double precision NOT BETWEEN -180 AND 180 THEN
      RAISE EXCEPTION 'STUDENT_ADDRESS_COORDINATES_REQUIRED' USING errcode = '22023';
    END IF;
    IF NOT EXISTS (
      SELECT 1
        FROM public.quotes q
        JOIN public.providers p ON p.id = q.provider_id
       WHERE q.id = p_quote_id
         AND q.student_id = auth.uid()
         AND p.location_geography IS NOT NULL
         AND ST_DWithin(
           p.location_geography,
           ST_SetSRID(ST_MakePoint(
             (p_meeting_point->>'longitude')::double precision,
             (p_meeting_point->>'latitude')::double precision
           ), 4326)::geography,
           p.service_radius_km * 1000
         )
    ) THEN
      RAISE EXCEPTION 'STUDENT_ADDRESS_OUTSIDE_PROVIDER_RADIUS' USING errcode = '22023';
    END IF;
    v_point := jsonb_build_object('type', 'STUDENT_ADDRESS', 'label', BTRIM(p_meeting_point->>'address'));
  ELSIF COALESCE(p_meeting_point->>'type', '') = 'PROVIDER_ADDRESS' THEN
    SELECT q.provider_id, p.neighborhood, p.city
      INTO v_quote
      FROM public.quotes q
      JOIN public.providers p ON p.id = q.provider_id
     WHERE q.id = p_quote_id
       AND q.student_id = auth.uid();
    IF NOT FOUND THEN
      RAISE EXCEPTION 'QUOTE_NOT_FOUND' USING errcode = 'P0002';
    END IF;
    v_point := jsonb_build_object('type', 'PROVIDER_ADDRESS', 'label', CONCAT_WS(', ', v_quote.neighborhood, v_quote.city));
  ELSE
    RAISE EXCEPTION 'MEETING_POINT_TYPE_INVALID' USING errcode = '22023';
  END IF;

  v_result := public.create_booking_hold(p_quote_id, p_student_id, p_idempotency_key, 31);
  v_booking_id := (v_result->>'booking_id')::uuid;
  UPDATE public.bookings
     SET meeting_point = v_point
   WHERE id = v_booking_id
     AND student_id = auth.uid();
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking_hold_at_meeting_point(uuid, uuid, varchar, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_booking_hold_at_meeting_point(uuid, uuid, varchar, jsonb) TO authenticated;
