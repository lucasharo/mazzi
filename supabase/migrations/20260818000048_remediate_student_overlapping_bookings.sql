-- ============================================================================
-- MAZZI PLATFORM — SPRINT 20: CONTROLLED REMEDIATION OF LIVE STUDENT OVERLAPS
-- Migration: 20260818000048_remediate_student_overlapping_bookings.sql
-- ============================================================================

DO $$
DECLARE
  v_hist_kept_id      UUID := '7801e80b-679e-4d4b-8347-f75721df2355';
  v_hist_dup_id       UUID := 'f3e4d43a-dbf2-4e76-8f22-217d655741f8';
  v_hist_student_id   UUID := '93f9df4c-55a6-436d-97b3-beac28d69da7';
  v_hist_paid_pay_id  UUID := '7dfd2649-667a-4adb-978b-8b6bfc04003d';
  v_hist_pend_pay_id  UUID := 'f3e5e30c-2a06-432e-904e-2b886c3425f9';
  v_hist_paid_amount  INT  := 13500;

  v_fut_kept_id       UUID := 'ce1abfb2-16ce-430b-ace5-ad5698422dc1';
  v_fut_dup_id        UUID := '78d44619-5f7f-46f4-b1b2-5cad8b85501a';
  v_fut_student_id    UUID := '0dc61a5f-2f0d-439e-ab48-bffe685fbfa6';

  v_now               TIMESTAMPTZ := NOW();
  v_hist_dup_rec      RECORD;
  v_fut_dup_rec       RECORD;
  v_pay_paid_rec      RECORD;
  v_pay_pend_rec      RECORD;
  v_pay_fut_count     INT;
  v_existing_ref_count INT;
BEGIN
  -- --------------------------------------------------------------------------
  -- STEP 1: STRICT PRECONDITION VALIDATION (BEFORE ANY UPDATE)
  -- --------------------------------------------------------------------------

  -- 1.1 Historical Kept Booking
  IF NOT EXISTS (SELECT 1 FROM public.bookings WHERE id = v_hist_kept_id AND status = 'CONFIRMED') THEN
    RAISE EXCEPTION 'REMEDIATION_PRECONDITION_FAILED: Historical kept booking % is missing or not CONFIRMED', v_hist_kept_id;
  END IF;

  -- 1.2 Historical Duplicate Booking
  SELECT * INTO v_hist_dup_rec FROM public.bookings WHERE id = v_hist_dup_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REMEDIATION_PRECONDITION_FAILED: Historical duplicate booking % not found', v_hist_dup_id;
  END IF;
  IF v_hist_dup_rec.student_id <> v_hist_student_id THEN
    RAISE EXCEPTION 'REMEDIATION_PRECONDITION_FAILED: Student mismatch for historical duplicate booking %', v_hist_dup_id;
  END IF;

  -- 1.3 Historical Financial Checks (if still in blocking state)
  IF v_hist_dup_rec.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS') THEN
    -- Check PAID payment
    SELECT * INTO v_pay_paid_rec FROM public.payments WHERE id = v_hist_paid_pay_id;
    IF NOT FOUND OR v_pay_paid_rec.booking_id <> v_hist_dup_id OR v_pay_paid_rec.status <> 'PAID' OR v_pay_paid_rec.amount_in_cents <> v_hist_paid_amount THEN
      RAISE EXCEPTION 'REMEDIATION_PRECONDITION_FAILED: Historical PAID payment % is missing or invalid', v_hist_paid_pay_id;
    END IF;

    -- Check Legacy PENDING payment
    SELECT * INTO v_pay_pend_rec FROM public.payments WHERE id = v_hist_pend_pay_id;
    IF NOT FOUND OR v_pay_pend_rec.booking_id <> v_hist_dup_id OR v_pay_pend_rec.status <> 'PENDING' THEN
      RAISE EXCEPTION 'REMEDIATION_PRECONDITION_FAILED: Historical PENDING payment % is missing or invalid', v_hist_pend_pay_id;
    END IF;

    -- Check existing refunds
    SELECT COUNT(*) INTO v_existing_ref_count FROM public.refunds WHERE booking_id = v_hist_dup_id;
    IF v_existing_ref_count > 0 THEN
      RAISE EXCEPTION 'REMEDIATION_PRECONDITION_FAILED: Refund record already exists for historical booking %', v_hist_dup_id;
    END IF;
  END IF;

  -- 1.4 Future Kept Booking
  IF NOT EXISTS (SELECT 1 FROM public.bookings WHERE id = v_fut_kept_id AND status = 'CONFIRMED') THEN
    RAISE EXCEPTION 'REMEDIATION_PRECONDITION_FAILED: Future kept booking % is missing or not CONFIRMED', v_fut_kept_id;
  END IF;

  -- 1.5 Future Duplicate Booking
  SELECT * INTO v_fut_dup_rec FROM public.bookings WHERE id = v_fut_dup_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REMEDIATION_PRECONDITION_FAILED: Future duplicate booking % not found', v_fut_dup_id;
  END IF;
  IF v_fut_dup_rec.student_id <> v_fut_student_id THEN
    RAISE EXCEPTION 'REMEDIATION_PRECONDITION_FAILED: Student mismatch for future duplicate booking %', v_fut_dup_id;
  END IF;

  -- 1.6 Future Financial Checks (must have 0 payment rows)
  IF v_fut_dup_rec.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS') THEN
    SELECT COUNT(*) INTO v_pay_fut_count FROM public.payments WHERE booking_id = v_fut_dup_id;
    IF v_pay_fut_count <> 0 THEN
      RAISE EXCEPTION 'REMEDIATION_PRECONDITION_FAILED: Expected 0 payments for future duplicate booking %, found %', v_fut_dup_id, v_pay_fut_count;
    END IF;
  END IF;

  -- --------------------------------------------------------------------------
  -- STEP 2: REMEDIATE CONFLICT A (HISTORICAL DUPLICATE f3e4d43a...)
  -- --------------------------------------------------------------------------
  IF v_hist_dup_rec.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS') THEN
    -- Update booking status and cancellation metadata
    UPDATE public.bookings
    SET status = 'CANCELLED_BY_PROVIDER',
        cancelled_at = v_now,
        cancelled_by = 'SYSTEM',
        cancellation_reason = 'SYSTEM_DOUBLE_BOOKING_OVERLAP',
        refund_amount_in_cents = v_hist_paid_amount,
        updated_at = v_now
    WHERE id = v_hist_dup_id;

    -- Update legacy PENDING payment to FAILED
    UPDATE public.payments
    SET status = 'FAILED',
        updated_at = v_now
    WHERE id = v_hist_pend_pay_id;

    -- Update PAID payment to REFUNDED
    UPDATE public.payments
    SET status = 'REFUNDED',
        updated_at = v_now
    WHERE id = v_hist_paid_pay_id;

    -- Explicit Idempotency Check for Refund insertion
    IF NOT EXISTS (SELECT 1 FROM public.refunds WHERE idempotency_key = 'idem_ref_' || v_hist_dup_id) THEN
      INSERT INTO public.refunds (
        id, payment_id, booking_id, amount_in_cents, reason,
        idempotency_key, status, created_at
      ) VALUES (
        gen_random_uuid(),
        v_hist_paid_pay_id,
        v_hist_dup_id,
        v_hist_paid_amount,
        'SYSTEM_DOUBLE_BOOKING_OVERLAP_REMEDIATION',
        'idem_ref_' || v_hist_dup_id,
        'PROCESSED',
        v_now
      );
    END IF;

    -- Audit log with systemic attribution (actor_id = NULL, ip_address = NULL)
    INSERT INTO public.audit_logs (
      actor_id, action, entity_type, entity_id, previous_value, new_value,
      ip_address, user_agent, severity, created_at
    ) VALUES (
      NULL,
      'SYSTEM_DOUBLE_BOOKING_REMEDIATION',
      'BOOKINGS',
      v_hist_dup_id,
      jsonb_build_object(
        'status', v_hist_dup_rec.status,
        'paid_payment_status', v_pay_paid_rec.status,
        'pending_payment_status', v_pay_pend_rec.status,
        'refund_amount_in_cents', v_hist_dup_rec.refund_amount_in_cents
      ),
      jsonb_build_object(
        'status', 'CANCELLED_BY_PROVIDER',
        'cancelled_by', 'SYSTEM',
        'cancellation_reason', 'SYSTEM_DOUBLE_BOOKING_OVERLAP',
        'paid_payment_status', 'REFUNDED',
        'pending_payment_status', 'FAILED',
        'refund_amount_in_cents', v_hist_paid_amount
      ),
      NULL,
      'PostgreSQL Migration 48',
      'WARN',
      v_now
    );
  END IF;

  -- --------------------------------------------------------------------------
  -- STEP 3: REMEDIATE CONFLICT B (FUTURE DUPLICATE 78d44619...)
  -- --------------------------------------------------------------------------
  IF v_fut_dup_rec.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS') THEN
    -- Update booking status and cancellation metadata
    UPDATE public.bookings
    SET status = 'CANCELLED_BY_PROVIDER',
        cancelled_at = v_now,
        cancelled_by = 'SYSTEM',
        cancellation_reason = 'SYSTEM_DOUBLE_BOOKING_OVERLAP',
        refund_amount_in_cents = 0,
        updated_at = v_now
    WHERE id = v_fut_dup_id;

    -- Audit log with systemic attribution (actor_id = NULL, ip_address = NULL)
    INSERT INTO public.audit_logs (
      actor_id, action, entity_type, entity_id, previous_value, new_value,
      ip_address, user_agent, severity, created_at
    ) VALUES (
      NULL,
      'SYSTEM_DOUBLE_BOOKING_REMEDIATION',
      'BOOKINGS',
      v_fut_dup_id,
      jsonb_build_object(
        'status', v_fut_dup_rec.status,
        'refund_amount_in_cents', v_fut_dup_rec.refund_amount_in_cents
      ),
      jsonb_build_object(
        'status', 'CANCELLED_BY_PROVIDER',
        'cancelled_by', 'SYSTEM',
        'cancellation_reason', 'SYSTEM_DOUBLE_BOOKING_OVERLAP',
        'payments_count', 0,
        'refund_amount_in_cents', 0
      ),
      NULL,
      'PostgreSQL Migration 48',
      'WARN',
      v_now
    );
  END IF;
END $$;
