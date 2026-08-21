-- MAZZI — M57: secure Admin read RPCs
-- Read-only access remains closed at table level; authorization is enforced here.

CREATE OR REPLACE FUNCTION public.get_admin_audit_logs()
RETURNS TABLE (
  id UUID,
  actor_id UUID,
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
    RAISE EXCEPTION 'AUTH_REQUIRED'
      USING ERRCODE = '28000';
  END IF;

  IF NOT public.current_user_has_permission(
    'admin.audit.read'::public.app_permission
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    al.id,
    al.actor_id,
    al.action,
    al.entity_type,
    al.entity_id,
    al.previous_value,
    al.new_value,
    al.ip_address,
    al.created_at
  FROM public.audit_logs AS al
  ORDER BY al.created_at DESC
  LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_audit_logs() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_audit_logs() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_admin_audit_logs() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_platform_configurations()
RETURNS TABLE (
  key VARCHAR(100),
  value JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED'
      USING ERRCODE = '28000';
  END IF;

  IF NOT public.current_user_has_permission(
    'admin.platform.manage_settings'::public.app_permission
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT pc.key, pc.value
  FROM public.platform_configurations AS pc;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_platform_configurations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_platform_configurations() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_admin_platform_configurations() TO authenticated;
