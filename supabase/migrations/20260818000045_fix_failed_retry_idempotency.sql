-- MAZZI PLATFORM — MIGRATION 45: FIX FAILED RETRY IDEMPOTENCY
-- Problem: Retrying a FAILED payment failed due to UNIQUE violation on idempotency_key, because frontend sends fixed key.
-- Fix: If generating a new attempt (e.g. after FAILED), completely ignore p_idempotency_key and generate unique one.
-- Also introduces mark_booking_payment_failed RPC.

CREATE OR REPLACE FUNCTION public.create_booking_payment(
  p_booking_id UUID,
  p_method public.payment_method,
  p_idempotency_key VARCHAR DEFAULT NULL,
  p_gateway_provider VARCHAR DEFAULT 'fake_payment_gateway'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID;
  v_booking RECORD;
  v_payment RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_payment_id UUID;
  v_effective_idem_key VARCHAR;
BEGIN
  -- 1. Authentication Check
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '28000';
  END IF;

  -- 2. Lock & Load Booking
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Ownership
  IF v_booking.student_id <> v_uid THEN
    RAISE EXCEPTION 'CROSS_STUDENT_BOOKING_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  -- 4. Status
  IF v_booking.status <> 'PENDING_PAYMENT' THEN
    IF v_booking.status = 'CONFIRMED' THEN
      RAISE EXCEPTION 'BOOKING_ALREADY_PAID' USING ERRCODE = '22000';
    ELSE
      RAISE EXCEPTION 'BOOKING_NOT_PENDING_PAYMENT' USING ERRCODE = '22000';
    END IF;
  END IF;

  -- 5. Hold expiration — UPDATE first, then return (no RAISE to avoid rollback)
  IF v_booking.hold_expires_at IS NOT NULL AND v_booking.hold_expires_at <= v_now THEN
    UPDATE public.bookings SET status = 'EXPIRED', expired_at = v_now, updated_at = v_now WHERE id = p_booking_id;
    RETURN jsonb_build_object('success', false, 'error', 'BOOKING_HOLD_EXPIRED', 'message', 'The booking hold has expired');
  END IF;

  -- 6. Gateway whitelist
  IF p_gateway_provider <> 'fake_payment_gateway' THEN
    RAISE EXCEPTION 'REAL_PAYMENT_GATEWAY_NOT_ENABLED' USING ERRCODE = '22000';
  END IF;

  -- 7. Cross-booking idempotency key check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_payment FROM public.payments WHERE idempotency_key = p_idempotency_key;
    IF FOUND AND v_payment.booking_id <> p_booking_id THEN
      RAISE EXCEPTION 'PAYMENT_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BOOKING' USING ERRCODE = '22000';
    END IF;
  END IF;

  -- 8. Existing payment lookup
  SELECT * INTO v_payment FROM public.payments WHERE booking_id = p_booking_id ORDER BY created_at DESC LIMIT 1;

  IF FOUND THEN
    IF v_payment.status = 'PAID' THEN
      RAISE EXCEPTION 'BOOKING_ALREADY_PAID' USING ERRCODE = '22000';
    END IF;

    IF v_payment.status IN ('REFUNDED', 'CHARGEBACK') THEN
      RAISE EXCEPTION 'PAYMENT_IN_TERMINAL_STATE_NO_RETRY' USING ERRCODE = '22000';
    END IF;

    IF v_payment.status IN ('PENDING', 'AUTHORIZED') THEN
      -- Migrate legacy supabase_gateway payments
      IF v_payment.gateway_provider = 'supabase_gateway' THEN
        UPDATE public.payments
        SET gateway_provider = 'fake_payment_gateway',
            idempotency_key = 'idem_pay_' || p_booking_id,
            method = p_method,
            updated_at = v_now
        WHERE id = v_payment.id;
      ELSIF v_payment.method <> p_method AND v_payment.status = 'PENDING' THEN
        UPDATE public.payments SET method = p_method, updated_at = v_now WHERE id = v_payment.id;
      END IF;

      RETURN jsonb_build_object(
        'success', true, 'is_idempotent', true,
        'payment_id', v_payment.id, 'booking_id', v_payment.booking_id,
        'status', v_payment.status, 'amount_in_cents', v_payment.amount_in_cents
      );
    END IF;
    -- FAILED → fall through to create new attempt
  END IF;

  -- 9. Create new payment attempt (FAILED retry OR no existing payment)
  -- FOR FAILED RETRIES: Ignore the incoming p_idempotency_key entirely to prevent UNIQUE violations
  -- from legacy/fixed frontend keys. Generate a purely unique one.
  v_payment_id := gen_random_uuid();
  v_effective_idem_key := 'idem_pay_' || p_booking_id || '_' || v_payment_id;

  -- INSERT with ONLY existing columns in public.payments
  INSERT INTO public.payments (
    id, booking_id, method, status, amount_in_cents,
    idempotency_key, gateway_provider, created_at, updated_at
  ) VALUES (
    v_payment_id, p_booking_id, p_method, 'PENDING', v_booking.total_in_cents,
    v_effective_idem_key, p_gateway_provider, v_now, v_now
  );

  RETURN jsonb_build_object(
    'success', true, 'is_idempotent', false,
    'payment_id', v_payment_id, 'booking_id', p_booking_id,
    'status', 'PENDING', 'amount_in_cents', v_booking.total_in_cents
  );
END;
$$;

-- Permissions
REVOKE ALL ON FUNCTION public.create_booking_payment(UUID, public.payment_method, VARCHAR, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_booking_payment(UUID, public.payment_method, VARCHAR, VARCHAR) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_booking_payment(UUID, public.payment_method, VARCHAR, VARCHAR) TO authenticated, service_role;


-- NEW RPC: mark_booking_payment_failed
CREATE OR REPLACE FUNCTION public.mark_booking_payment_failed(
  p_payment_id UUID,
  p_reason VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID;
  v_payment RECORD;
  v_booking RECORD;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- 1. Auth
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '28000';
  END IF;

  -- 2. Lock payment
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Booking ownership (via booking.student_id)
  SELECT * INTO v_booking FROM public.bookings WHERE id = v_payment.booking_id;
  IF NOT FOUND OR v_booking.student_id <> v_uid THEN
    RAISE EXCEPTION 'CROSS_STUDENT_PAYMENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  -- 4. Gateway whitelist
  IF v_payment.gateway_provider <> 'fake_payment_gateway' THEN
    RAISE EXCEPTION 'REAL_PAYMENT_GATEWAY_CONFIRMATION_REQUIRES_TRUSTED_BACKEND' USING ERRCODE = '42501';
  END IF;

  -- 5. Only PENDING/AUTHORIZED can be failed
  IF v_payment.status NOT IN ('PENDING', 'AUTHORIZED') THEN
    RAISE EXCEPTION 'PAYMENT_NOT_IN_FAILURABLE_STATE' USING ERRCODE = '22000';
  END IF;

  -- 6. Mark as FAILED
  UPDATE public.payments
  SET status = 'FAILED',
      metadata = COALESCE(metadata, '{}') || jsonb_build_object('failureReason', p_reason),
      updated_at = v_now
  WHERE id = p_payment_id;

  -- 7. Keep booking as PENDING_PAYMENT (allow retry while hold is valid)
  -- Note: booking stays PENDING_PAYMENT, not terminal

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'status', 'FAILED',
    'booking_id', v_payment.booking_id,
    'booking_status', v_booking.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mark_booking_payment_failed(UUID, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_booking_payment_failed(UUID, VARCHAR) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_booking_payment_failed(UUID, VARCHAR) TO authenticated, service_role;
