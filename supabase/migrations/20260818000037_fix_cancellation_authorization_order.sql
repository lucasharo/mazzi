-- ============================================================================
-- MAZZI MIGRATION 20260818000037: FIX CANCELLATION AUTHORIZATION ORDER & PREVENT LEAKS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cancel_booking_v2(
  p_booking_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_reason_code TEXT DEFAULT NULL
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
  v_provider_user_id UUID;
  v_is_authorized_school_admin BOOLEAN := FALSE;
  v_hours_until NUMERIC;
  v_refund_pct INT := 0;
  v_refund_cents BIGINT := 0;
  v_new_status TEXT;
  v_reason_final TEXT;
  v_policy_desc TEXT;
BEGIN
  -- 1. Authenticate caller
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Usuário não autenticado.' USING ERRCODE = '40100';
  END IF;

  -- 2. Fetch user role
  SELECT role::TEXT INTO v_user_role FROM public.users WHERE id = v_actor_id;
  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND: Perfil de usuário não encontrado.' USING ERRCODE = '40400';
  END IF;

  -- 3. Lock booking row for update
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF v_booking IS NULL THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND: Agendamento não encontrado.' USING ERRCODE = '40401';
  END IF;

  -- 4. CRITICAL SECURITY GUARD: VALIDATE AUTHORIZATION / OWNERSHIP FIRST BEFORE ANY IDEMPOTENCY OR STATUS CHECK!
  IF v_user_role = 'STUDENT' THEN
    IF v_booking.student_id != v_actor_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED_STUDENT: Este agendamento pertence a outro aluno.' USING ERRCODE = '40301';
    END IF;

  ELSIF v_user_role = 'INSTRUCTOR' THEN
    -- Direct match on instructor_id OR autonomous provider owner
    SELECT user_id INTO v_provider_user_id FROM public.providers WHERE id = v_booking.provider_id;
    IF v_booking.instructor_id != v_actor_id AND v_provider_user_id != v_actor_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED_PROVIDER: Acesso negado. Você não é o instrutor nem o proprietário autônomo responsável.' USING ERRCODE = '40302';
    END IF;

  ELSIF v_user_role IN ('SCHOOL_ADMIN', 'DRIVING_SCHOOL') THEN
    -- Check if direct provider user OR active school admin via driving_school_staff / helper
    SELECT user_id INTO v_provider_user_id FROM public.providers WHERE id = v_booking.provider_id;
    IF v_provider_user_id = v_actor_id THEN
      v_is_authorized_school_admin := TRUE;
    ELSE
      -- Check driving_school_staff relation
      SELECT EXISTS (
        SELECT 1 FROM public.driving_school_staff
        WHERE school_id = v_booking.provider_id
          AND user_id = v_actor_id
          AND role::TEXT IN ('SCHOOL_ADMIN', 'DRIVING_SCHOOL')
          AND is_active = TRUE
      ) INTO v_is_authorized_school_admin;

      -- Check canonical helper if not matched above
      IF NOT v_is_authorized_school_admin THEN
        IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_school_admin') THEN
          EXECUTE 'SELECT public.is_school_admin($1)' INTO v_is_authorized_school_admin USING v_booking.provider_id;
        END IF;
      END IF;
    END IF;

    IF NOT v_is_authorized_school_admin THEN
      RAISE EXCEPTION 'UNAUTHORIZED_SCHOOL_ADMIN: Acesso negado. Você não é administrador da escola responsável por este agendamento.' USING ERRCODE = '40303';
    END IF;

  ELSIF v_user_role = 'SCHOOL_STAFF' THEN
    RAISE EXCEPTION 'UNAUTHORIZED_SCHOOL_STAFF: Membros da equipe (STAFF) não possuem permissão para realizar cancelamentos de aulas.' USING ERRCODE = '40304';

  ELSIF v_user_role != 'PLATFORM_ADMIN' THEN
    RAISE EXCEPTION 'UNAUTHORIZED_ROLE: Papel de usuário não autorizado a cancelar.' USING ERRCODE = '40300';
  END IF;

  -- 5. IDEMPOTENCY CHECK (ONLY PERMITTED AFTER AUTHORIZATION IS VALIDATED!)
  IF v_booking.status::TEXT IN ('CANCELLED_BY_STUDENT', 'CANCELLED_BY_PROVIDER') THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_idempotent', true,
      'booking_id', v_booking.id,
      'status', v_booking.status::TEXT,
      'refund_amount_in_cents', COALESCE(v_booking.refund_amount_in_cents, 0),
      'message', 'Agendamento já se encontrava cancelado.'
    );
  END IF;

  -- 6. Strict Status Whitelist (ONLY CONFIRMED is cancelable via commercial RPC)
  IF v_booking.status::TEXT = 'PENDING_PAYMENT' THEN
    RAISE EXCEPTION 'INVALID_STATUS: O status PENDING_PAYMENT pertence ao ciclo de retenção/checkout e não ao cancelamento comercial.' USING ERRCODE = '42200';
  ELSIF v_booking.status::TEXT != 'CONFIRMED' THEN
    RAISE EXCEPTION 'INVALID_STATUS: O status atual (%) não permite cancelamento comercial.', v_booking.status USING ERRCODE = '42200';
  END IF;

  -- 7. Past Lesson / Time Window Guard (scheduled_start_at > NOW() mandatory)
  IF v_booking.scheduled_start_at <= NOW() THEN
    RAISE EXCEPTION 'CANCELLATION_WINDOW_CLOSED: O horário de início da aula já passou ou a aula está em andamento.' USING ERRCODE = '42204';
  END IF;

  -- 8. Validate Provider Reason Code for Provider roles
  IF v_user_role IN ('INSTRUCTOR', 'SCHOOL_ADMIN', 'DRIVING_SCHOOL', 'PLATFORM_ADMIN') THEN
    IF p_reason_code IS NULL OR trim(p_reason_code) = '' THEN
      RAISE EXCEPTION 'REASON_REQUIRED: O motivo do cancelamento é obrigatório para prestadores.' USING ERRCODE = '42201';
    END IF;

    IF p_reason_code NOT IN ('VEHICLE_ISSUE', 'PERSONAL_EMERGENCY', 'SCHEDULE_CONFLICT', 'WEATHER_OR_SAFETY', 'OPERATIONAL_ISSUE', 'OTHER') THEN
      RAISE EXCEPTION 'REASON_CODE_INVALID: Código de motivo de cancelamento inválido.' USING ERRCODE = '42202';
    END IF;

    IF p_reason_code = 'OTHER' AND (p_reason IS NULL OR trim(p_reason) = '') THEN
      RAISE EXCEPTION 'REASON_DESCRIPTION_REQUIRED: A descrição textual é obrigatória para a opção "Outro motivo".' USING ERRCODE = '42203';
    END IF;
  END IF;

  -- 9. Compute antecedence & DEC-013 Refund Percentage
  v_hours_until := EXTRACT(EPOCH FROM (v_booking.scheduled_start_at - NOW())) / 3600.0;
  v_new_status := CASE WHEN v_user_role = 'STUDENT' THEN 'CANCELLED_BY_STUDENT' ELSE 'CANCELLED_BY_PROVIDER' END;

  IF v_user_role = 'STUDENT' THEN
    IF v_hours_until >= 24.0 THEN
      v_refund_pct := 100;
      v_policy_desc := 'Cancelamento com 24h ou mais de antecedência: Reembolso integral (100%).';
    ELSIF v_hours_until >= 6.0 THEN
      v_refund_pct := 50;
      v_policy_desc := 'Cancelamento entre 6h e 24h de antecedência: Reembolso parcial (50%).';
    ELSE
      v_refund_pct := 0;
      v_policy_desc := 'Cancelamento com menos de 6h de antecedência: Sem reembolso (0%).';
    END IF;
  ELSE
    v_refund_pct := 100;
    v_policy_desc := 'Cancelamento realizado pelo prestador: Reembolso integral (100%) ao aluno.';
  END IF;

  v_refund_cents := ROUND((v_booking.total_in_cents * v_refund_pct) / 100.0);
  v_reason_final := COALESCE(
    CASE WHEN p_reason_code IS NOT NULL AND p_reason IS NOT NULL AND trim(p_reason) != '' THEN p_reason_code || ': ' || trim(p_reason)
         WHEN p_reason_code IS NOT NULL THEN p_reason_code
         ELSE trim(p_reason) END,
    'Cancelamento realizado'
  );

  -- 10. Apply atomic state update
  UPDATE public.bookings
  SET status = v_new_status::public.booking_status,
      cancelled_at = NOW(),
      cancelled_by = CASE WHEN v_user_role = 'STUDENT' THEN 'STUDENT' ELSE 'PROVIDER' END,
      cancellation_reason = v_reason_final,
      refund_amount_in_cents = v_refund_cents,
      updated_at = NOW()
  WHERE id = p_booking_id;

  -- 11. Insert Audit Log (ip_address = NULL when unknown)
  INSERT INTO public.audit_logs (
    id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at, ip_address
  ) VALUES (
    gen_random_uuid(),
    v_actor_id,
    'BOOKING_CANCELLED_' || v_new_status,
    'Booking',
    p_booking_id,
    jsonb_build_object('status', v_booking.status::TEXT),
    jsonb_build_object('status', v_new_status, 'refund_amount_in_cents', v_refund_cents),
    NOW(),
    NULL
  );

  -- 12. Return JSON Result
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

-- Security permissions
REVOKE EXECUTE ON FUNCTION public.cancel_booking_v2(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_booking_v2(UUID, TEXT, TEXT) TO authenticated;
