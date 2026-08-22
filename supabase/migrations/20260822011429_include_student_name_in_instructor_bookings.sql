-- Expose the student's display name only within the instructor's own bookings.
-- This keeps the provider modal aligned with the Student reservation details.
DROP FUNCTION IF EXISTS public.get_my_unified_instructor_bookings();

CREATE FUNCTION public.get_my_unified_instructor_bookings()
RETURNS TABLE(
  id uuid,
  student_id uuid,
  student_name text,
  provider_id uuid,
  provider_name text,
  instructor_id uuid,
  instructor_name text,
  vehicle_id uuid,
  vehicle_name text,
  offering_id uuid,
  quote_id uuid,
  status public.booking_status,
  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,
  checkin_student_at timestamptz,
  checkin_instructor_at timestamptz,
  lesson_started_at timestamptz,
  lesson_finished_at timestamptz,
  completed_at timestamptz,
  confirmed_at timestamptz,
  updated_at timestamptz,
  hold_expires_at timestamptz,
  idempotency_key varchar,
  cancelled_at timestamptz,
  cancelled_by text,
  cancellation_reason text,
  refund_amount_in_cents bigint,
  expired_at timestamptz,
  price_in_cents integer,
  platform_fee_in_cents integer,
  total_in_cents integer,
  snapshot_data jsonb,
  meeting_point jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    b.id,
    b.student_id,
    COALESCE(b.snapshot_data->>'studentName', b.snapshot_data->>'student_name', su.name, '')::text,
    b.provider_id,
    COALESCE(b.snapshot_data->>'providerName', p.trade_name, p.legal_name, '')::text,
    b.instructor_id,
    COALESCE(b.snapshot_data->>'instructorName', iu.name, '')::text,
    b.vehicle_id,
    COALESCE(b.snapshot_data->>'vehicleName', v.brand || ' ' || v.model, '')::text,
    b.offering_id,
    b.quote_id,
    b.status,
    b.scheduled_start_at,
    b.scheduled_end_at,
    b.checkin_student_at,
    b.checkin_instructor_at,
    b.lesson_started_at,
    b.lesson_finished_at,
    b.completed_at,
    b.confirmed_at,
    b.updated_at,
    b.hold_expires_at,
    b.idempotency_key,
    b.cancelled_at,
    b.cancelled_by,
    b.cancellation_reason,
    b.refund_amount_in_cents,
    b.expired_at,
    b.price_in_cents,
    b.platform_fee_in_cents,
    b.total_in_cents,
    b.snapshot_data,
    b.meeting_point,
    b.created_at
  FROM public.bookings b
  LEFT JOIN public.providers p ON p.id = b.provider_id
  LEFT JOIN public.users su ON su.id = b.student_id
  LEFT JOIN public.users iu ON iu.id = b.instructor_id
  LEFT JOIN public.vehicles v ON v.id = b.vehicle_id
  WHERE b.instructor_id = v_uid
  ORDER BY b.scheduled_start_at ASC;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_unified_instructor_bookings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_unified_instructor_bookings() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_unified_instructor_bookings() TO authenticated;
