-- Include the provider address coordinates in the authenticated student's
-- booking context so the navigation action can be rendered safely.
CREATE OR REPLACE FUNCTION public.get_my_booking_names(p_booking_ids UUID[])
RETURNS TABLE (
  booking_id UUID,
  instructor_name TEXT,
  provider_name TEXT,
  vehicle_name TEXT,
  meeting_point JSONB
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    b.id,
    iu.name::TEXT,
    p.trade_name::TEXT,
    CONCAT(v.brand, ' ', v.model)::TEXT,
    CASE
      WHEN b.meeting_point->>'type' = 'PROVIDER_ADDRESS' THEN
        jsonb_strip_nulls(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                COALESCE(b.meeting_point, '{}'::JSONB),
                '{full_address}',
                to_jsonb(NULLIF(p.address->>'formatted', '')),
                true
              ),
              '{latitude}',
              to_jsonb(p.latitude),
              true
            ),
            '{longitude}',
            to_jsonb(p.longitude),
            true
          )
        )
      ELSE b.meeting_point
    END
  FROM public.bookings b
  JOIN public.users iu ON iu.id = b.instructor_id
  JOIN public.providers p ON p.id = b.provider_id
  JOIN public.vehicles v ON v.id = b.vehicle_id
  WHERE b.student_id = auth.uid() AND b.id = ANY(p_booking_ids);
$$;

REVOKE ALL ON FUNCTION public.get_my_booking_names(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_booking_names(uuid[]) TO authenticated;
