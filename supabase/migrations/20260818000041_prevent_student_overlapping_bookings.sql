-- ============================================================================
-- MAZZI PLATFORM — MIGRATION 41: STUDENT OVERLAPPING BOOKINGS PROTECTION & REAL PAYMENT RPC
-- File: supabase/migrations/20260818000041_prevent_student_overlapping_bookings.sql
-- ============================================================================

-- Step 1: Remove authorized single duplicate conflicting booking on live DB (if present)
DELETE FROM public.payments WHERE booking_id = '3af862ad-4167-4260-9ccf-89f0c14f1be7';
DELETE FROM public.conversations WHERE booking_id = '3af862ad-4167-4260-9ccf-89f0c14f1be7';
DELETE FROM public.reviews WHERE booking_id = '3af862ad-4167-4260-9ccf-89f0c14f1be7';
DELETE FROM public.bookings WHERE id = '3af862ad-4167-4260-9ccf-89f0c14f1be7';

-- Step 2: Ensure btree_gist extension and slot_range column exist
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='bookings' AND column_name='slot_range'
  ) THEN
    ALTER TABLE public.bookings 
      ADD COLUMN slot_range TSTZRANGE GENERATED ALWAYS AS (
        tstzrange(scheduled_start_at, scheduled_end_at, '[)')
      ) STORED;
  END IF;
END $$;

-- Step 3: Add Exclusion Constraint on student_id to prevent double-booking for the same student
DO $$
BEGIN
  ALTER TABLE public.bookings
    DROP CONSTRAINT IF EXISTS exclude_student_overlapping_bookings;

  ALTER TABLE public.bookings
    ADD CONSTRAINT exclude_student_overlapping_bookings
    EXCLUDE USING gist (
      student_id WITH =,
      slot_range WITH &&
    )
    WHERE (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'));
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE NOTICE 'Constraint exclude_student_overlapping_bookings pending cleanup authorization for remaining pre-existing conflicts.';
END $$;

-- Step 4: Index for student schedule conflict lookups
CREATE INDEX IF NOT EXISTS idx_bookings_student_active_slots
  ON public.bookings (student_id, scheduled_start_at, scheduled_end_at)
  WHERE status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS');

-- Step 5: Create/Replace create_booking_payment RPC to manage real payment UUIDs and idempotency
CREATE OR REPLACE FUNCTION public.create_booking_payment(
  p_booking_id UUID,
  p_method VARCHAR,
  p_idempotency_key VARCHAR DEFAULT NULL,
  p_gateway_provider VARCHAR DEFAULT 'fake_payment_gateway'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_booking RECORD;
  v_payment RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_payment_id UUID;
BEGIN
  -- 1. Check idempotency if key provided
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_payment FROM public.payments
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'is_idempotent', true,
        'payment_id', v_payment.id,
        'booking_id', v_payment.booking_id,
        'status', v_payment.status,
        'amount_in_cents', v_payment.amount_in_cents
      );
    END IF;
  END IF;

  -- 2. Lock & Load Booking
  SELECT * INTO v_booking FROM public.bookings
  WHERE id = p_booking_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- Check if booking hold is expired
  IF v_booking.status = 'PENDING_PAYMENT' AND v_booking.hold_expires_at IS NOT NULL AND v_booking.hold_expires_at <= v_now THEN
    UPDATE public.bookings
    SET status = 'EXPIRED', expired_at = v_now, updated_at = v_now
    WHERE id = p_booking_id;

    RAISE EXCEPTION 'BOOKING_HOLD_EXPIRED' USING ERRCODE = '22000';
  END IF;

  -- Check for existing pending/valid payment for this booking
  SELECT * INTO v_payment FROM public.payments
  WHERE booking_id = p_booking_id
  ORDER BY created_at DESC LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_idempotent', true,
      'payment_id', v_payment.id,
      'booking_id', v_payment.booking_id,
      'status', v_payment.status,
      'amount_in_cents', v_payment.amount_in_cents
    );
  END IF;

  -- Insert new payment row
  v_payment_id := gen_random_uuid();
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
    COALESCE(p_idempotency_key, 'pay_' || v_booking.id),
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

-- Revoke public & anon access to RPC; grant exclusively to authenticated and service_role
REVOKE ALL ON FUNCTION public.create_booking_payment(UUID, VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_booking_payment(UUID, VARCHAR, VARCHAR, VARCHAR) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_booking_payment(UUID, VARCHAR, VARCHAR, VARCHAR) TO authenticated, service_role;
