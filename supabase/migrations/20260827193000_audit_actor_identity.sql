-- Preserve the real audit actor identity in the Admin history.
CREATE OR REPLACE FUNCTION public.get_admin_audit_logs()
RETURNS TABLE (
  id UUID,
  actor_id UUID,
  actor_name VARCHAR(255),
  actor_role public.user_role,
  action VARCHAR(100),
  entity_type VARCHAR(100),
  entity_id VARCHAR(100),
  previous_value JSONB,
  new_value JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  IF NOT public.current_user_has_permission('admin.audit.read'::public.app_permission) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    al.id,
    al.actor_id,
    COALESCE(u.name, CASE WHEN al.actor_id IS NULL THEN 'Sistema' ELSE 'Usuário' END)::VARCHAR(255),
    COALESCE(u.role, 'PLATFORM_ADMIN'::public.user_role),
    al.action,
    al.entity_type,
    al.entity_id,
    al.previous_value,
    al.new_value,
    al.ip_address,
    al.created_at
  FROM public.audit_logs AS al
  LEFT JOIN public.users AS u ON u.id = al.actor_id
  ORDER BY al.created_at DESC
  LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_audit_logs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_audit_logs() TO authenticated;
