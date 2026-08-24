-- MAZZI — TASK-096A4L-R: persist public signup identity metadata
-- Forward-only. Authorization never comes from raw_user_meta_data.role.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cpf TEXT;
  v_birth_date_text TEXT;
  v_birth_date DATE;
BEGIN
  -- Signup metadata is accepted only as identity data. CPF is stored canonically.
  v_cpf := NULLIF(
    regexp_replace(COALESCE(NEW.raw_user_meta_data->>'cpf', ''), '\D', '', 'g'),
    ''
  );

  v_birth_date_text := NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'birth_date', '')), '');
  IF v_birth_date_text IS NOT NULL THEN
    BEGIN
      v_birth_date := v_birth_date_text::DATE;
    EXCEPTION
      WHEN invalid_datetime_format OR datetime_field_overflow THEN
        RAISE EXCEPTION 'BIRTH_DATE_INVALID'
          USING ERRCODE = '22007';
    END;
  END IF;

  INSERT INTO public.users (
    id,
    email,
    name,
    phone,
    cpf,
    birth_date,
    role,
    status
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Novo Usuário'),
    COALESCE(NULLIF(BTRIM(NEW.raw_user_meta_data->>'phone'), ''), ''),
    v_cpf,
    v_birth_date,
    'STUDENT',
    'ACTIVE'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Every public signup starts as STUDENT. Privileged roles require a secure RPC.
  INSERT INTO public.user_roles (
    user_id,
    role
  ) VALUES (
    NEW.id,
    'STUDENT'
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- The function is trigger-internal and must not be callable through the Data API.
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM authenticated;
