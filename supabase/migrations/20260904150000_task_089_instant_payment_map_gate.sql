-- TASK-089 — Do not expose Aula Agora tracking before payment confirmation.
-- The browser may open the payment flow while the booking is still held as
-- PENDING_PAYMENT. The map becomes available only after the trusted payment
-- confirmation changes the booking to CONFIRMED (or IN_PROGRESS).

CREATE OR REPLACE FUNCTION public.get_instant_tracking(p_booking_id UUID)
RETURNS TABLE(
  booking_id UUID,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = p_booking_id
      AND (
        b.student_id = auth.uid()
        OR b.instructor_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.providers p
          WHERE p.id = b.provider_id
            AND p.user_id = auth.uid()
        )
      )
  ) THEN
    RAISE EXCEPTION 'INSTANT_TRACKING_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p_booking_id,
    l.latitude,
    l.longitude,
    l.recorded_at
  FROM public.bookings b
  JOIN public.instant_provider_locations l
    ON l.provider_id = b.provider_id
   AND l.instructor_id = b.instructor_id
  WHERE b.id = p_booking_id
    AND b.status IN ('CONFIRMED', 'IN_PROGRESS')
    AND l.recorded_at >= NOW() - INTERVAL '2 minutes';
END;
$$;

REVOKE ALL ON FUNCTION public.get_instant_tracking(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_instant_tracking(UUID) TO authenticated;
