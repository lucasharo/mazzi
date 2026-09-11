-- Expose payout state in the PRO booking detail through the existing secured
-- provider-bookings RPC. Payouts remain inaccessible to direct client reads.

CREATE OR REPLACE FUNCTION public.get_my_provider_bookings(p_provider_id UUID)
RETURNS SETOF JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.providers p
    WHERE p.id = p_provider_id
      AND (
        p.user_id = v_uid
        OR EXISTS (
          SELECT 1 FROM public.driving_school_staff s
          WHERE s.school_id = p.id AND s.user_id = v_uid
            AND s.is_active AND s.membership_status = 'ACTIVE'
        )
        OR EXISTS (
          SELECT 1 FROM public.service_offerings o
          WHERE o.provider_id = p.id AND o.instructor_id = v_uid
        )
      )
  ) THEN
    RAISE EXCEPTION 'BOOKING_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT to_jsonb(b) || jsonb_build_object(
    'meeting_point', CASE
      WHEN b.status = 'PENDING_PAYMENT' AND b.snapshot_data->>'source' = 'AULA_AGORA' THEN
        jsonb_strip_nulls(jsonb_build_object(
          'type', 'REDACTED', 'label', 'Região do ponto de encontro',
          'neighborhood', b.meeting_point->>'neighborhood', 'city', b.meeting_point->>'city'
        ))
      WHEN b.meeting_point->>'type' = 'PROVIDER_ADDRESS' THEN
        jsonb_strip_nulls(COALESCE(b.meeting_point, '{}'::jsonb) || jsonb_build_object(
          'full_address', p.address->>'formatted', 'latitude', p.latitude, 'longitude', p.longitude
        ))
      ELSE b.meeting_point
    END,
    'snapshot_data', CASE
      WHEN b.status = 'PENDING_PAYMENT' AND b.snapshot_data->>'source' = 'AULA_AGORA' THEN
        (COALESCE(b.snapshot_data, '{}'::jsonb) - ARRAY['meetingPoint','meeting_point','fullMeetingPoint','latitude','longitude'])
        || jsonb_build_object('meetingPoint', jsonb_strip_nulls(jsonb_build_object(
          'type', 'REDACTED', 'label', 'Região do ponto de encontro',
          'neighborhood', b.meeting_point->>'neighborhood', 'city', b.meeting_point->>'city'
        )))
      ELSE b.snapshot_data
    END,
    'provider_payout', (
      SELECT jsonb_build_object(
        'id', po.id,
        'amount_in_cents', po.amount_in_cents,
        'status', po.status,
        'scheduled_release_at', po.scheduled_release_at,
        'released_at', po.released_at,
        'failure_reason', po.failure_reason
      )
      FROM public.payouts po
      WHERE po.booking_id = b.id AND po.provider_id = b.provider_id
      LIMIT 1
    )
  )
  FROM public.bookings b
  JOIN public.providers p ON p.id = b.provider_id
  WHERE b.provider_id = p_provider_id
  ORDER BY b.scheduled_start_at;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_provider_bookings(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_provider_bookings(UUID) TO authenticated;
