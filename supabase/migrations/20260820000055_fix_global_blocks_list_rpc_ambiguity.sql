-- ============================================================================
-- MAZZI PLATFORM — HOTFIX: Instructor Global Blocks List RPC Ambiguity
-- Migration: 20260820000055_fix_global_blocks_list_rpc_ambiguity.sql
-- ============================================================================
-- Fixes SQLSTATE 42702 in get_my_instructor_global_blocks().
-- Because RETURNS TABLE exposes an output variable named `id`, the predicate
-- `WHERE id = v_uid` is ambiguous inside PL/pgSQL. Qualify the users column.

CREATE OR REPLACE FUNCTION public.get_my_instructor_global_blocks()
RETURNS TABLE (
  id UUID,
  instructor_id UUID,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  reason TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_is_active BOOLEAN := FALSE;
  v_has_role BOOLEAN := FALSE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED: Usuário não autenticado.' USING ERRCODE = '40100';
  END IF;

  SELECT (u.status = 'ACTIVE')
  INTO v_is_active
  FROM public.users AS u
  WHERE u.id = v_uid;

  IF v_is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'USER_INACTIVE: Usuário não está ativo no sistema.' USING ERRCODE = '40300';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles AS ur
    WHERE ur.user_id = v_uid
      AND ur.role = 'INSTRUCTOR'
  ) INTO v_has_role;

  IF NOT v_has_role THEN
    RAISE EXCEPTION 'UNAUTHORIZED_ROLE: Apenas instrutores credenciados podem gerenciar bloqueios pessoais globais.' USING ERRCODE = '40300';
  END IF;

  RETURN QUERY
  SELECT
    igb.id,
    igb.instructor_id,
    igb.start_at,
    igb.end_at,
    igb.reason,
    igb.created_at,
    igb.updated_at
  FROM public.instructor_global_blocks AS igb
  WHERE igb.instructor_id = v_uid
  ORDER BY igb.start_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_instructor_global_blocks() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_instructor_global_blocks() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_instructor_global_blocks() TO authenticated, service_role;
