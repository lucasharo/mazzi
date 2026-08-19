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
  v_hist_kept_rec     RECORD;
  v_hist_dup_rec      RECORD;
  v_fut_kept_rec      RECORD;
  v_fut_dup_rec       RECORD;
  v_pay_paid_rec      RECORD;
  v_pay_pend_rec      RECORD;
  v_ref_rec           RECORD;
  v_refund_idem_key   VARCHAR;
  v_pay_fut_count     INT;
  v_live_overlap_count INT;
  v_post_overlap_count INT;
BEGIN
  -- --------------------------------------------------------------------------
  -- STEP 1: STRICT PRECONDITION VALIDATION & ROW LOCKS (BEFORE ANY UPDATE)
  -- --------------------------------------------------------------------------

  -- 1.1 Verify total LIVE blocking student overlaps count is EXACTLY 2
  SELECT COUNT(*) INTO v_live_overlap_count
  FROM public.bookings a
  JOIN public.bookings b
    ON a.student_id = b.student_id
   AND a.id < b.id
   AND a.slot_range && b.slot_range
  WHERE a.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS')
    AND b.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS');

  IF v_live_overlap_count <> 2 THEN
    RAISE EXCEPTION 'REMEDIATION_PRECONDITION_FAILED: Expected exactly 2 active student overlap pairs in LIVE, found %', v_live_overlap_count;
  END IF;

  -- 1.2 Lock and validate Historical Kept Booking
  SELECT * INTO v_hist_kept_rec FROM public.bookings WHERE id = v_hist_kept_id FOR UPDATE;
  IF NOT FOUND OR v_hist_kept_rec.status <> 'CONFIRMED' OR v_hist_kept_rec.student_id <> v_hist_student_id THEN
    RAISE EXCEPTION 'REMEDIATION_PRECONDITION_FAILED: Historical kept booking % is missing or invalid', v_hist_kept_id;
  END IF;

  -- 1.3 Lock and validate Historical Duplicate Booking
  SELECT * INTO v_hist_dup_rec FROM public.bookings WHERE id = v_hist_dup_id FOR UPDATE;
  IF NOT FOUND OR v_hist_dup_rec.status <> 'CONFIRMED' OR v_hist_dup_rec.student_id <> v_hist_student_id THEN
    RAISE EXCEPTION 'REMEDIATION_PRECONDITION_FAILED: Historical duplicate booking % is missing or invalid', v_hist_dup_id;
  END IF;

  -- 1.4 Validate Historical Overlap
  IF NOT (v_hist_kept_rec.slot_range && v_hist_dup_rec.slot_range) THEN
    RAISE EXCEPTION 'REMEDIATION_PRECONDITION_FAILED: Historical bookings % and % do not overlap', v_hist_kept_id, v_hist_dup_id;
  END IF;

  -- 1.5 Historical Financial Row Locks & Preconditions
  SELECT * INTO v_pay_paid_rec FROM public.payments WHERE id = v_hist_paid_pay_id FOR UPDATE;
  IF NOT FOUND OR v_pay_paid_rec.booking_id <> v_hist_dup_id OR v_pay_paid_rec.status <> 'PAID' OR v_pay_paid_rec.amount_in_cents <> v_hist_paid_amount THEN
    RAISE EXCEPTION 'REMEDIATION_PRECONDITION_FAILED: Historical PAID payment % is missing or invalid', v_hist_paid_pay_id;
  END IF;

  SELECT * INTO v_pay_pend_rec FROM public.payments WHERE id = v_hist_pend_pay_id FOR UPDATE;
  IF NOT FOUND OR v_pay_pend_rec.booking_id <> v_hist_dup_id OR v_pay_pend_rec.status <> 'PENDING' THEN
    RAISE EXCEPTION 'REMEDIATION_PRECONDITION_FAILED: Historical PENDING payment % is missing or invalid', v_hist_pend_pay_id;
  END IF;

  -- 1.6 Refund Idempotency Collision Check
  v_refund_idem_key := 'idem_ref_' || v_hist_dup_id;
  SELECT * INTO v_ref_rec FROM public.refunds WHERE idempotency_key = v_refund_idem_key;
  IF FOUND THEN
    IF v_ref_rec.booking_id <> v_hist_dup_id OR v_ref_rec.payment_id <> v_hist_paid_pay_id OR v_ref_rec.amount_in_cents <> v_hist_paid_amount THEN
      RAISE EXCEPTION 'REMEDIATION_PRECONDITION_FAILED: Refund idempotency key collision for % on different entity/amount', v_refund_idem_key;
    END IF;
  END IF;

  -- 1.7 Lock and validate Future Kept Booking
  SELECT * INTO v_fut_kept_rec FROM public.bookings WHERE id = v_fut_kept_id FOR UPDATE;
  IF NOT FOUND OR v_fut_kept_rec.status <> 'CONFIRMED' OR v_fut_kept_rec.student_id <> v_fut_student_id THEN
    RAISE EXCEPTION 'REMEDIATION_PRECONDITION_FAILED: Future kept booking % is missing or invalid', v_fut_kept_id;
  END IF;

  -- 1.8 Lock and validate Future Duplicate Booking
  SELECT * INTO v_fut_dup_rec FROM public.bookings WHERE id = v_fut_dup_id FOR UPDATE;
  IF NOT FOUND OR v_fut_dup_rec.status <> 'CONFIRMED' OR v_fut_dup_rec.student_id <> v_fut_student_id THEN
    RAISE EXCEPTION 'REMEDIATION_PRECONDITION_FAILED: Future duplicate booking % is missing or invalid', v_fut_dup_id;
  END IF;

  -- 1.9 Validate Future Overlap
  IF NOT (v_fut_kept_rec.slot_range && v_fut_dup_rec.slot_range) THEN
    RAISE EXCEPTION 'REMEDIATION_PRECONDITION_FAILED: Future bookings % and % do not overlap', v_fut_kept_id, v_fut_dup_id;
  END IF;

  -- 1.10 Future Financial Precondition (must have 0 payment rows)
  SELECT COUNT(*) INTO v_pay_fut_count FROM public.payments WHERE booking_id = v_fut_dup_id;
  IF v_pay_fut_count <> 0 THEN
    RAISE EXCEPTION 'REMEDIATION_PRECONDITION_FAILED: Expected 0 payments for future duplicate booking %, found %', v_fut_dup_id, v_pay_fut_count;
  END IF;

  -- --------------------------------------------------------------------------
  -- STEP 2: ATOMIC REMEDIATION OF CONFLICT A (HISTORICAL DUPLICATE f3e4d43a...)
  -- --------------------------------------------------------------------------
  UPDATE public.bookings
  SET status = 'CANCELLED_BY_PROVIDER',
      cancelled_at = v_now,
      cancelled_by = 'SYSTEM',
      cancellation_reason = 'SYSTEM_DOUBLE_BOOKING_OVERLAP',
      refund_amount_in_cents = v_hist_paid_amount,
      updated_at = v_now
  WHERE id = v_hist_dup_id;

  UPDATE public.payments
  SET status = 'FAILED',
      updated_at = v_now
  WHERE id = v_hist_pend_pay_id;

  UPDATE public.payments
  SET status = 'REFUNDED',
      updated_at = v_now
  WHERE id = v_hist_paid_pay_id;

  IF NOT EXISTS (SELECT 1 FROM public.refunds WHERE idempotency_key = v_refund_idem_key) THEN
    INSERT INTO public.refunds (
      id, payment_id, booking_id, amount_in_cents, reason,
      idempotency_key, status, created_at
    ) VALUES (
      gen_random_uuid(),
      v_hist_paid_pay_id,
      v_hist_dup_id,
      v_hist_paid_amount,
      'SYSTEM_DOUBLE_BOOKING_OVERLAP_REMEDIATION',
      v_refund_idem_key,
      'PROCESSED',
      v_now
    );
  END IF;

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

  -- --------------------------------------------------------------------------
  -- STEP 3: ATOMIC REMEDIATION OF CONFLICT B (FUTURE DUPLICATE 78d44619...)
  -- --------------------------------------------------------------------------
  UPDATE public.bookings
  SET status = 'CANCELLED_BY_PROVIDER',
      cancelled_at = v_now,
      cancelled_by = 'SYSTEM',
      cancellation_reason = 'SYSTEM_DOUBLE_BOOKING_OVERLAP',
      refund_amount_in_cents = 0,
      updated_at = v_now
  WHERE id = v_fut_dup_id;

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

  -- --------------------------------------------------------------------------
  -- STEP 4: POSTCONDITION VERIFICATION (VERIFY 0 OVERLAPS REMAIN)
  -- --------------------------------------------------------------------------

  -- 4.1 Verify 0 remaining active student overlap pairs in public.bookings
  SELECT COUNT(*) INTO v_post_overlap_count
  FROM public.bookings a
  JOIN public.bookings b
    ON a.student_id = b.student_id
   AND a.id < b.id
   AND a.slot_range && b.slot_range
  WHERE a.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS')
    AND b.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS');

  IF v_post_overlap_count <> 0 THEN
    RAISE EXCEPTION 'REMEDIATION_POSTCONDITION_FAILED: Expected 0 remaining active student overlap pairs, found %', v_post_overlap_count;
  END IF;

  -- 4.2 Verify Historical Duplicate remediated state
  SELECT status, refund_amount_in_cents INTO v_hist_dup_rec FROM public.bookings WHERE id = v_hist_dup_id;
  IF v_hist_dup_rec.status <> 'CANCELLED_BY_PROVIDER' OR v_hist_dup_rec.refund_amount_in_cents <> v_hist_paid_amount THEN
    RAISE EXCEPTION 'REMEDIATION_POSTCONDITION_FAILED: Historical duplicate booking status or refund amount invalid';
  END IF;

  SELECT status INTO v_pay_paid_rec FROM public.payments WHERE id = v_hist_paid_pay_id;
  IF v_pay_paid_rec.status <> 'REFUNDED' THEN
    RAISE EXCEPTION 'REMEDIATION_POSTCONDITION_FAILED: Historical PAID payment status is not REFUNDED';
  END IF;

  SELECT status INTO v_pay_pend_rec FROM public.payments WHERE id = v_hist_pend_pay_id;
  IF v_pay_pend_rec.status <> 'FAILED' THEN
    RAISE EXCEPTION 'REMEDIATION_POSTCONDITION_FAILED: Historical PENDING payment status is not FAILED';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.refunds WHERE idempotency_key = v_refund_idem_key AND booking_id = v_hist_dup_id AND status = 'PROCESSED') THEN
    RAISE EXCEPTION 'REMEDIATION_POSTCONDITION_FAILED: Refund record missing or not PROCESSED';
  END IF;

  -- 4.3 Verify Future Duplicate remediated state
  SELECT status, refund_amount_in_cents INTO v_fut_dup_rec FROM public.bookings WHERE id = v_fut_dup_id;
  IF v_fut_dup_rec.status <> 'CANCELLED_BY_PROVIDER' OR v_fut_dup_rec.refund_amount_in_cents <> 0 THEN
    RAISE EXCEPTION 'REMEDIATION_POSTCONDITION_FAILED: Future duplicate booking status or refund amount invalid';
  END IF;

  SELECT COUNT(*) INTO v_pay_fut_count FROM public.payments WHERE booking_id = v_fut_dup_id;
  IF v_pay_fut_count <> 0 THEN
    RAISE EXCEPTION 'REMEDIATION_POSTCONDITION_FAILED: Expected 0 payments for future duplicate booking, found %', v_pay_fut_count;
  END IF;
END $$;
