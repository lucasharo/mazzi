-- ============================================================================
-- MAZZI PLATFORM — ADD CPF & BIRTH DATE (IDENTITY & 18-YEAR VALIDATION)
-- Sprint 17.2: Mandatory CPF (11 digits, unique) and birth_date (DATE, >=18 years)
-- for new Student registrations with database trigger and hardened RLS policy.
-- ============================================================================

-- 1. ADD COLUMNS (Nullable for backward-compatibility with legacy accounts)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS cpf VARCHAR(11),
  ADD COLUMN IF NOT EXISTS birth_date DATE;

-- 2. CREATE UNIQUE PARTIAL INDEX ON CPF
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_cpf_unique
  ON public.users (cpf)
  WHERE cpf IS NOT NULL AND deleted_at IS NULL;

-- 3. FUNCTION TO VALIDATE CPF MATHEMATICALLY (CHECKSUMS & REPEATING SEQUENCES)
CREATE OR REPLACE FUNCTION public.validate_cpf(cpf_str TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_cpf TEXT;
  v_sum INTEGER;
  v_remainder INTEGER;
  v_digit1 INTEGER;
  v_digit2 INTEGER;
  i INTEGER;
BEGIN
  IF cpf_str IS NULL THEN
    RETURN FALSE;
  END IF;

  v_cpf := regexp_replace(cpf_str, '\D', '', 'g');

  IF length(v_cpf) != 11 THEN
    RETURN FALSE;
  END IF;

  -- Reject repeating sequences: 00000000000, 11111111111, ..., 99999999999
  IF v_cpf ~ '^(\d)\1{10}$' THEN
    RETURN FALSE;
  END IF;

  -- Calculate 1st check digit
  v_sum := 0;
  FOR i IN 1..9 LOOP
    v_sum := v_sum + substring(v_cpf, i, 1)::INTEGER * (11 - i);
  END LOOP;
  v_remainder := (v_sum * 10) % 11;
  IF v_remainder = 10 OR v_remainder = 11 THEN
    v_remainder := 0;
  END IF;
  v_digit1 := v_remainder;
  IF v_digit1 != substring(v_cpf, 10, 1)::INTEGER THEN
    RETURN FALSE;
  END IF;

  -- Calculate 2nd check digit
  v_sum := 0;
  FOR i IN 1..10 LOOP
    v_sum := v_sum + substring(v_cpf, i, 1)::INTEGER * (12 - i);
  END LOOP;
  v_remainder := (v_sum * 10) % 11;
  IF v_remainder = 10 OR v_remainder = 11 THEN
    v_remainder := 0;
  END IF;
  v_digit2 := v_remainder;
  IF v_digit2 != substring(v_cpf, 11, 1)::INTEGER THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. VALIDATION TRIGGER FOR STUDENT IDENTITY (CPF VALIDITY & 18-YEAR MINIMUM AGE)
CREATE OR REPLACE FUNCTION public.trigger_validate_user_student_identity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'STUDENT' THEN
    -- Enforce CPF validity if provided
    IF NEW.cpf IS NOT NULL THEN
      IF NOT public.validate_cpf(NEW.cpf) THEN
        RAISE EXCEPTION 'CPF_INVALID: O CPF fornecido é matematicamente inválido.';
      END IF;
    END IF;

    -- Enforce Birth Date validity if provided
    IF NEW.birth_date IS NOT NULL THEN
      IF NEW.birth_date > CURRENT_DATE THEN
        RAISE EXCEPTION 'BIRTH_DATE_FUTURE: A data de nascimento não pode ser no futuro.';
      END IF;
      IF NEW.birth_date > (CURRENT_DATE - INTERVAL '18 years') THEN
        RAISE EXCEPTION 'MINIMUM_AGE_VIOLATION: Para utilizar o MAZZI, você precisa ter pelo menos 18 anos.';
      END IF;
    END IF;

    -- Prevent direct mutation of identity columns by non-admins
    IF TG_OP = 'UPDATE' THEN
      IF OLD.cpf IS NOT NULL AND NEW.cpf IS DISTINCT FROM OLD.cpf THEN
        IF NOT public.is_platform_admin() THEN
          RAISE EXCEPTION 'CPF_IMMUTABLE: O CPF não pode ser alterado diretamente pelo usuário.';
        END IF;
      END IF;
      IF OLD.birth_date IS NOT NULL AND NEW.birth_date IS DISTINCT FROM OLD.birth_date THEN
        IF NOT public.is_platform_admin() THEN
          RAISE EXCEPTION 'BIRTH_DATE_IMMUTABLE: A data de nascimento não pode ser alterada diretamente pelo usuário.';
        END IF;
      END IF;
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

-- 5. UPDATE RLS POLICY ON USERS FOR NEW STUDENT CREATION
DROP POLICY IF EXISTS "Authenticated users can create own student profile" ON public.users;

CREATE POLICY "Authenticated users can create own student profile" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (
    (id = auth.uid())
    AND (role = 'STUDENT'::user_role)
    AND (status = 'ACTIVE'::user_status)
    AND (lower(email::text) = lower(COALESCE(auth.jwt() ->> 'email', '')))
    AND (cpf IS NOT NULL AND length(cpf) = 11 AND public.validate_cpf(cpf))
    AND (birth_date IS NOT NULL AND birth_date <= (CURRENT_DATE - INTERVAL '18 years'))
  );
