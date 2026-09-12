-- Expose the source of the payout date so the PRO can distinguish Stripe's
-- official arrival date from MAZZI's internal fallback forecast.
CREATE OR REPLACE FUNCTION public.get_my_provider_upcoming_payouts()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_uid UUID := auth.uid(); v_result JSONB;
BEGIN
  IF v_uid IS NULL OR NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', po.id,
    'date', (COALESCE(po.stripe_arrival_date, po.scheduled_release_at) AT TIME ZONE 'America/Sao_Paulo')::DATE,
    'arrival_date', po.stripe_arrival_date,
    'date_source', CASE WHEN po.stripe_arrival_date IS NOT NULL THEN 'STRIPE' ELSE 'MAZZI_FORECAST' END,
    'status', po.status,
    'amount_in_cents', po.amount_in_cents,
    'is_overdue', COALESCE(po.stripe_arrival_date, po.scheduled_release_at) < NOW(),
    'failure_reason', CASE WHEN po.status::TEXT = 'FAILED' THEN po.failure_reason ELSE NULL END
  ) ORDER BY COALESCE(po.stripe_arrival_date, po.scheduled_release_at)), '[]'::JSONB)
  INTO v_result
  FROM public.payouts po
  JOIN public.providers p ON p.id = po.provider_id
  WHERE COALESCE(po.stripe_arrival_date, po.scheduled_release_at) < NOW() + INTERVAL '7 days'
    AND po.status::TEXT IN ('PENDING', 'AVAILABLE', 'PROCESSING')
    AND ((p.type::TEXT = 'INSTRUCTOR' AND p.user_id = v_uid AND public.current_user_has_permission('provider.finance.read_own'::public.app_permission))
      OR (p.type::TEXT = 'DRIVING_SCHOOL' AND public.current_user_has_permission('school.finance.read'::public.app_permission)
        AND (p.user_id = v_uid OR EXISTS (SELECT 1 FROM public.driving_school_staff dss WHERE dss.school_id = p.id AND dss.user_id = v_uid AND dss.is_active IS TRUE))));
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_provider_upcoming_payouts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_provider_upcoming_payouts() TO authenticated;
