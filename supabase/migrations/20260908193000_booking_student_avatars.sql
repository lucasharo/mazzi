-- MAZZI — Make the student's profile photo available to the assigned instructor.
-- The RPC is restricted to bookings owned by the authenticated instructor and
-- returns only the public avatar URL needed by the booking card.

CREATE OR REPLACE FUNCTION public.get_my_instructor_booking_avatars(p_booking_ids UUID[])
RETURNS TABLE (
  booking_id UUID,
  student_avatar_url TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    b.id,
    NULLIF(BTRIM(student_user.avatar_url), '')::TEXT
  FROM public.bookings b
  LEFT JOIN public.users student_user
    ON student_user.id = b.student_id
   AND student_user.status = 'ACTIVE'
  WHERE auth.uid() IS NOT NULL
    AND b.instructor_id = auth.uid()
    AND p_booking_ids IS NOT NULL
    AND cardinality(p_booking_ids) > 0
    AND b.id = ANY(p_booking_ids);
$$;

REVOKE ALL ON FUNCTION public.get_my_instructor_booking_avatars(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_instructor_booking_avatars(UUID[]) TO authenticated;
