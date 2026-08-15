-- ============================================================================
-- MAZZI PLATFORM — SPRINT 11.5: EXPLICIT MINIMUM PRIVILEGE MATRIX & WORKFLOW ALIGNMENT
-- File: supabase/migrations/20260815000011_fix_anon_permissions.sql
-- ============================================================================

-- 1. SCHEMA USAGE GRANTS
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Revoke all default table and sequence privileges from public to enforce explicit grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- ============================================================================
-- 2. PUBLIC CATALOG TABLES (SELECT ONLY for Anon & Authenticated)
-- ============================================================================

-- providers
-- anon: SELECT (Required for public catalog search)
-- authenticated: SELECT (Required for catalog lookups)
GRANT SELECT ON public.providers TO anon, authenticated;

-- service_offerings
-- anon: SELECT (Required for public service pricing directory)
-- authenticated: SELECT (Required to find services)
GRANT SELECT ON public.service_offerings TO anon, authenticated;

-- vehicles
-- anon: SELECT (Required for vehicle public detail search)
-- authenticated: SELECT (Required for fleet verification)
GRANT SELECT ON public.vehicles TO anon, authenticated;

-- ============================================================================
-- 3. ADMINISTRATIVE & PRIVATE CONFIGURATIONS (STRICTLY NO ACCESS)
-- ============================================================================
REVOKE ALL ON public.platform_configurations FROM anon, authenticated;

-- ============================================================================
-- 4. TRANSACTING TABLES (GOVERNED BY ROW-LEVEL SECURITY & SECURITY DEFINERS)
-- ============================================================================

-- users
-- anon: NONE
-- authenticated: SELECT, INSERT, UPDATE (Managed by RLS policy: auth.uid() = id)
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- user_roles
-- anon: NONE
-- authenticated: NONE (Roles are assigned securely by internal backend/triggers, never by client)
REVOKE ALL ON public.user_roles FROM anon, authenticated;

-- bookings
-- anon: NONE
-- authenticated: SELECT (Only own bookings via RLS). DIRECT INSERT = NO, DIRECT UPDATE = NO
GRANT SELECT ON public.bookings TO authenticated;

-- payments
-- anon: NONE
-- authenticated: SELECT (Only own payments via RLS). DIRECT INSERT = NO, DIRECT UPDATE = NO
GRANT SELECT ON public.payments TO authenticated;

-- compliance_documents
-- anon: NONE
-- authenticated: SELECT, INSERT, UPDATE (Only own documents under strict RLS)
GRANT SELECT, INSERT, UPDATE ON public.compliance_documents TO authenticated;

-- audit_logs
-- anon: NONE
-- authenticated: NONE (Append-only logging executed strictly server-side/triggers)
REVOKE ALL ON public.audit_logs FROM anon, authenticated;

-- ============================================================================
-- 5. REDEFINE create_booking_hold TO AUTOMATICALLY GENERATE PENDING PAYMENTS & AUDIT LOGS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_booking_hold(
  p_quote_id UUID,
  p_student_id UUID,
  p_idempotency_key VARCHAR DEFAULT NULL,
  p_hold_duration_minutes INT DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_quote RECORD;
  v_provider RECORD;
  v_vehicle RECORD;
  v_offering RECORD;
  v_existing_booking RECORD;
  v_booking_id UUID;
  v_payment_id UUID;
  v_now TIMESTAMPTZ := NOW();
  v_hold_expires_at TIMESTAMPTZ;
  v_snapshot JSONB;
BEGIN
  -- 1. Idempotency Check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_booking FROM public.bookings 
    WHERE idempotency_key = p_idempotency_key AND student_id = p_student_id;
    
    IF FOUND THEN
      IF v_existing_booking.quote_id = p_quote_id THEN
        -- Get corresponding payment
        SELECT id INTO v_payment_id FROM public.payments WHERE booking_id = v_existing_booking.id LIMIT 1;
        
        RETURN jsonb_build_object(
          'success', true,
          'is_idempotent', true,
          'booking_id', v_existing_booking.id,
          'payment_id', v_payment_id,
          'status', v_existing_booking.status,
          'hold_expires_at', v_existing_booking.hold_expires_at
        );
      ELSE
        RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST' USING ERRCODE = '23505';
      END IF;
    END IF;
  END IF;

  -- 2. Housekeeping: Expire stale PENDING_PAYMENT holds before evaluation
  UPDATE public.bookings 
  SET status = 'EXPIRED', expired_at = v_now, updated_at = v_now
  WHERE status = 'PENDING_PAYMENT' AND hold_expires_at <= v_now;

  -- 3. Load & Lock Quote
  SELECT * INTO v_quote FROM public.quotes 
  WHERE id = p_quote_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUOTE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_quote.student_id != p_student_id THEN
    RAISE EXCEPTION 'CROSS_STUDENT_QUOTE_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  IF v_quote.status != 'ACTIVE' THEN
    IF v_quote.status = 'CONSUMED' THEN
      RAISE EXCEPTION 'QUOTE_ALREADY_CONSUMED' USING ERRCODE = '22000';
    ELSE
      RAISE EXCEPTION 'QUOTE_NOT_ACTIVE' USING ERRCODE = '22000';
    END IF;
  END IF;

  IF v_quote.expires_at <= v_now THEN
    UPDATE public.quotes SET status = 'EXPIRED' WHERE id = p_quote_id;
    RAISE EXCEPTION 'QUOTE_EXPIRED' USING ERRCODE = '22000';
  END IF;

  -- 4. Revalidate Provider, Vehicle, and Service Offering operational eligibility
  SELECT * INTO v_provider FROM public.providers WHERE id = v_quote.provider_id;
  IF NOT FOUND OR v_provider.status != 'ACTIVE' THEN
    RAISE EXCEPTION 'PROVIDER_NOT_ACTIVE' USING ERRCODE = '22000';
  END IF;

  SELECT * INTO v_vehicle FROM public.vehicles WHERE id = v_quote.vehicle_id;
  IF NOT FOUND OR v_vehicle.status != 'ACTIVE' THEN
    RAISE EXCEPTION 'VEHICLE_NOT_ACTIVE' USING ERRCODE = '22000';
  END IF;

  SELECT * INTO v_offering FROM public.service_offerings WHERE id = v_quote.offering_id;
  IF NOT FOUND OR v_offering.is_active != TRUE THEN
    RAISE EXCEPTION 'OFFERING_NOT_ACTIVE' USING ERRCODE = '22000';
  END IF;

  -- 5. Calculate Hold Expiration
  v_hold_expires_at := v_now + (p_hold_duration_minutes || ' minutes')::INTERVAL;

  -- 6. Construct Immutable Historical Snapshot
  v_snapshot := jsonb_build_object(
    'providerId', v_provider.id,
    'providerName', v_provider.trade_name,
    'providerType', v_provider.type,
    'instructorId', v_quote.instructor_id,
    'instructorName', 'Instrutor ' || v_quote.instructor_id,
    'vehicleId', v_vehicle.id,
    'vehicleName', v_vehicle.brand || ' ' || v_vehicle.model,
    'vehicleBrand', v_vehicle.brand,
    'vehicleModel', v_vehicle.model,
    'category', v_offering.category,
    'transmission', v_vehicle.transmission,
    'durationMinutes', v_offering.duration_minutes,
    'priceInCents', v_quote.price_in_cents,
    'platformFeeInCents', v_quote.platform_fee_in_cents,
    'totalInCents', v_quote.total_in_cents,
    'meetingPoint', COALESCE(v_provider.neighborhood, v_provider.city)
  );

  -- 7. Insert Booking
  v_booking_id := gen_random_uuid();
  INSERT INTO public.bookings (
    id,
    student_id,
    provider_id,
    instructor_id,
    vehicle_id,
    offering_id,
    quote_id,
    status,
    scheduled_start_at,
    scheduled_end_at,
    hold_expires_at,
    idempotency_key,
    price_in_cents,
    platform_fee_in_cents,
    total_in_cents,
    snapshot_data,
    created_at,
    updated_at
  ) VALUES (
    v_booking_id,
    p_student_id,
    v_quote.provider_id,
    v_quote.instructor_id,
    v_quote.vehicle_id,
    v_quote.offering_id,
    p_quote_id,
    'PENDING_PAYMENT',
    v_quote.scheduled_start_at,
    v_quote.scheduled_end_at,
    v_hold_expires_at,
    p_idempotency_key,
    v_quote.price_in_cents,
    v_quote.platform_fee_in_cents,
    v_quote.total_in_cents,
    v_snapshot,
    v_now,
    v_now
  );

  -- 8. Mark Quote as CONSUMED
  UPDATE public.quotes 
  SET status = 'CONSUMED', consumed_at = v_now 
  WHERE id = p_quote_id;

  -- 9. Insert corresponding Pending Payment row securely (Resolving Direct INSERT = NO restriction)
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
    v_booking_id,
    p_student_id,
    v_quote.provider_id,
    'PIX',
    'PENDING',
    v_quote.total_in_cents,
    v_quote.platform_fee_in_cents,
    (v_quote.total_in_cents - v_quote.platform_fee_in_cents),
    'pay_hold_' || v_booking_id,
    'supabase_gateway',
    v_now,
    v_now
  );

  -- 10. Audit Log (Resolving Direct INSERT = NO restriction on audit_logs)
  INSERT INTO public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    new_value,
    ip_address,
    user_agent,
    severity,
    created_at
  ) VALUES (
    p_student_id,
    'BOOKING_CREATE_HOLD',
    'BOOKINGS',
    v_booking_id,
    jsonb_build_object('booking_id', v_booking_id, 'payment_id', v_payment_id, 'quote_id', p_quote_id),
    '127.0.0.1',
    'PostgreSQL Trigger (SECURITY DEFINER)',
    'INFO',
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'payment_id', v_payment_id,
    'status', 'PENDING_PAYMENT',
    'hold_expires_at', v_hold_expires_at
  );
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION 'SLOT_NO_LONGER_AVAILABLE' USING ERRCODE = '23P01';
END;
$$;

-- Grant execution to authenticated users
REVOKE ALL ON FUNCTION public.create_booking_hold(UUID, UUID, VARCHAR, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_booking_hold(UUID, UUID, VARCHAR, INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_booking_hold(UUID, UUID, VARCHAR, INT) TO authenticated, service_role;

-- ============================================================================
-- 6. REDEFINE confirm_booking_payment TO INCLUDE SECURE AUTOMATIC AUDIT LOGGING
-- ============================================================================
CREATE OR REPLACE FUNCTION public.confirm_booking_payment(
  p_payment_id UUID,
  p_external_payment_id VARCHAR DEFAULT NULL,
  p_paid_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment RECORD;
  v_booking RECORD;
  v_result JSONB;
BEGIN
  -- 1. Lock payment row
  SELECT * INTO v_payment
  FROM payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento % não encontrado.', p_payment_id;
  END IF;

  -- 2. Lock booking row
  SELECT * INTO v_booking
  FROM bookings
  WHERE id = v_payment.booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva % associada ao pagamento não encontrada.', v_payment.booking_id;
  END IF;

  -- 3. Idempotency check: already paid
  IF v_payment.status = 'PAID' AND v_booking.status = 'CONFIRMED' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_paid', true,
      'is_late_payment', false,
      'refund_pending', false,
      'booking_id', v_booking.id,
      'payment_id', v_payment.id,
      'status', 'CONFIRMED'
    );
  END IF;

  -- 4. Late payment handling: Booking was already EXPIRED or CANCELLED
  IF v_booking.status IN ('EXPIRED', 'CANCELLED_BY_STUDENT', 'CANCELLED_BY_PROVIDER') THEN
    UPDATE payments
    SET status = 'PAID',
        paid_at = p_paid_at,
        external_transaction_id = COALESCE(p_external_payment_id, external_transaction_id),
        metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{auto_refund_required}',
          'true'::jsonb
        ),
        updated_at = NOW()
    WHERE id = v_payment.id;

    -- Record financial event
    INSERT INTO financial_events (
      event_type, booking_id, payment_id, provider_id, student_id,
      amount_in_cents, platform_fee_in_cents, provider_amount_in_cents, metadata
    ) VALUES (
      'PAYMENT_PAID', v_booking.id, v_payment.id, v_payment.provider_id, v_payment.student_id,
      v_payment.amount_in_cents, 0, 0,
      jsonb_build_object('late_payment_on_expired_booking', true, 'booking_status', v_booking.status)
    );

    -- Secure Audit Log for Late Payment
    INSERT INTO public.audit_logs (
      actor_id,
      action,
      entity_type,
      entity_id,
      new_value,
      ip_address,
      user_agent,
      severity,
      created_at
    ) VALUES (
      v_booking.student_id,
      'BOOKING_LATE_PAYMENT',
      'BOOKINGS',
      v_booking.id,
      jsonb_build_object('booking_id', v_booking.id, 'payment_id', v_payment.id, 'booking_status', v_booking.status),
      '127.0.0.1',
      'PostgreSQL Trigger (SECURITY DEFINER)',
      'WARNING',
      NOW()
    );

    RETURN jsonb_build_object(
      'success', true,
      'already_paid', false,
      'is_late_payment', true,
      'refund_pending', true,
      'booking_id', v_booking.id,
      'payment_id', v_payment.id,
      'status', v_booking.status
    );
  END IF;

  -- 5. Normal Confirmation: Booking is PENDING_PAYMENT
  UPDATE payments
  SET status = 'PAID',
      paid_at = p_paid_at,
      external_transaction_id = COALESCE(p_external_payment_id, external_transaction_id),
      updated_at = NOW()
  WHERE id = v_payment.id;

  UPDATE bookings
  SET status = 'CONFIRMED',
      confirmed_at = p_paid_at,
      updated_at = NOW()
  WHERE id = v_booking.id;

  -- Insert ledger events
  INSERT INTO financial_events (
    event_type, booking_id, payment_id, provider_id, student_id,
    amount_in_cents, platform_fee_in_cents, provider_amount_in_cents
  ) VALUES (
    'PAYMENT_PAID', v_booking.id, v_payment.id, v_payment.provider_id, v_payment.student_id,
    v_payment.amount_in_cents, v_payment.platform_fee_in_cents, v_payment.provider_amount_in_cents
  );

  INSERT INTO financial_events (
    event_type, booking_id, payment_id, provider_id,
    amount_in_cents, platform_fee_in_cents, provider_amount_in_cents
  ) VALUES (
    'PLATFORM_FEE_RECORDED', v_booking.id, v_payment.id, v_payment.provider_id,
    v_payment.platform_fee_in_cents, v_payment.platform_fee_in_cents, 0
  );

  INSERT INTO financial_events (
    event_type, booking_id, payment_id, provider_id,
    amount_in_cents, platform_fee_in_cents, provider_amount_in_cents
  ) VALUES (
    'PAYOUT_AVAILABLE', v_booking.id, v_payment.id, v_payment.provider_id,
    v_payment.provider_amount_in_cents, 0, v_payment.provider_amount_in_cents
  );

  -- Secure Audit Log for Successful Payment Confirmation
  INSERT INTO public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    new_value,
    ip_address,
    user_agent,
    severity,
    created_at
  ) VALUES (
    v_booking.student_id,
    'BOOKING_PAYMENT_CONFIRM',
    'BOOKINGS',
    v_booking.id,
    jsonb_build_object('booking_id', v_booking.id, 'payment_id', v_payment.id, 'booking_status', 'CONFIRMED'),
    '127.0.0.1',
    'PostgreSQL Trigger (SECURITY DEFINER)',
    'INFO',
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_paid', false,
    'is_late_payment', false,
    'refund_pending', false,
    'booking_id', v_booking.id,
    'payment_id', v_payment.id,
    'status', 'CONFIRMED'
  );
END;
$$;

-- Grant execution to authenticated users
REVOKE ALL ON FUNCTION public.confirm_booking_payment(UUID, VARCHAR, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_booking_payment(UUID, VARCHAR, TIMESTAMPTZ) FROM anon;
GRANT EXECUTE ON FUNCTION public.confirm_booking_payment(UUID, VARCHAR, TIMESTAMPTZ) TO authenticated, service_role;

-- ============================================================================
-- 7. SEQUENCE PRIVILEGES
-- ============================================================================
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
