-- Read evidence through a controlled RPC. This avoids the Storage/table RLS
-- context returning an empty JSON array for a valid participant session.
CREATE OR REPLACE FUNCTION public.get_booking_dispute_evidence(p_dispute_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_is_participant BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000'; END IF;
  SELECT EXISTS (
    SELECT 1
    FROM public.booking_disputes d
    JOIN public.bookings b ON b.id=d.booking_id
    JOIN public.providers p ON p.id=b.provider_id
    WHERE d.id=p_dispute_id
      AND (b.student_id=v_uid OR p.user_id=v_uid OR public.current_user_has_permission('admin.finance.read_all'::public.app_permission))
  ) INTO v_is_participant;
  IF NOT v_is_participant THEN RAISE EXCEPTION 'DISPUTE_EVIDENCE_FORBIDDEN' USING ERRCODE='42501'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(e) ORDER BY e.created_at)
    FROM public.booking_dispute_evidence e
    WHERE e.dispute_id=p_dispute_id
      AND (e.uploaded_by=v_uid OR public.current_user_has_permission('admin.finance.read_all'::public.app_permission))
  ), '[]'::JSONB);
END;
$$;
REVOKE ALL ON FUNCTION public.get_booking_dispute_evidence(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_booking_dispute_evidence(UUID) TO authenticated;
