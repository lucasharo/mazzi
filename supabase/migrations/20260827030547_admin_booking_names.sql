-- Admin and support need the student's display name to operate a booking.
-- This is a narrowly scoped read RPC; it does not expose document data or contacts.
CREATE OR REPLACE FUNCTION public.get_admin_booking_names(p_booking_ids uuid[])
RETURNS TABLE (
  booking_id uuid,
  student_name text,
  instructor_name text,
  provider_name text,
  vehicle_name text,
  meeting_point jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;
  IF NOT public.current_user_has_permission('admin.finance.read_all'::public.app_permission)
     AND NOT public.current_user_has_permission('support.booking.read_limited'::public.app_permission) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT b.id, student.name::text, instructor.name::text, provider.trade_name::text,
    concat(vehicle.brand, ' ', vehicle.model)::text, b.meeting_point
  FROM public.bookings b
  JOIN public.users student ON student.id = b.student_id
  JOIN public.users instructor ON instructor.id = b.instructor_id
  JOIN public.providers provider ON provider.id = b.provider_id
  JOIN public.vehicles vehicle ON vehicle.id = b.vehicle_id
  WHERE b.id = ANY(p_booking_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_booking_names(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_booking_names(uuid[]) TO authenticated;
