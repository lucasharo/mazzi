-- ============================================================================
-- MAZZI PLATFORM — SPRINT 09 DATABASE MIGRATION (Supabase / PostgreSQL 16+)
-- File: 20260815000010_payments_commission_payout.sql
-- ============================================================================

-- 0. EVOLVE PAYMENT STATUS ENUM
DO $$
BEGIN
  ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'PARTIALLY_REFUNDED';
  ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'CANCELLED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 1. ENHANCE PAYMENTS TABLE
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES providers(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS platform_fee_in_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_amount_in_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gateway_fee_in_cents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pix_qr_code TEXT,
  ADD COLUMN IF NOT EXISTS pix_qr_code_base64 TEXT,
  ADD COLUMN IF NOT EXISTS pix_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS card_last4 VARCHAR(4),
  ADD COLUMN IF NOT EXISTS card_brand VARCHAR(50),
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- Ensure constraint: amount_in_cents must be strictly positive
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_amount_check'
  ) THEN
    ALTER TABLE payments ADD CONSTRAINT payments_amount_check CHECK (amount_in_cents > 0);
  END IF;
END $$;

-- 2. CREATE PROVIDER PAYMENT ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS provider_payment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
  gateway VARCHAR(50) NOT NULL, -- 'MERCADOPAGO', 'STRIPE', 'DEVELOPMENT_MOCK'
  external_account_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- 'NOT_STARTED', 'PENDING', 'REQUIRES_ACTION', 'ACTIVE', 'RESTRICTED', 'DISABLED'
  charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider_id, gateway)
);

-- 3. CREATE PAYMENT WEBHOOK EVENTS TABLE (IDEMPOTENCY & REPLAY PROTECTION)
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway VARCHAR(50) NOT NULL,
  external_event_id VARCHAR(255) NOT NULL,
  external_payment_id VARCHAR(255),
  event_type VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'RECEIVED', -- 'RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED'
  payload_hash VARCHAR(64),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  UNIQUE(gateway, external_event_id)
);

-- 4. CREATE FINANCIAL EVENTS TABLE (IMMUTABLE ACCOUNTING LEDGER)
CREATE TABLE IF NOT EXISTS financial_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL, -- 'PAYMENT_CREATED', 'PAYMENT_PAID', 'PAYMENT_FAILED', 'PAYMENT_CANCELLED', 'REFUND_REQUESTED', 'REFUND_COMPLETED', 'PLATFORM_FEE_RECORDED', 'PAYOUT_AVAILABLE', 'PAYOUT_PAID', 'CHARGEBACK_RECEIVED'
  booking_id UUID REFERENCES bookings(id) ON DELETE RESTRICT,
  payment_id UUID REFERENCES payments(id) ON DELETE RESTRICT,
  provider_id UUID REFERENCES providers(id) ON DELETE RESTRICT,
  student_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  amount_in_cents INTEGER NOT NULL,
  platform_fee_in_cents INTEGER NOT NULL DEFAULT 0,
  provider_amount_in_cents INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. ATOMIC FUNCTION: confirm_booking_payment
-- Handles row locking, late-payment defense on expired bookings, idempotency, and state transition.
CREATE OR REPLACE FUNCTION confirm_booking_payment(
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

-- 6. ATOMIC FUNCTION: process_booking_refund
CREATE OR REPLACE FUNCTION process_booking_refund(
  p_payment_id UUID,
  p_amount_in_cents INT,
  p_reason VARCHAR,
  p_idempotency_key VARCHAR,
  p_external_refund_id VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment RECORD;
  v_booking RECORD;
  v_prior_refunded INT;
  v_new_refund_id UUID;
  v_is_full_refund BOOLEAN;
  v_existing_refund RECORD;
BEGIN
  -- 1. Check idempotency
  SELECT * INTO v_existing_refund
  FROM refunds
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_existing', true,
      'refund_id', v_existing_refund.id,
      'amount_in_cents', v_existing_refund.amount_in_cents,
      'status', v_existing_refund.status
    );
  END IF;

  -- 2. Lock payment
  SELECT * INTO v_payment
  FROM payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento % não encontrado.', p_payment_id;
  END IF;

  IF v_payment.status NOT IN ('PAID', 'PARTIALLY_REFUNDED') THEN
    RAISE EXCEPTION 'Não é possível reembolsar um pagamento com status %.', v_payment.status;
  END IF;

  -- 3. Lock booking
  SELECT * INTO v_booking
  FROM bookings
  WHERE id = v_payment.booking_id
  FOR UPDATE;

  -- 4. Calculate total prior refunds
  SELECT COALESCE(SUM(amount_in_cents), 0) INTO v_prior_refunded
  FROM refunds
  WHERE payment_id = p_payment_id AND status = 'PROCESSED';

  IF (v_prior_refunded + p_amount_in_cents) > v_payment.amount_in_cents THEN
    RAISE EXCEPTION 'Valor do reembolso (%) excede o saldo reembolsável restante (%).',
      p_amount_in_cents, (v_payment.amount_in_cents - v_prior_refunded);
  END IF;

  -- 5. Insert refund
  INSERT INTO refunds (
    payment_id, booking_id, amount_in_cents, reason,
    external_refund_id, idempotency_key, status, created_at
  ) VALUES (
    v_payment.id, v_booking.id, p_amount_in_cents, p_reason,
    p_external_refund_id, p_idempotency_key, 'PROCESSED', NOW()
  )
  RETURNING id INTO v_new_refund_id;

  v_is_full_refund := (v_prior_refunded + p_amount_in_cents) >= v_payment.amount_in_cents;

  -- 6. Update payment
  UPDATE payments
  SET status = CASE WHEN v_is_full_refund THEN 'REFUNDED'::payment_status ELSE 'PAID'::payment_status END,
      refunded_at = NOW(),
      updated_at = NOW()
  WHERE id = v_payment.id;

  -- 7. Update booking
  UPDATE bookings
  SET status = CASE WHEN v_is_full_refund THEN 'REFUNDED'::booking_status ELSE 'PARTIALLY_REFUNDED'::booking_status END,
      updated_at = NOW()
  WHERE id = v_booking.id;

  -- 8. Record in Financial Ledger
  INSERT INTO financial_events (
    event_type, booking_id, payment_id, provider_id, student_id,
    amount_in_cents, platform_fee_in_cents, provider_amount_in_cents, metadata
  ) VALUES (
    'REFUND_COMPLETED', v_booking.id, v_payment.id, v_payment.provider_id, v_payment.student_id,
    p_amount_in_cents, 0, 0,
    jsonb_build_object('is_full_refund', v_is_full_refund, 'reason', p_reason)
  );

  RETURN jsonb_build_object(
    'success', true,
    'is_existing', false,
    'refund_id', v_new_refund_id,
    'amount_in_cents', p_amount_in_cents,
    'is_full_refund', v_is_full_refund,
    'status', 'PROCESSED'
  );
END;
$$;

-- 7. ROW LEVEL SECURITY POLICIES
ALTER TABLE provider_payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_events ENABLE ROW LEVEL SECURITY;

-- provider_payment_accounts: Provider can view their own, admins can view all
CREATE POLICY "provider_payment_accounts_provider_select"
  ON provider_payment_accounts
  FOR SELECT
  USING (
    provider_id IN (
      SELECT id FROM providers WHERE user_id = auth.uid()
    )
    OR auth.jwt() ->> 'role' IN ('PLATFORM_ADMIN', 'SUPPORT')
  );

-- financial_events: Provider can view events for their provider, student for their bookings
CREATE POLICY "financial_events_select"
  ON financial_events
  FOR SELECT
  USING (
    student_id = auth.uid()
    OR provider_id IN (
      SELECT id FROM providers WHERE user_id = auth.uid()
    )
    OR auth.jwt() ->> 'role' IN ('PLATFORM_ADMIN', 'SUPPORT')
  );

-- payment_webhook_events: Strictly restricted to service_role / internal backend
CREATE POLICY "payment_webhook_events_admin_only"
  ON payment_webhook_events
  FOR ALL
  USING (
    auth.jwt() ->> 'role' IN ('PLATFORM_ADMIN', 'service_role')
  );

-- 8. GRANTS
REVOKE EXECUTE ON FUNCTION confirm_booking_payment FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirm_booking_payment TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION process_booking_refund FROM PUBLIC;
GRANT EXECUTE ON FUNCTION process_booking_refund TO authenticated, service_role;
