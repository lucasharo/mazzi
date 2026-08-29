-- Release a student's payment hold before any payment is made.
-- Kept separate from cancel_booking_v2, whose commercial policy applies to
-- confirmed bookings.
CREATE OR REPLACE FUNCTION public.cancel_pending_booking(
  p_booking_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_booking RECORD;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Usuário não autenticado.' USING ERRCODE = '40100';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF v_booking IS NULL THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND: Agendamento não encontrado.' USING ERRCODE = '40401';
  END IF;

  IF v_booking.student_id <> v_actor_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED_STUDENT: Este agendamento pertence a outro aluno.' USING ERRCODE = '40301';
  END IF;

  IF v_booking.status::TEXT <> 'PENDING_PAYMENT' THEN
    RAISE EXCEPTION 'BOOKING_NOT_PENDING_PAYMENT: A reserva não está aguardando pagamento.' USING ERRCODE = '42200';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.payments
    WHERE booking_id = p_booking_id AND status::TEXT = 'PAID'
  ) THEN
    RAISE EXCEPTION 'BOOKING_ALREADY_PAID: Esta reserva já possui pagamento confirmado.' USING ERRCODE = '42201';
  END IF;

  UPDATE public.bookings
  SET status = 'CANCELLED_BY_STUDENT'::public.booking_status,
      cancelled_at = NOW(),
      cancelled_by = 'STUDENT',
      cancellation_reason = 'Reserva cancelada antes do pagamento',
      refund_amount_in_cents = 0,
      updated_at = NOW()
  WHERE id = p_booking_id;

  INSERT INTO public.audit_logs (
    id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at, ip_address
  ) VALUES (
    gen_random_uuid(), v_actor_id, 'BOOKING_CANCELLED_BEFORE_PAYMENT', 'Booking', p_booking_id,
    jsonb_build_object('status', 'PENDING_PAYMENT'),
    jsonb_build_object('status', 'CANCELLED_BY_STUDENT', 'reason', 'Reserva cancelada antes do pagamento'),
    NOW(), NULL
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'status', 'CANCELLED_BY_STUDENT',
    'cancelled_at', NOW()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_pending_booking(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_pending_booking(UUID) TO authenticated;
