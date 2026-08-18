-- ============================================================================
-- MAZZI MIGRATION 20260818000034: CANCELLATION FLOW & CANONICAL RPC (DEC-013)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'cancelled_at'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN cancelled_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'cancellation_reason'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN cancellation_reason TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'cancelled_by'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN cancelled_by TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'refund_amount_in_cents'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN refund_amount_in_cents BIGINT DEFAULT 0;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- RPC: cancel_booking_v2
-- Atomic, secure, idempotent cancellation procedure adhering to DEC-013
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_booking_v2(
  p_booking_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_reason_code TEXT DEFAULT NULL,
  p_is_legal_override BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_user_role TEXT;
  v_booking RECORD;
  v_hours_until NUMERIC;
  v_refund_pct INT := 0;
  v_refund_cents BIGINT := 0;
  v_new_status TEXT;
  v_reason_final TEXT;
  v_policy_desc TEXT;
BEGIN
  -- 1. Identify authenticated caller
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Usuário não autenticado.' USING ERRCODE = '40100';
  END IF;

  -- 2. Fetch actor role
  SELECT role::TEXT INTO v_user_role FROM public.users WHERE id = v_actor_id;
  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND: Perfil do usuário não encontrado.' USING ERRCODE = '40400';
  END IF;

  -- 3. Lock booking row for update (Atomic Transaction)
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF v_booking IS NULL THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND: Agendamento não encontrado.' USING ERRCODE = '40401';
  END IF;

  -- 4. Check Ownership & Authorization
  IF v_user_role = 'STUDENT' THEN
    IF v_booking.student_id != v_actor_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED_STUDENT: Este agendamento pertence a outro aluno.' USING ERRCODE = '40301';
    END IF;
  ELSIF v_user_role IN ('INSTRUCTOR', 'SCHOOL_ADMIN', 'SCHOOL_STAFF', 'DRIVING_SCHOOL') THEN
    IF v_booking.provider_id != v_actor_id AND v_booking.instructor_id != v_actor_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED_PROVIDER: Este agendamento pertence a outro prestador.' USING ERRCODE = '40302';
    END IF;
    IF p_reason_code IS NULL AND (p_reason IS NULL OR trim(p_reason) = '') THEN
      RAISE EXCEPTION 'REASON_REQUIRED: O motivo do cancelamento é obrigatório para prestadores.' USING ERRCODE = '42201';
    END IF;
  ELSIF v_user_role != 'PLATFORM_ADMIN' THEN
    RAISE EXCEPTION 'UNAUTHORIZED_ROLE: Papel não autorizado a cancelar agendamento.' USING ERRCODE = '40300';
  END IF;

  -- 5. Idempotency Check
  IF v_booking.status IN ('CANCELLED_BY_STUDENT', 'CANCELLED_BY_PROVIDER') THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_idempotent', true,
      'booking_id', v_booking.id,
      'status', v_booking.status,
      'refund_amount_in_cents', COALESCE(v_booking.refund_amount_in_cents, 0),
      'message', 'Agendamento já se encontrava cancelado.'
    );
  END IF;

  -- 6. Terminal status validation
  IF v_booking.status IN ('COMPLETED', 'EXPIRED') THEN
    RAISE EXCEPTION 'INVALID_STATUS: Não é possível cancelar uma aula concluída ou expirada.' USING ERRCODE = '42200';
  END IF;

  -- 7. Calculate cancellation policy (DEC-013)
  v_hours_until := EXTRACT(EPOCH FROM (v_booking.lesson_date_time - NOW())) / 3600.0;
  v_new_status := CASE WHEN v_user_role = 'STUDENT' THEN 'CANCELLED_BY_STUDENT' ELSE 'CANCELLED_BY_PROVIDER' END;

  IF p_is_legal_override THEN
    v_refund_pct := 100;
    v_policy_desc := 'Reembolso integral por direito legal obrigatório (LEGAL_OVERRIDE).';
  ELSIF v_user_role = 'STUDENT' THEN
    IF v_hours_until >= 24.0 THEN
      v_refund_pct := 100;
      v_policy_desc := 'Cancelamento com 24h ou mais: Reembolso integral (100%).';
    ELSIF v_hours_until >= 6.0 THEN
      v_refund_pct := 50;
      v_policy_desc := 'Cancelamento entre 6h e 24h: Reembolso parcial (50%).';
    ELSE
      v_refund_pct := 0;
      v_policy_desc := 'Cancelamento com menos de 6h: Sem reembolso (0%).';
    END IF;
  ELSE
    v_refund_pct := 100;
    v_policy_desc := 'Cancelamento pelo prestador: Reembolso integral (100%) ao aluno.';
  END IF;

  v_refund_cents := ROUND((v_booking.total_in_cents * v_refund_pct) / 100.0);
  v_reason_final := COALESCE(
    CASE WHEN p_reason_code IS NOT NULL AND p_reason IS NOT NULL THEN p_reason_code || ': ' || p_reason
         WHEN p_reason_code IS NOT NULL THEN p_reason_code
         ELSE p_reason END,
    'Cancelamento realizado'
  );

  -- 8. Apply atomic DB state transition
  UPDATE public.bookings
  SET status = v_new_status,
      cancelled_at = NOW(),
      cancelled_by = CASE WHEN v_user_role = 'STUDENT' THEN 'STUDENT' ELSE 'PROVIDER' END,
      cancellation_reason = v_reason_final,
      refund_amount_in_cents = v_refund_cents,
      updated_at = NOW()
  WHERE id = p_booking_id;

  -- 9. Insert Audit Log
  INSERT INTO public.audit_logs (
    id, actor_id, actor_name, actor_role, action, entity_type, entity_id, previous_value, new_value, timestamp, ip_address
  ) VALUES (
    'audit_cancel_' || extract(epoch from now())::bigint || '_' || substr(md5(random()::text), 1, 6),
    v_actor_id,
    COALESCE(v_user_role, 'Usuário'),
    COALESCE(v_user_role, 'STUDENT'),
    'BOOKING_CANCELLED_' || v_new_status,
    'Booking',
    p_booking_id,
    v_booking.status,
    v_new_status,
    NOW(),
    '127.0.0.1'
  );

  -- 10. Return JSON result
  RETURN jsonb_build_object(
    'success', true,
    'is_idempotent', false,
    'booking_id', p_booking_id,
    'status', v_new_status,
    'refund_percentage', v_refund_pct,
    'refund_amount_in_cents', v_refund_cents,
    'policy_description', v_policy_desc,
    'cancellation_reason', v_reason_final,
    'cancelled_at', NOW()
  );
END;
$$;

-- Grant EXECUTE to authenticated users
REVOKE EXECUTE ON FUNCTION public.cancel_booking_v2 FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_booking_v2 TO authenticated;
