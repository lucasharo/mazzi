-- MAZZI — TASK-076A: canonical role hydration, privilege revocation,
-- and conservative Advisor performance cleanup. Forward-only.

CREATE OR REPLACE FUNCTION public.get_my_roles()
RETURNS TABLE(role public.user_role)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF (select auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  SELECT DISTINCT r.role
  FROM (
    SELECT u.role
    FROM public.users AS u
    WHERE u.id = (select auth.uid())
      AND u.status = 'ACTIVE'::public.user_status
    UNION ALL
    SELECT ur.role
    FROM public.user_roles AS ur
    JOIN public.users AS u ON u.id = ur.user_id
    WHERE ur.user_id = (select auth.uid())
      AND u.status = 'ACTIVE'::public.user_status
  ) AS r
  ORDER BY r.role;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_roles() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_roles() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_roles() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_user_role(
  p_user_id UUID,
  p_role public.user_role
)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_previous public.users;
  v_updated public.users;
  v_before_roles JSONB;
  v_after_roles JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  IF p_user_id = v_uid THEN RAISE EXCEPTION 'SELF_ROLE_CHANGE_FORBIDDEN' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_previous FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  SELECT COALESCE(jsonb_agg(role ORDER BY role), '[]'::jsonb) INTO v_before_roles
  FROM (
    SELECT v_previous.role AS role
    UNION
    SELECT ur.role FROM public.user_roles AS ur WHERE ur.user_id = p_user_id
  ) AS before_roles;

  UPDATE public.users
  SET role = p_role, updated_at = now()
  WHERE id = p_user_id
  RETURNING * INTO v_updated;

  IF v_previous.role IS DISTINCT FROM p_role THEN
    DELETE FROM public.user_roles
    WHERE user_id = p_user_id AND role = v_previous.role;
  END IF;

  INSERT INTO public.user_roles(user_id, role, granted_by)
  VALUES (p_user_id, p_role, v_uid)
  ON CONFLICT (user_id, role) DO NOTHING;

  SELECT COALESCE(jsonb_agg(role ORDER BY role), '[]'::jsonb) INTO v_after_roles
  FROM (
    SELECT v_updated.role AS role
    UNION
    SELECT ur.role FROM public.user_roles AS ur WHERE ur.user_id = p_user_id
  ) AS after_roles;

  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, previous_value, new_value)
  VALUES (
    v_uid, 'ADMIN_USER_ROLE_CHANGED', 'User', p_user_id::TEXT,
    jsonb_build_object('primary_role', v_previous.role, 'roles', v_before_roles),
    jsonb_build_object('primary_role', p_role, 'roles', v_after_roles)
  );
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user_role(UUID, public.user_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(UUID, public.user_role) TO authenticated;

-- Advisor-confirmed missing FK indexes. Each index is created only when the
-- exact name is absent; no existing index or policy is replaced.
CREATE INDEX IF NOT EXISTS idx_compliance_documents_user_id ON public.compliance_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_compliance_documents_vehicle_id ON public.compliance_documents(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_compliance_documents_reviewed_by ON public.compliance_documents(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_school_invitations_target_user_id ON public.driving_school_invitations(target_user_id);
CREATE INDEX IF NOT EXISTS idx_school_invitations_invited_by ON public.driving_school_invitations(invited_by);
CREATE INDEX IF NOT EXISTS idx_membership_events_user_id ON public.driving_school_membership_events(user_id);
CREATE INDEX IF NOT EXISTS idx_membership_events_actor_id ON public.driving_school_membership_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_membership_events_invitation_id ON public.driving_school_membership_events(invitation_id);
CREATE INDEX IF NOT EXISTS idx_payouts_booking_id ON public.payouts(booking_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON public.refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_booking_id ON public.refunds(booking_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_granted_by ON public.user_roles(granted_by);

-- Semantically equivalent init-plan rewrites; authorization predicates are
-- unchanged and no permissive policy is consolidated in this migration.
ALTER POLICY "Users can view own roles" ON public.user_roles
  USING ((user_id = (select auth.uid())) OR is_platform_admin());
ALTER POLICY "School staff and members can view their school team" ON public.driving_school_staff
  USING (is_current_user_active() AND (is_school_member(school_id) OR user_id = (select auth.uid()) OR is_platform_admin()));
ALTER POLICY notifications_select_own ON public.notifications
  USING (is_current_user_active() AND user_id = (select auth.uid()));
ALTER POLICY notifications_update_read_own ON public.notifications
  USING (is_current_user_active() AND user_id = (select auth.uid()))
  WITH CHECK (is_current_user_active() AND user_id = (select auth.uid()));
ALTER POLICY "Users can read own profile" ON public.users
  USING (((select auth.uid()) = id AND status = 'ACTIVE'::public.user_status) OR is_platform_admin());
ALTER POLICY "Users can update own profile" ON public.users
  USING ((select auth.uid()) = id AND status = 'ACTIVE'::public.user_status)
  WITH CHECK ((select auth.uid()) = id AND status = 'ACTIVE'::public.user_status);
