-- Resolve a payout email link without allowing direct reads from public.payouts.
CREATE OR REPLACE FUNCTION public.get_my_provider_payout_detail_by_reference(
  p_public_reference TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_result JSONB;
BEGIN
  IF v_uid IS NULL OR NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'PAYOUT_UNAVAILABLE' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'id', po.id,
    'status', po.status,
    'amount_in_cents', po.amount_in_cents,
    'scheduled_release_at', po.scheduled_release_at,
    'released_at', po.released_at,
    'processed_at', po.processed_at,
    'failure_reason', CASE WHEN po.status::TEXT IN ('FAILED', 'BLOCKED') THEN po.failure_reason ELSE NULL END
  ) INTO v_result
  FROM public.payouts po
  JOIN public.providers p ON p.id = po.provider_id
  WHERE po.public_reference = p_public_reference
    AND ((p.type::TEXT = 'INSTRUCTOR' AND p.user_id = v_uid AND public.current_user_has_permission('provider.finance.read_own'::public.app_permission))
      OR (p.type::TEXT = 'DRIVING_SCHOOL' AND public.current_user_has_permission('school.finance.read'::public.app_permission)
        AND (p.user_id = v_uid OR EXISTS (
          SELECT 1
          FROM public.driving_school_staff dss
          WHERE dss.school_id = p.id
            AND dss.user_id = v_uid
            AND dss.is_active IS TRUE
        ))));

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'PAYOUT_UNAVAILABLE' USING ERRCODE = '42501';
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_provider_payout_detail_by_reference(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_provider_payout_detail_by_reference(TEXT) TO authenticated;
