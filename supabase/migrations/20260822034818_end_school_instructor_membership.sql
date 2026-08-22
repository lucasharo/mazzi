-- MAZZI — school-admin removal of an instructor membership
-- End the relationship without deleting its historical record.

CREATE OR REPLACE FUNCTION public.end_school_instructor_membership(
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
    RETURN jsonb_build_object(
      'success', FALSE,
      'membership_id', v_membership.id,
      'status', 'ENDED',
      'already_ended', TRUE
    );
  END IF;

  UPDATE public.driving_school_staff
  SET membership_status = 'ENDED'::public.school_membership_status,
      is_active = FALSE,
      ended_at = NOW(),
      ended_by = v_uid,
      end_reason = v_reason,
      updated_at = NOW()
  WHERE id = v_membership.id;

  -- The existing status-event trigger records the transition and actor.
  -- Keep the human-readable reason on that same historical event.
  UPDATE public.driving_school_membership_events
  SET reason = v_reason
  WHERE id = (
    SELECT e.id
    FROM public.driving_school_membership_events e
    WHERE e.membership_id = v_membership.id
      AND e.event_type = 'ENDED'::public.school_membership_event_type
      AND e.actor_id = v_uid
    ORDER BY e.created_at DESC
    LIMIT 1
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'membership_id', v_membership.id,
    'status', 'ENDED',
    'already_ended', FALSE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.end_school_instructor_membership(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.end_school_instructor_membership(UUID, TEXT) TO authenticated;
