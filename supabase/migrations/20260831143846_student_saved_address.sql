-- MAZZI — Persist the student's preferred meeting address.
-- The address is stored in users.metadata and is only writable for the
-- authenticated user's own student profile.

CREATE OR REPLACE FUNCTION public.update_my_student_address(
  p_address JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_updated_user JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Usuário não autenticado.';
  END IF;

  IF p_address IS NULL OR jsonb_typeof(p_address) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_STUDENT_ADDRESS: Endereço do aluno inválido.';
  END IF;

  UPDATE public.users
  SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::JSONB),
    '{student_saved_address}',
    p_address,
    true
  ),
  updated_at = NOW()
  WHERE id = v_user_id
    AND role = 'STUDENT'
    AND deleted_at IS NULL
  RETURNING to_jsonb(public.users.*) INTO v_updated_user;

  IF v_updated_user IS NULL THEN
    RAISE EXCEPTION 'STUDENT_PROFILE_NOT_FOUND: Perfil de aluno não encontrado.';
  END IF;

  RETURN v_updated_user;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_student_address(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_student_address(JSONB) TO authenticated, service_role;
