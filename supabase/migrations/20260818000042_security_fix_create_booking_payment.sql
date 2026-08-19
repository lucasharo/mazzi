-- ============================================================================
-- MAZZI PLATFORM — MIGRATION 42: SECURITY FIX FOR CREATE_BOOKING_PAYMENT RPC
-- File: supabase/migrations/20260818000042_security_fix_create_booking_payment.sql
-- ============================================================================

-- Step 1: Drop old overloaded signature (uuid, varchar, varchar, varchar) created in Migration 41
DROP FUNCTION IF EXISTS public.create_booking_payment(UUID, VARCHAR, VARCHAR, VARCHAR);

-- Step 2: Drop any legacy payment_method or varchar overload to guarantee EXACTLY 1 signature
DROP FUNCTION IF EXISTS public.create_booking_payment(UUID, public.payment_method, VARCHAR, VARCHAR);

-- Step 3: Create single canonical SECURITY DEFINER function with strict execution order
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

  -- 2. Lock & Load Booking (FOR UPDATE)
  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Ownership Check (Must belong to authenticated student)
  IF v_booking.student_id <> v_uid THEN
    RAISE EXCEPTION 'CROSS_STUDENT_BOOKING_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  -- 4. Booking Status Check
  IF v_booking.status <> 'PENDING_PAYMENT' THEN
    IF v_booking.status = 'CONFIRMED' THEN
      RAISE EXCEPTION 'BOOKING_ALREADY_PAID' USING ERRCODE = '22000';
    ELSE
      RAISE EXCEPTION 'BOOKING_NOT_PENDING_PAYMENT' USING ERRCODE = '22000';
    END IF;
  END IF;

  -- 5. Hold Expiration Check
  IF v_booking.hold_expires_at IS NOT NULL AND v_booking.hold_expires_at <= v_now THEN
    UPDATE public.bookings
    SET status = 'EXPIRED', expired_at = v_now, updated_at = v_now
    WHERE id = p_booking_id;

    RAISE EXCEPTION 'BOOKING_HOLD_EXPIRED' USING ERRCODE = '22000';
  END IF;

  -- 6. Gateway Whitelist
  IF p_gateway_provider <> 'fake_payment_gateway' THEN
    RAISE EXCEPTION 'REAL_PAYMENT_GATEWAY_NOT_ENABLED' USING ERRCODE = '22000';
  END IF;

  -- 7. Idempotency Key Cross-Booking Reuse Check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_payment
    FROM public.payments
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND AND v_payment.booking_id <> p_booking_id THEN
      RAISE EXCEPTION 'PAYMENT_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BOOKING' USING ERRCODE = '22000';
    END IF;
  END IF;

  -- 8. Existing Payment Lookup for this booking
  SELECT * INTO v_payment
  FROM public.payments
  WHERE booking_id = p_booking_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    IF v_payment.status = 'PAID' THEN
      RAISE EXCEPTION 'BOOKING_ALREADY_PAID' USING ERRCODE = '22000';
    END IF;

    IF v_payment.status IN ('PENDING', 'AUTHORIZED') THEN
      -- Update method if user selected a different method for the pending payment
      IF v_payment.method <> p_method AND v_payment.status = 'PENDING' THEN
        UPDATE public.payments
        SET method = p_method, updated_at = v_now
        WHERE id = v_payment.id;
      END IF;

      RETURN jsonb_build_object(
        'success', true,
        'is_idempotent', true,
        'payment_id', v_payment.id,
        'booking_id', v_payment.booking_id,
        'status', v_payment.status,
        'amount_in_cents', v_payment.amount_in_cents
      );
    END IF;
    -- If status is FAILED, DECLINED, or CANCELLED, fall through to create a new PENDING payment attempt below.
  END IF;

  -- 9. Create New Payment Attempt
  v_payment_id := gen_random_uuid();
  v_effective_idem_key := COALESCE(p_idempotency_key, 'idem_pay_' || v_booking.id || '_' || extract(epoch from v_now)::bigint);

  INSERT INTO public.payments (
    id,
    booking_id,
    student_id,
    provider_id,
    method,
    status,
    amount_in_cents,
    platform_fee_in_cents,
    provider_amount_in_cents,
    idempotency_key,
    gateway_provider,
    created_at,
    updated_at
  ) VALUES (
    v_payment_id,
    v_booking.id,
    v_booking.student_id,
    v_booking.provider_id,
    p_method,
    'PENDING',
    v_booking.total_in_cents,
    v_booking.platform_fee_in_cents,
    (v_booking.total_in_cents - v_booking.platform_fee_in_cents),
    v_effective_idem_key,
    p_gateway_provider,
    v_now,
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'is_idempotent', false,
    'payment_id', v_payment_id,
    'booking_id', v_booking.id,
    'status', 'PENDING',
    'amount_in_cents', v_booking.total_in_cents
  );
END;
$$;

-- Step 4: Permissions (Revoke from PUBLIC & anon; grant strictly to authenticated and service_role)
REVOKE ALL ON FUNCTION public.create_booking_payment(UUID, public.payment_method, VARCHAR, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_booking_payment(UUID, public.payment_method, VARCHAR, VARCHAR) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_booking_payment(UUID, public.payment_method, VARCHAR, VARCHAR) TO authenticated, service_role;
