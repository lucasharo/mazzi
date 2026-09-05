CREATE OR REPLACE FUNCTION public.list_my_school_invitation_contexts()
RETURNS TABLE (
  invitation_id UUID,
  school_id UUID,
  school_name TEXT,
  school_avatar_url TEXT,
  status public.school_invitation_status,
  expires_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT i.id, i.school_id, COALESCE(p.trade_name, p.legal_name)::TEXT,
    p.avatar_url, i.status, i.expires_at
  FROM public.driving_school_invitations i
  JOIN public.providers p ON p.id = i.school_id
  WHERE auth.uid() IS NOT NULL
    AND i.status = 'PENDING'
    AND (i.target_user_id = auth.uid() OR (
      i.target_user_id IS NULL
      AND LOWER(BTRIM(i.invited_email)) = LOWER(BTRIM((SELECT u.email FROM public.users u WHERE u.id = auth.uid())))
    ))
  ORDER BY i.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_my_school_invitation_contexts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_school_invitation_contexts() TO authenticated;
