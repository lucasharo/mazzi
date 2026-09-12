-- MAZZI — school-admin deactivation of an instructor membership
-- Suspend the relationship without deleting its historical record.

CREATE OR REPLACE FUNCTION public.suspend_school_instructor_membership(
  p_membership_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_membership public.driving_school_staff%ROWTYPE;
  v_reason TEXT := NULLIF(BTRIM(p_reason), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_membership
  FROM public.driving_school_staff
  WHERE id = p_membership_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBERSHIP_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.is_school_admin(v_membership.school_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF v_membership.membership_status = 'ENDED'::public.school_membership_status THEN
    RAISE EXCEPTION 'MEMBERSHIP_ALREADY_ENDED' USING ERRCODE = 'P0001';
  END IF;

  IF v_membership.membership_status = 'SUSPENDED'::public.school_membership_status THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'membership_id', v_membership.id,
      'status', 'SUSPENDED',
      'already_suspended', TRUE
    );
  END IF;

  IF v_membership.membership_status <> 'ACTIVE'::public.school_membership_status THEN
    RAISE EXCEPTION 'MEMBERSHIP_NOT_ACTIVE' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.driving_school_staff
  SET membership_status = 'SUSPENDED'::public.school_membership_status,
      is_active = FALSE,
      suspended_at = NOW(),
      suspended_by = v_uid,
      end_reason = NULL,
      updated_at = NOW()
  WHERE id = v_membership.id;

  UPDATE public.driving_school_membership_events
  SET reason = v_reason
  WHERE id = (
    SELECT e.id
    FROM public.driving_school_membership_events e
    WHERE e.membership_id = v_membership.id
      AND e.event_type = 'SUSPENDED'::public.school_membership_event_type
      AND e.actor_id = v_uid
    ORDER BY e.created_at DESC
    LIMIT 1
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'membership_id', v_membership.id,
    'status', 'SUSPENDED',
    'already_suspended', FALSE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.suspend_school_instructor_membership(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suspend_school_instructor_membership(UUID, TEXT) TO authenticated;
