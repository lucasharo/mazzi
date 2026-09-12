-- "Repasses recebidos" must represent a confirmed bank payout, not only
-- an internal status or a platform-to-connected-account transfer.

CREATE OR REPLACE FUNCTION public.get_my_provider_completed_payouts()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_result JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(items) ORDER BY items.released_at DESC), '[]'::JSONB)
  INTO v_result
  FROM (
    SELECT
      po.id,
      po.booking_id,
      b.public_reference AS booking_reference,
      po.amount_in_cents,
      po.status::TEXT AS status,
      po.released_at,
      po.scheduled_release_at,
      b.scheduled_start_at AS lesson_scheduled_at,
      b.status::TEXT AS booking_status
    FROM public.payouts po
    JOIN public.bookings b ON b.id = po.booking_id
    JOIN public.providers p ON p.id = po.provider_id
    WHERE po.status = 'PAID'
      AND po.released_at IS NOT NULL
      AND po.stripe_arrival_date IS NOT NULL
      AND b.status = 'COMPLETED'
      AND (
        (
          p.type::TEXT = 'INSTRUCTOR'
          AND p.user_id = v_uid
          AND public.current_user_has_permission('provider.finance.read_own'::public.app_permission)
        )
        OR (
          p.type::TEXT = 'DRIVING_SCHOOL'
          AND public.current_user_has_permission('school.finance.read'::public.app_permission)
          AND (
            p.user_id = v_uid
            OR EXISTS (
              SELECT 1
              FROM public.driving_school_staff dss
              WHERE dss.school_id = p.id
                AND dss.user_id = v_uid
                AND dss.is_active IS TRUE
            )
          )
        )
      )
    ORDER BY po.released_at DESC
    LIMIT 20
  ) items;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_provider_completed_payouts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_provider_completed_payouts() TO authenticated;
