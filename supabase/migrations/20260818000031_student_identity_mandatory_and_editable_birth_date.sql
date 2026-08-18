-- ============================================================================
-- MAZZI PLATFORM — MANDATORY STUDENT IDENTITY & EDITABLE BIRTH DATE
-- Migration: 20260818000031_student_identity_mandatory_and_editable_birth_date.sql
-- ============================================================================

-- 1. HARDEN TRIGGER FOR MANDATORY STUDENT IDENTITY (CPF IMMUTABLE, BIRTH DATE EDITABLE WITH AGE >= 18)
CREATE OR REPLACE FUNCTION public.trigger_validate_user_student_identity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'STUDENT' THEN
    -- Enforce mandatory CPF for STUDENT
    IF NEW.cpf IS NULL OR trim(NEW.cpf) = '' THEN
      RAISE EXCEPTION 'CPF_REQUIRED: O CPF é obrigatório para cadastrar um Aluno.';
    END IF;

    -- Enforce CPF mathematical validity
    IF NOT public.validate_cpf(NEW.cpf) THEN
      RAISE EXCEPTION 'CPF_INVALID: O CPF fornecido é matematicamente inválido.';
    END IF;

    -- Enforce mandatory Birth Date for STUDENT
    IF NEW.birth_date IS NULL THEN
      RAISE EXCEPTION 'BIRTH_DATE_REQUIRED: A data de nascimento é obrigatória para cadastrar um Aluno.';
    END IF;

    -- Enforce Birth Date non-future and minimum age of 18 years
    IF NEW.birth_date > CURRENT_DATE THEN
      RAISE EXCEPTION 'BIRTH_DATE_FUTURE: A data de nascimento não pode ser no futuro.';
    END IF;

    IF NEW.birth_date > (CURRENT_DATE - INTERVAL '18 years') THEN
      RAISE EXCEPTION 'MINIMUM_AGE_VIOLATION: Para utilizar o MAZZI, você precisa ter pelo menos 18 anos.';
    END IF;

    -- Prevent direct mutation of CPF on UPDATE (IMMUTABLE)
    IF TG_OP = 'UPDATE' THEN
      IF OLD.cpf IS NOT NULL AND NEW.cpf IS DISTINCT FROM OLD.cpf THEN
        IF NOT public.is_platform_admin() THEN
          RAISE EXCEPTION 'CPF_IMMUTABLE: O CPF não pode ser alterado pelo usuário.';
        END IF;
      END IF;
      -- Birth date IS EDITABLE by student as long as it satisfies the 18+ and non-future validation above!
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_user_student_identity ON public.users;
CREATE TRIGGER trg_validate_user_student_identity
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_validate_user_student_identity();

-- 2. BACKFILL DEMO STUDENT ACCOUNTS WITH SYNTHETIC VALID CPFs AND BIRTH DATES
UPDATE public.users SET cpf = '52901000088', birth_date = '1995-05-15' WHERE email = 'aluno01@mazzi.com.br';
UPDATE public.users SET cpf = '52902000022', birth_date = '1998-08-20' WHERE email = 'aluno02@mazzi.com.br';
UPDATE public.users SET cpf = '52903000077', birth_date = '1992-03-10' WHERE email = 'aluno03@mazzi.com.br';
UPDATE public.users SET cpf = '52904000011', birth_date = '1996-11-25' WHERE email = 'aluno04@mazzi.com.br';
UPDATE public.users SET cpf = '52905000066', birth_date = '1990-01-05' WHERE email = 'aluno05@mazzi.com.br';
UPDATE public.users SET cpf = '52906000000', birth_date = '1997-07-12' WHERE email = 'aluno06@mazzi.com.br';
UPDATE public.users SET cpf = '52907000055', birth_date = '1994-09-18' WHERE email = 'aluno07@mazzi.com.br';
UPDATE public.users SET cpf = '52908000008', birth_date = '1999-12-30' WHERE email = 'aluno08@mazzi.com.br';
UPDATE public.users SET cpf = '52909000044', birth_date = '1991-04-22' WHERE email = 'aluno09@mazzi.com.br';
UPDATE public.users SET cpf = '52910000079', birth_date = '1993-06-08' WHERE email = 'aluno10@mazzi.com.br';

-- 3. UPDATE RPC FUNCTION update_my_profile TO ALLOW UPDATING BIRTH DATE SECURELY
CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_birth_date TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_role user_role;
  v_parsed_birth_date DATE;
  v_updated_user RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Usuário não autenticado.';
  END IF;

  SELECT role INTO v_user_role FROM public.users WHERE id = v_user_id AND deleted_at IS NULL;
  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND: Perfil de usuário não encontrado.';
  END IF;

  -- Parse birth_date if provided
  IF p_birth_date IS NOT NULL AND trim(p_birth_date) != '' THEN
    BEGIN
      v_parsed_birth_date := p_birth_date::DATE;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'INVALID_BIRTH_DATE_FORMAT: Data de nascimento em formato inválido.';
    END;
  END IF;

  -- Update fields for authenticated user
  UPDATE public.users
  SET
    name = COALESCE(NULLIF(trim(p_name), ''), name),
    phone = COALESCE(NULLIF(trim(p_phone), ''), phone),
    avatar_url = CASE WHEN p_avatar_url IS NOT NULL THEN p_avatar_url ELSE avatar_url END,
    birth_date = CASE WHEN v_parsed_birth_date IS NOT NULL THEN v_parsed_birth_date ELSE birth_date END,
    updated_at = NOW()
  WHERE id = v_user_id
  RETURNING * INTO v_updated_user;

  RETURN to_jsonb(v_updated_user);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_my_profile(TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
