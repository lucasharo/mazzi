-- ============================================================================
-- MAZZI PLATFORM — SPRINT 20: CONTROLLED REMEDIATION OF LIVE STUDENT OVERLAPS
-- Migration: 20260818000048_remediate_student_overlapping_bookings.sql
-- ============================================================================

DO $$
DECLARE
  v_hist_duplicate_id UUID := 'f3e4d43a-dbf2-4e76-8f22-217d655741f8';
  v_hist_student_id   UUID := '93f9df4c-55a6-436d-97b3-beac28d69da7';
  v_hist_payment_id   UUID := '7dfd2649-62bd-48e0-811c-c9012f4581f1';

  v_fut_duplicate_id  UUID := '78d44619-5f7f-46f4-b1b2-5cad8b85501a';
  v_fut_student_id    UUID := '0dc61a5f-2f0d-439e-ab48-bffe685fbfa6';

  v_now TIMESTAMPTZ := NOW();
  v_booking_rec RECORD;
  v_pay_rec RECORD;
BEGIN
  -- --------------------------------------------------------------------------
  -- 1. REMEDIATE CONFLICT A (Historical Duplicate f3e4d43a...)
  -- --------------------------------------------------------------------------
  SELECT * INTO v_booking_rec FROM public.bookings WHERE id = v_hist_duplicate_id;

  IF FOUND THEN
    -- Precondition check: student ID must match
    IF v_booking_rec.student_id <> v_hist_student_id THEN
      RAISE EXCEPTION 'REMEDIATION_PRECONDITION_FAILED: Student ID mismatch for historical booking %', v_hist_duplicate_id;
    END IF;

    -- Idempotent status transition: only transition if currently in blocking state
    IF v_booking_rec.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS') THEN
      UPDATE public.bookings
      SET status = 'CANCELLED_BY_PROVIDER',
          updated_at = v_now
      WHERE id = v_hist_duplicate_id;

      -- Financial consistency: update payment status if PAID
      SELECT * INTO v_pay_rec FROM public.payments WHERE id = v_hist_payment_id;
      IF FOUND AND v_pay_rec.status = 'PAID' THEN
        UPDATE public.payments
        SET status = 'REFUNDED',
            updated_at = v_now
        WHERE id = v_hist_payment_id;

        -- Record refund entry in public.refunds
        INSERT INTO public.refunds (
          id, payment_id, booking_id, amount_in_cents, reason,
          idempotency_key, status, created_at
        ) VALUES (
          gen_random_uuid(),
          v_hist_payment_id,
          v_hist_duplicate_id,
          v_pay_rec.amount_in_cents,
          'SYSTEM_DOUBLE_BOOKING_OVERLAP_REMEDIATION',
          'idem_ref_' || v_hist_duplicate_id,
          'PROCESSED',
          v_now
        )
        ON CONFLICT (idempotency_key) DO NOTHING;
      END IF;

      -- Audit trail
      INSERT INTO public.audit_logs (
        actor_id, action, entity_type, entity_id, new_value, ip_address, user_agent, severity, created_at
      ) VALUES (
        v_hist_student_id,
        'SYSTEM_DOUBLE_BOOKING_REMEDIATION',
        'BOOKINGS',
        v_hist_duplicate_id,
        jsonb_build_object(
          'previous_status', v_booking_rec.status,
          'new_status', 'CANCELLED_BY_PROVIDER',
          'payment_remediated', v_hist_payment_id,
          'reason', 'SYSTEM_DOUBLE_BOOKING_OVERLAP'
        ),
        '127.0.0.1',
        'PostgreSQL Migration 48 (SECURITY DEFINER)',
        'WARN',
        v_now
      );
    END IF;
  END IF;

  -- --------------------------------------------------------------------------
  -- 2. REMEDIATE CONFLICT B (Future Duplicate 78d44619...)
  -- --------------------------------------------------------------------------
  SELECT * INTO v_booking_rec FROM public.bookings WHERE id = v_fut_duplicate_id;

  IF FOUND THEN
    -- Precondition check: student ID must match
    IF v_booking_rec.student_id <> v_fut_student_id THEN
      RAISE EXCEPTION 'REMEDIATION_PRECONDITION_FAILED: Student ID mismatch for future booking %', v_fut_duplicate_id;
    END IF;

    -- Idempotent status transition: only transition if currently in blocking state
    IF v_booking_rec.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS') THEN
      UPDATE public.bookings
      SET status = 'CANCELLED_BY_PROVIDER',
          updated_at = v_now
      WHERE id = v_fut_duplicate_id;

      -- Audit trail
      INSERT INTO public.audit_logs (
        actor_id, action, entity_type, entity_id, new_value, ip_address, user_agent, severity, created_at
      ) VALUES (
        v_fut_student_id,
        'SYSTEM_DOUBLE_BOOKING_REMEDIATION',
        'BOOKINGS',
        v_fut_duplicate_id,
        jsonb_build_object(
          'previous_status', v_booking_rec.status,
          'new_status', 'CANCELLED_BY_PROVIDER',
          'payments_count', 0,
          'reason', 'SYSTEM_DOUBLE_BOOKING_OVERLAP'
        ),
        '127.0.0.1',
        'PostgreSQL Migration 48 (SECURITY DEFINER)',
        'WARN',
        v_now
      );
    END IF;
  END IF;
END $$;
