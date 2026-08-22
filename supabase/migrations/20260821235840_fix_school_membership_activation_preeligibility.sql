-- MAZZI — Separate activation readiness from runtime instructor eligibility.
-- Forward-only: keeps the runtime gate strict for search and booking access.

CREATE OR REPLACE FUNCTION public.try_activate_school_instructor_membership(
  p_membership_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_membership public.driving_school_staff%ROWTYPE;
  v_school public.providers%ROWTYPE;
  v_user public.users%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT * INTO v_membership
  FROM public.driving_school_staff
  WHERE id = p_membership_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBERSHIP_NOT_FOUND';
  END IF;

  -- Preserve the existing authorization boundary for reviewer, school admin,
  -- and the linked instructor acting on their own membership.
  IF NOT (
    public.is_compliance_reviewer()
    OR public.is_school_admin(v_membership.school_id)
    OR v_membership.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  IF v_membership.membership_status <> 'PENDING_COMPLIANCE'::public.school_membership_status THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'membership_id', v_membership.id,
      'status', v_membership.membership_status
    );
  END IF;

  SELECT * INTO v_school
  FROM public.providers
  WHERE id = v_membership.school_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SCHOOL_NOT_FOUND';
  END IF;
  IF v_school.status <> 'ACTIVE'::public.provider_status THEN
    RAISE EXCEPTION 'PROVIDER_NOT_ACTIVE';
  END IF;
  IF v_school.type <> 'DRIVING_SCHOOL'::public.provider_type THEN
    RAISE EXCEPTION 'PROVIDER_NOT_DRIVING_SCHOOL';
  END IF;

  SELECT * INTO v_user
  FROM public.users
  WHERE id = v_membership.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;
  IF v_user.status <> 'ACTIVE'::public.user_status THEN
    RAISE EXCEPTION 'USER_NOT_ACTIVE';
  END IF;
  IF NOT (
    v_user.role = 'INSTRUCTOR'::public.user_role
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = v_user.id
        AND ur.role = 'INSTRUCTOR'::public.user_role
    )
  ) THEN
    RAISE EXCEPTION 'INSTRUCTOR_ROLE_REQUIRED';
  END IF;

  -- Activation readiness intentionally uses dedicated pre-activation checks:
  -- the runtime gate requires ACTIVE membership and would create a circular gate.
  IF NOT public.is_instructor_global_compliance_valid(v_membership.user_id, NULL)
     OR NOT public.is_membership_compliance_valid(v_membership.id, NULL) THEN
    RAISE EXCEPTION 'COMPLIANCE_NOT_SATISFIED';
  END IF;

  UPDATE public.driving_school_staff
  SET membership_status = 'ACTIVE',
      is_active = TRUE,
      suspended_at = NULL,
      suspended_by = NULL,
      ended_at = NULL,
      ended_by = NULL,
      end_reason = NULL,
      updated_at = NOW()
  WHERE id = v_membership.id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'membership_id', v_membership.id,
    'status', 'ACTIVE'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.try_activate_school_instructor_membership(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.try_activate_school_instructor_membership(UUID) TO authenticated;
