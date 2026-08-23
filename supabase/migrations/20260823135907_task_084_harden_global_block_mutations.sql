-- TASK-084: make legacy global-block create/update mutations use the same
-- instructor-scoped transaction lock and booking conflict rules as TASK-080.

CREATE OR REPLACE FUNCTION public.save_instructor_global_block(
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  p_reason TEXT DEFAULT NULL,
  p_block_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_now TIMESTAMPTZ := NOW();
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED: Usuário não autenticado.' USING ERRCODE = '40100';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = v_uid AND u.status = 'ACTIVE'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid AND ur.role = 'INSTRUCTOR'
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED_ROLE: Apenas instrutores credenciados podem gerenciar bloqueios pessoais globais.' USING ERRCODE = '40300';
  END IF;

  IF p_start_at IS NULL OR p_end_at IS NULL OR p_end_at <= p_start_at THEN
    RAISE EXCEPTION 'INVALID_TIME_RANGE: A data e hora final devem ser posteriores à data e hora inicial.' USING ERRCODE = '22023';
  END IF;

  IF p_end_at <= v_now THEN
    RAISE EXCEPTION 'EMERGENCY_BLOCK_IN_PAST' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('instructor-schedule:' || v_uid::text, 0)
  );

  IF p_block_id IS NOT NULL THEN
    SELECT b.id INTO v_id
    FROM public.instructor_global_blocks b
    WHERE b.id = p_block_id AND b.instructor_id = v_uid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'GLOBAL_BLOCK_NOT_FOUND_OR_UNAUTHORIZED: Bloqueio pessoal não encontrado ou você não tem permissão.' USING ERRCODE = '40300';
    END IF;
  ELSE
    v_id := gen_random_uuid();
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.instructor_id = v_uid
      AND b.scheduled_start_at < p_end_at
      AND p_start_at < b.scheduled_end_at
      AND (
        b.status IN ('CONFIRMED', 'IN_PROGRESS')
        OR (b.status = 'PENDING_PAYMENT' AND (b.hold_expires_at IS NULL OR b.hold_expires_at > v_now))
      )
  ) THEN
    RAISE EXCEPTION 'EMERGENCY_BLOCK_BOOKING_CONFLICT' USING ERRCODE = '23P01';
  END IF;

  IF p_block_id IS NULL THEN
    INSERT INTO public.instructor_global_blocks (
      id, instructor_id, start_at, end_at, reason, created_at, updated_at
    ) VALUES (
      v_id, v_uid, p_start_at, p_end_at, p_reason, v_now, v_now
    );
  ELSE
    UPDATE public.instructor_global_blocks
    SET start_at = p_start_at,
        end_at = p_end_at,
        reason = p_reason,
        updated_at = v_now
    WHERE id = v_id AND instructor_id = v_uid;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_id,
    'instructor_id', v_uid,
    'start_at', p_start_at,
    'end_at', p_end_at,
    'reason', p_reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_instructor_global_block(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_instructor_global_block(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_instructor_global_block(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID) TO authenticated, service_role;

-- Browser mutations must use the secured RPCs, never direct table DML.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.instructor_global_blocks FROM authenticated;
