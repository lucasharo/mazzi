-- TASK-089 — Return the public instructor name with the student's active offer.
-- The provider trade name is not reliable for autonomous instructors.

CREATE OR REPLACE FUNCTION public.get_my_active_instant_request()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req RECORD;
  v_offer RECORD;
BEGIN
  SELECT * INTO v_req
  FROM public.instant_lesson_requests ilr
  WHERE ilr.student_id = auth.uid()
    AND (
      ilr.status = 'SEARCHING'
      OR (
        ilr.status = 'MATCHED'
        AND EXISTS (
          SELECT 1
          FROM public.bookings b
          WHERE b.id = ilr.booking_id
            AND b.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS')
        )
      )
    )
  ORDER BY ilr.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT io.*, p.trade_name AS provider_name, u.name AS instructor_name,
         o.category::TEXT, v.transmission::TEXT, o.duration_minutes
  INTO v_offer
  FROM public.instant_lesson_offers io
  JOIN public.providers p ON p.id = io.provider_id
  LEFT JOIN public.users u ON u.id = io.instructor_id
  JOIN public.service_offerings o ON o.id = io.offering_id
  JOIN public.vehicles v ON v.id = io.vehicle_id
  WHERE io.request_id = v_req.id
    AND io.status = 'ACCEPTED'
  LIMIT 1;

  RETURN jsonb_build_object(
    'id', v_req.id,
    'student_id', v_req.student_id,
    'meeting_point', v_req.meeting_point,
    'category', v_req.category,
    'transmission', v_req.transmission,
    'max_price_in_cents', v_req.max_price_in_cents,
    'status', v_req.status,
    'expires_at', v_req.expires_at,
    'matched_provider_id', v_req.matched_provider_id,
    'matched_offering_id', v_req.matched_offering_id,
    'booking_id', v_req.booking_id,
    'offer', CASE WHEN v_offer.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_offer.id,
      'request_id', v_offer.request_id,
      'provider_id', v_offer.provider_id,
      'offering_id', v_offer.offering_id,
      'instructor_id', v_offer.instructor_id,
      'vehicle_id', v_offer.vehicle_id,
      'provider_name', v_offer.provider_name,
      'instructor_name', v_offer.instructor_name,
      'category', v_offer.category,
      'transmission', v_offer.transmission,
      'duration_minutes', v_offer.duration_minutes,
      'offered_price_in_cents', v_offer.offered_price_in_cents,
      'distance_meters', v_offer.distance_meters,
      'eta_minutes', v_offer.eta_minutes,
      'status', v_offer.status,
      'expires_at', v_offer.expires_at,
      'created_at', v_offer.created_at
    ) END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_active_instant_request() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_active_instant_request() TO authenticated;
