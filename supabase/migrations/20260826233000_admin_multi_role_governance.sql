-- TASK-078: administrative access is additive. It must never replace a user's
-- primary role or remove a legitimate existing role.
BEGIN;

CREATE OR REPLACE FUNCTION public.admin_grant_administrative_role_from_server(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_role public.user_role
)
RETURNS TABLE(target_user_id uuid, assigned_role public.user_role, added boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_added boolean := false;
  v_inserted_rows integer := 0;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_actor_id AND ur.role = 'PLATFORM_ADMIN'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF p_role NOT IN ('PLATFORM_ADMIN', 'SUPPORT') THEN
    RAISE EXCEPTION 'INVALID_ADMINISTRATIVE_ROLE' USING ERRCODE = '22023';
  END IF;

  IF p_target_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = p_target_user_id AND u.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.user_roles (user_id, role, granted_by)
  VALUES (p_target_user_id, p_role, p_actor_id)
  ON CONFLICT (user_id, role) DO NOTHING;

  GET DIAGNOSTICS v_inserted_rows = ROW_COUNT;
  v_added := v_inserted_rows > 0;

  INSERT INTO public.audit_logs (
    actor_id, action, entity_type, entity_id, previous_value, new_value, created_at
  ) VALUES (
    p_actor_id,
    CASE WHEN v_added THEN 'ADMINISTRATIVE_ROLE_GRANTED' ELSE 'ADMINISTRATIVE_ROLE_ALREADY_PRESENT' END,
    'User',
    p_target_user_id::text,
    jsonb_build_object('roles_preserved', true),
    jsonb_build_object('added_role', p_role, 'added', v_added),
    now()
  );

  RETURN QUERY SELECT p_target_user_id, p_role, v_added;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_add_administrative_role(
  p_target_user_id uuid,
  p_role public.user_role
)
RETURNS TABLE(target_user_id uuid, assigned_role public.user_role, added boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  SELECT * FROM public.admin_grant_administrative_role_from_server(auth.uid(), p_target_user_id, p_role);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_administrative_role_from_server(uuid, uuid, public.user_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_administrative_role_from_server(uuid, uuid, public.user_role) TO service_role;

REVOKE ALL ON FUNCTION public.admin_add_administrative_role(uuid, public.user_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_add_administrative_role(uuid, public.user_role) TO authenticated;

COMMIT;
