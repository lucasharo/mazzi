-- MAZZI — secure school/instructor membership read surface

CREATE OR REPLACE FUNCTION public.list_school_instructor_invitations(p_school_id UUID)
RETURNS SETOF public.driving_school_invitations
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_school_admin(p_school_id) AND NOT public.is_compliance_reviewer() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN QUERY SELECT i.* FROM public.driving_school_invitations i
  WHERE i.school_id=p_school_id ORDER BY i.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_school_memberships(p_school_id UUID)
RETURNS TABLE (membership_id UUID, user_id UUID, instructor_name TEXT, instructor_email TEXT,
  membership_status public.school_membership_status, is_active BOOLEAN, accepted_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_school_admin(p_school_id) AND NOT public.is_compliance_reviewer() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN QUERY SELECT d.id,d.user_id,u.name::TEXT,u.email::TEXT,d.membership_status,d.is_active,d.accepted_at
  FROM public.driving_school_staff d JOIN public.users u ON u.id=d.user_id WHERE d.school_id=p_school_id ORDER BY u.name;
END;
$$;

REVOKE ALL ON FUNCTION public.list_school_instructor_invitations(UUID) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.list_school_memberships(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_school_instructor_invitations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_school_memberships(UUID) TO authenticated;
