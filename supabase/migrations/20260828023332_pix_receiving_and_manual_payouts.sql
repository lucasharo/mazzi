-- TASK-080: Mercado Pago Pix (DEV) + manual provider payouts.
-- Money is always persisted as integer cents. The browser never confirms a
-- real payment and never writes financial tables directly.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS pix_qr_code TEXT,
  ADD COLUMN IF NOT EXISTS pix_qr_code_base64 TEXT,
  ADD COLUMN IF NOT EXISTS pix_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gateway_fee_in_cents INTEGER CHECK (gateway_fee_in_cents IS NULL OR gateway_fee_in_cents >= 0);

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS gross_amount_in_cents INTEGER,
  ADD COLUMN IF NOT EXISTS platform_fee_in_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gateway_fee_in_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gateway_fee_source VARCHAR(40) NOT NULL DEFAULT 'CONFIGURED_ESTIMATE',
  ADD COLUMN IF NOT EXISTS transfer_method VARCHAR(20) NOT NULL DEFAULT 'MANUAL_PIX',
  ADD COLUMN IF NOT EXISTS destination_key_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS destination_key TEXT,
  ADD COLUMN IF NOT EXISTS destination_key_masked VARCHAR(120),
  ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(160),
  ADD COLUMN IF NOT EXISTS recipient_document VARCHAR(30),
  ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS transfer_reference VARCHAR(120),
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS payouts_booking_id_unique ON public.payouts (booking_id);

CREATE TABLE IF NOT EXISTS public.provider_pix_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL UNIQUE REFERENCES public.providers(id) ON DELETE CASCADE,
  key_type VARCHAR(20) NOT NULL CHECK (key_type IN ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM')),
  pix_key TEXT NOT NULL CHECK (length(btrim(pix_key)) BETWEEN 1 AND 120),
  holder_name VARCHAR(160) NOT NULL CHECK (length(btrim(holder_name)) >= 3),
  holder_document VARCHAR(30),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway VARCHAR(40) NOT NULL,
  external_event_id VARCHAR(160) NOT NULL UNIQUE,
  external_payment_id VARCHAR(160),
  event_type VARCHAR(80) NOT NULL,
  payload_hash VARCHAR(128),
  status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED')),
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE public.provider_pix_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS provider_pix_destinations_no_direct_client_select ON public.provider_pix_destinations;
CREATE POLICY provider_pix_destinations_no_direct_client_select
  ON public.provider_pix_destinations FOR SELECT TO authenticated USING (FALSE);
DROP POLICY IF EXISTS provider_pix_destinations_no_direct_client_insert ON public.provider_pix_destinations;
CREATE POLICY provider_pix_destinations_no_direct_client_insert
  ON public.provider_pix_destinations FOR INSERT TO authenticated WITH CHECK (FALSE);
DROP POLICY IF EXISTS provider_pix_destinations_no_direct_client_update ON public.provider_pix_destinations;
CREATE POLICY provider_pix_destinations_no_direct_client_update
  ON public.provider_pix_destinations FOR UPDATE TO authenticated USING (FALSE) WITH CHECK (FALSE);
DROP POLICY IF EXISTS provider_pix_destinations_no_direct_client_delete ON public.provider_pix_destinations;
CREATE POLICY provider_pix_destinations_no_direct_client_delete
  ON public.provider_pix_destinations FOR DELETE TO authenticated USING (FALSE);

DROP POLICY IF EXISTS payment_webhook_events_no_direct_client_select ON public.payment_webhook_events;
CREATE POLICY payment_webhook_events_no_direct_client_select
  ON public.payment_webhook_events FOR SELECT TO authenticated USING (FALSE);
DROP POLICY IF EXISTS payouts_no_direct_client_select ON public.payouts;
CREATE POLICY payouts_no_direct_client_select ON public.payouts FOR SELECT TO authenticated USING (FALSE);

CREATE OR REPLACE FUNCTION public.pix_key_mask(p_key_type VARCHAR, p_pix_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE
SET search_path TO public, pg_temp
AS $$
DECLARE v_key TEXT := btrim(COALESCE(p_pix_key, ''));
BEGIN
  IF v_key = '' THEN RETURN ''; END IF;
  IF p_key_type = 'CPF' THEN RETURN '***.***.***-' || right(regexp_replace(v_key, '\D', '', 'g'), 2); END IF;
  IF p_key_type = 'CNPJ' THEN RETURN '**.***.***/****-' || right(regexp_replace(v_key, '\D', '', 'g'), 2); END IF;
  IF p_key_type = 'PHONE' THEN RETURN '(**) *****-' || right(regexp_replace(v_key, '\D', '', 'g'), 4); END IF;
  IF p_key_type = 'EMAIL' AND position('@' IN v_key) > 2 THEN RETURN left(v_key, 2) || '***' || substring(v_key FROM position('@' IN v_key)); END IF;
  IF length(v_key) > 8 THEN RETURN left(v_key, 4) || '…' || right(v_key, 4); END IF;
  RETURN '••••••••';
END;
$$;

REVOKE ALL ON FUNCTION public.pix_key_mask(VARCHAR, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_my_pix_destination(
  p_key_type VARCHAR,
  p_pix_key TEXT,
  p_holder_name VARCHAR,
  p_holder_document VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_provider_id UUID;
  v_key_type VARCHAR := upper(btrim(COALESCE(p_key_type, '')));
  v_key TEXT := btrim(COALESCE(p_pix_key, ''));
  v_holder VARCHAR := btrim(COALESCE(p_holder_name, ''));
  v_document TEXT := NULLIF(btrim(COALESCE(p_holder_document, '')), '');
  v_before JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  SELECT p.id INTO v_provider_id FROM public.providers p
   WHERE p.user_id = v_uid AND p.status NOT IN ('BLOCKED', 'SUSPENDED')
   ORDER BY p.created_at LIMIT 1;
  IF v_provider_id IS NULL THEN RAISE EXCEPTION 'PROVIDER_NOT_FOUND' USING ERRCODE = '42501'; END IF;
  IF v_key_type NOT IN ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM') THEN RAISE EXCEPTION 'PIX_KEY_TYPE_INVALID' USING ERRCODE = '22023'; END IF;
  IF v_key_type IN ('CPF', 'CNPJ', 'PHONE') THEN v_key := regexp_replace(v_key, '\D', '', 'g'); END IF;
  IF v_key_type = 'EMAIL' THEN v_key := lower(v_key); END IF;
  IF v_key_type = 'CPF' AND v_key !~ '^\d{11}$' THEN RAISE EXCEPTION 'PIX_CPF_INVALID' USING ERRCODE = '22023'; END IF;
  IF v_key_type = 'CNPJ' AND v_key !~ '^\d{14}$' THEN RAISE EXCEPTION 'PIX_CNPJ_INVALID' USING ERRCODE = '22023'; END IF;
  IF v_key_type = 'PHONE' AND v_key !~ '^\d{10,11}$' THEN RAISE EXCEPTION 'PIX_PHONE_INVALID' USING ERRCODE = '22023'; END IF;
  IF v_key_type = 'EMAIL' AND v_key !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'PIX_EMAIL_INVALID' USING ERRCODE = '22023'; END IF;
  IF v_key_type = 'RANDOM' AND length(v_key) < 8 THEN RAISE EXCEPTION 'PIX_RANDOM_KEY_INVALID' USING ERRCODE = '22023'; END IF;
  IF length(v_holder) < 3 THEN RAISE EXCEPTION 'PIX_HOLDER_NAME_REQUIRED' USING ERRCODE = '22023'; END IF;

  SELECT jsonb_build_object('key_type', d.key_type, 'key_masked', public.pix_key_mask(d.key_type, d.pix_key), 'holder_name', d.holder_name)
    INTO v_before FROM public.provider_pix_destinations d WHERE d.provider_id = v_provider_id;
  INSERT INTO public.provider_pix_destinations (provider_id, key_type, pix_key, holder_name, holder_document, is_active, updated_at)
  VALUES (v_provider_id, v_key_type, v_key, v_holder, v_document, TRUE, NOW())
  ON CONFLICT (provider_id) DO UPDATE SET key_type = EXCLUDED.key_type, pix_key = EXCLUDED.pix_key,
    holder_name = EXCLUDED.holder_name, holder_document = EXCLUDED.holder_document, is_active = TRUE, updated_at = NOW();
  INSERT INTO public.audit_logs (id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at)
  VALUES (gen_random_uuid(), v_uid, 'PIX_DESTINATION_UPDATED', 'ProviderPixDestination', v_provider_id,
    COALESCE(v_before, '{}'::jsonb), jsonb_build_object('key_type', v_key_type, 'key_masked', public.pix_key_mask(v_key_type, v_key), 'holder_name', v_holder), NOW());
  RETURN jsonb_build_object('success', TRUE, 'provider_id', v_provider_id, 'key_type', v_key_type,
    'pix_key', v_key, 'pix_key_masked', public.pix_key_mask(v_key_type, v_key), 'holder_name', v_holder, 'holder_document', v_document);
END;
$$;

REVOKE ALL ON FUNCTION public.save_my_pix_destination(VARCHAR, TEXT, VARCHAR, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_my_pix_destination(VARCHAR, TEXT, VARCHAR, VARCHAR) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_pix_destination()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE v_uid UUID := auth.uid(); v_row RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  SELECT d.* INTO v_row FROM public.provider_pix_destinations d JOIN public.providers p ON p.id = d.provider_id
   WHERE p.user_id = v_uid AND d.is_active IS TRUE ORDER BY d.updated_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;
  RETURN jsonb_build_object('id', v_row.id, 'provider_id', v_row.provider_id, 'key_type', v_row.key_type,
    'pix_key', v_row.pix_key, 'pix_key_masked', public.pix_key_mask(v_row.key_type, v_row.pix_key),
    'holder_name', v_row.holder_name, 'holder_document', v_row.holder_document,
    'is_active', v_row.is_active, 'updated_at', v_row.updated_at);
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_pix_destination() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_pix_destination() TO authenticated;

CREATE OR REPLACE FUNCTION public.create_booking_payment(
  p_booking_id UUID,
  p_method public.payment_method,
  p_idempotency_key VARCHAR DEFAULT NULL,
  p_gateway_provider VARCHAR DEFAULT 'fake_payment_gateway'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE v_uid UUID := auth.uid(); v_booking RECORD; v_payment RECORD; v_now TIMESTAMPTZ := NOW(); v_payment_id UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '28000'; END IF;
  PERFORM public.lock_student_profile(v_uid); PERFORM public.assert_current_user_student();
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_booking.student_id <> v_uid THEN RAISE EXCEPTION 'CROSS_STUDENT_BOOKING_ACCESS_DENIED' USING ERRCODE = '42501'; END IF;
  IF v_booking.status <> 'PENDING_PAYMENT' THEN
    IF v_booking.status = 'CONFIRMED' THEN RAISE EXCEPTION 'BOOKING_ALREADY_PAID' USING ERRCODE = '22000';
    ELSE RAISE EXCEPTION 'BOOKING_NOT_PENDING_PAYMENT' USING ERRCODE = '22000'; END IF;
  END IF;
  IF v_booking.hold_expires_at IS NOT NULL AND v_booking.hold_expires_at <= v_now THEN
    UPDATE public.bookings SET status = 'EXPIRED', expired_at = v_now, updated_at = v_now WHERE id = p_booking_id;
    RAISE EXCEPTION 'BOOKING_HOLD_EXPIRED' USING ERRCODE = '22000';
  END IF;
  IF p_gateway_provider NOT IN ('fake_payment_gateway', 'mercadopago_test') THEN RAISE EXCEPTION 'REAL_PAYMENT_GATEWAY_NOT_ENABLED' USING ERRCODE = '22000'; END IF;
  SELECT * INTO v_payment FROM public.payments WHERE booking_id = p_booking_id ORDER BY created_at DESC LIMIT 1;
  IF FOUND AND v_payment.status IN ('PENDING', 'AUTHORIZED') THEN
    UPDATE public.payments SET method = p_method, gateway_provider = p_gateway_provider, updated_at = v_now WHERE id = v_payment.id;
    RETURN jsonb_build_object('success', TRUE, 'is_idempotent', TRUE, 'payment_id', v_payment.id, 'booking_id', v_payment.booking_id,
      'status', v_payment.status, 'amount_in_cents', v_payment.amount_in_cents, 'gateway_provider', p_gateway_provider);
  END IF;
  v_payment_id := gen_random_uuid();
  INSERT INTO public.payments (id, booking_id, method, status, amount_in_cents, idempotency_key, gateway_provider, created_at, updated_at)
  VALUES (v_payment_id, p_booking_id, p_method, 'PENDING', v_booking.total_in_cents,
    COALESCE(NULLIF(BTRIM(p_idempotency_key), ''), 'idem_pay_' || p_booking_id || '_' || v_payment_id), p_gateway_provider, v_now, v_now);
  RETURN jsonb_build_object('success', TRUE, 'is_idempotent', FALSE, 'payment_id', v_payment_id, 'booking_id', p_booking_id,
    'status', 'PENDING', 'amount_in_cents', v_booking.total_in_cents, 'gateway_provider', p_gateway_provider);
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking_payment(UUID, public.payment_method, VARCHAR, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_booking_payment(UUID, public.payment_method, VARCHAR, VARCHAR) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_my_payment_status(p_payment_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE v_uid UUID := auth.uid(); v_row RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  SELECT p.*, b.student_id, b.status AS booking_status, b.hold_expires_at INTO v_row
    FROM public.payments p JOIN public.bookings b ON b.id = p.booking_id
   WHERE p.id = p_payment_id AND b.student_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object('payment_id', v_row.id, 'booking_id', v_row.booking_id, 'status', v_row.status,
    'booking_status', v_row.booking_status, 'external_payment_id', v_row.external_transaction_id,
    'amount_in_cents', v_row.amount_in_cents, 'pix_qr_code', v_row.pix_qr_code,
    'pix_qr_code_base64', v_row.pix_qr_code_base64, 'pix_expires_at', v_row.pix_expires_at,
    'paid_at', v_row.paid_at, 'hold_expires_at', v_row.hold_expires_at);
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_payment_status(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_payment_status(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.finalize_mercadopago_pix_payment(
  p_external_payment_id VARCHAR,
  p_amount_in_cents INTEGER,
  p_paid_at TIMESTAMPTZ DEFAULT NULL,
  p_gateway_fee_in_cents INTEGER DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE v_payment RECORD; v_booking RECORD; v_now TIMESTAMPTZ := NOW(); v_paid_at TIMESTAMPTZ := COALESCE(p_paid_at, NOW());
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN RAISE EXCEPTION 'PAYMENT_FINALIZATION_FORBIDDEN' USING ERRCODE = '42501'; END IF;
  IF NULLIF(BTRIM(p_external_payment_id), '') IS NULL THEN RAISE EXCEPTION 'EXTERNAL_PAYMENT_ID_REQUIRED' USING ERRCODE = '22023'; END IF;
  IF p_amount_in_cents IS NULL OR p_amount_in_cents <= 0 THEN RAISE EXCEPTION 'PAYMENT_AMOUNT_INVALID' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_payment FROM public.payments WHERE external_transaction_id = p_external_payment_id OR metadata->>'mercado_pago_payment_id' = p_external_payment_id ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = v_payment.booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_payment.amount_in_cents <> p_amount_in_cents OR v_payment.amount_in_cents <> v_booking.total_in_cents THEN RAISE EXCEPTION 'PAYMENT_AMOUNT_MISMATCH' USING ERRCODE = '22000'; END IF;
  IF v_payment.status = 'PAID' THEN RETURN jsonb_build_object('success', TRUE, 'is_idempotent', TRUE, 'payment_id', v_payment.id, 'booking_id', v_booking.id, 'payment_status', 'PAID', 'booking_status', v_booking.status); END IF;
  IF v_payment.status NOT IN ('PENDING', 'AUTHORIZED') THEN RAISE EXCEPTION 'PAYMENT_NOT_CONFIRMABLE' USING ERRCODE = '22000'; END IF;
  UPDATE public.payments SET status = 'PAID', gateway_provider = 'mercadopago_test', external_transaction_id = p_external_payment_id,
    gateway_fee_in_cents = COALESCE(p_gateway_fee_in_cents, gateway_fee_in_cents), paid_at = v_paid_at,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('mercado_pago_payment_id', p_external_payment_id, 'gateway_fee_in_cents', p_gateway_fee_in_cents), updated_at = v_now
   WHERE id = v_payment.id;
  IF v_booking.status = 'PENDING_PAYMENT'
     AND (v_booking.hold_expires_at IS NULL OR v_booking.hold_expires_at > v_now)
     AND (v_payment.pix_expires_at IS NULL OR v_paid_at <= v_payment.pix_expires_at) THEN
    UPDATE public.bookings SET status = 'CONFIRMED', confirmed_at = COALESCE(confirmed_at, v_paid_at), updated_at = v_now WHERE id = v_booking.id;
    RETURN jsonb_build_object('success', TRUE, 'is_idempotent', FALSE, 'payment_id', v_payment.id, 'booking_id', v_booking.id, 'payment_status', 'PAID', 'booking_status', 'CONFIRMED', 'paid_at', v_paid_at);
  END IF;
  UPDATE public.bookings SET status = 'EXPIRED', expired_at = COALESCE(expired_at, v_now), updated_at = v_now WHERE id = v_booking.id AND status = 'PENDING_PAYMENT';
  RETURN jsonb_build_object('success', TRUE, 'late_payment', TRUE, 'payment_id', v_payment.id, 'booking_id', v_booking.id, 'payment_status', 'PAID', 'booking_status', 'EXPIRED', 'paid_at', v_paid_at);
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_mercadopago_pix_payment(VARCHAR, INTEGER, TIMESTAMPTZ, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_mercadopago_pix_payment(VARCHAR, INTEGER, TIMESTAMPTZ, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.get_admin_payouts()
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE v_uid UUID := auth.uid(); v_safety NUMERIC := 24; v_gateway_pct NUMERIC := 5; v_cap_pct NUMERIC := 10; v_result JSONB;
BEGIN
  IF v_uid IS NULL OR NOT public.current_user_has_permission('admin.finance.read_all'::public.app_permission) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  SELECT COALESCE((value->>'payout_safety_period_hours')::NUMERIC, 24) INTO v_safety FROM public.platform_configurations WHERE key = 'platform_operations';
  SELECT COALESCE((value->>'mercadopago_fee_percentage')::NUMERIC, 5), COALESCE((value->>'max_total_fee_percentage')::NUMERIC, 10)
    INTO v_gateway_pct, v_cap_pct FROM public.platform_configurations WHERE key = 'platform_fees';
  WITH eligible AS (
    SELECT b.*, p.id AS payment_id, p.metadata AS payment_metadata, p.gateway_fee_in_cents AS payment_gateway_fee,
      d.key_type, d.pix_key, d.holder_name, d.holder_document
      FROM public.bookings b
      JOIN LATERAL (SELECT p.* FROM public.payments p WHERE p.booking_id = b.id AND p.status = 'PAID' ORDER BY p.created_at DESC LIMIT 1) p ON TRUE
      LEFT JOIN public.provider_pix_destinations d ON d.provider_id = b.provider_id AND d.is_active IS TRUE
     WHERE b.status = 'COMPLETED'
  ), gateway_calculated AS (
    SELECT e.*, COALESCE(e.completed_at, e.lesson_finished_at, e.updated_at) + make_interval(hours => v_safety::INTEGER) AS scheduled_at,
      e.total_in_cents AS gross_cents,
      LEAST(e.total_in_cents, GREATEST(0, COALESCE(e.payment_gateway_fee,
        CASE WHEN e.payment_metadata->>'gateway_fee_in_cents' ~ '^\d+$' THEN (e.payment_metadata->>'gateway_fee_in_cents')::INTEGER ELSE FLOOR(e.total_in_cents * v_gateway_pct / 100)::INTEGER END,
        FLOOR(e.total_in_cents * v_gateway_pct / 100)::INTEGER))) AS gateway_cents
      FROM eligible e
  ), calculated AS (
    SELECT g.*, LEAST(g.platform_fee_in_cents, GREATEST(0, FLOOR(g.total_in_cents * v_cap_pct / 100)::INTEGER - g.gateway_cents)) AS platform_cents
      FROM gateway_calculated g
  ), inserted AS (
    INSERT INTO public.payouts (provider_id, booking_id, amount_in_cents, status, scheduled_release_at, idempotency_key,
      gross_amount_in_cents, platform_fee_in_cents, gateway_fee_in_cents, gateway_fee_source, transfer_method,
      destination_key_type, destination_key, destination_key_masked, recipient_name, recipient_document, updated_at)
    SELECT provider_id, id, GREATEST(0, gross_cents - gateway_cents - platform_cents),
      CASE WHEN scheduled_at > NOW() THEN 'PENDING'::public.payout_status
           WHEN key_type IS NULL THEN 'BLOCKED'::public.payout_status
           ELSE 'AVAILABLE'::public.payout_status END,
      scheduled_at, 'payout_' || id, gross_cents, platform_cents, gateway_cents,
      CASE WHEN payment_gateway_fee IS NOT NULL OR payment_metadata->>'gateway_fee_in_cents' IS NOT NULL THEN 'GATEWAY_RESPONSE' ELSE 'CONFIGURED_ESTIMATE' END,
      'MANUAL_PIX', key_type, pix_key, public.pix_key_mask(key_type, pix_key), holder_name, holder_document, NOW()
      FROM calculated
    ON CONFLICT (booking_id) DO UPDATE SET amount_in_cents = EXCLUDED.amount_in_cents, status = CASE WHEN public.payouts.status = 'PAID' THEN public.payouts.status ELSE EXCLUDED.status END,
      scheduled_release_at = EXCLUDED.scheduled_release_at, gross_amount_in_cents = EXCLUDED.gross_amount_in_cents,
      platform_fee_in_cents = EXCLUDED.platform_fee_in_cents, gateway_fee_in_cents = EXCLUDED.gateway_fee_in_cents,
      gateway_fee_source = EXCLUDED.gateway_fee_source, destination_key_type = EXCLUDED.destination_key_type,
      destination_key = EXCLUDED.destination_key, destination_key_masked = EXCLUDED.destination_key_masked,
      recipient_name = EXCLUDED.recipient_name, recipient_document = EXCLUDED.recipient_document, updated_at = NOW()
    RETURNING id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', po.id, 'provider_id', po.provider_id, 'booking_id', po.booking_id,
    'amount_in_cents', po.amount_in_cents, 'status', po.status, 'scheduled_release_at', po.scheduled_release_at,
    'released_at', po.released_at, 'gross_amount_in_cents', po.gross_amount_in_cents, 'platform_fee_in_cents', po.platform_fee_in_cents,
    'gateway_fee_in_cents', po.gateway_fee_in_cents, 'gateway_fee_source', po.gateway_fee_source, 'transfer_method', po.transfer_method,
    'destination_key_type', po.destination_key_type, 'destination_key', po.destination_key, 'destination_key_masked', po.destination_key_masked,
    'recipient_name', po.recipient_name, 'recipient_document', po.recipient_document, 'transfer_reference', po.transfer_reference,
    'processed_at', po.processed_at, 'provider_name', COALESCE(pr.trade_name, pr.legal_name, 'Prestador')) ORDER BY po.scheduled_release_at), '[]'::jsonb)
    INTO v_result FROM public.payouts po JOIN public.providers pr ON pr.id = po.provider_id
    WHERE po.booking_id IN (SELECT b.id FROM public.bookings b WHERE b.status = 'COMPLETED');
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_payouts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_payouts() TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_manual_payout(p_payout_id UUID, p_transfer_reference VARCHAR)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE v_uid UUID := auth.uid(); v_payout RECORD; v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_uid IS NULL OR NOT public.current_user_has_permission('admin.finance.read_all'::public.app_permission) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  IF length(btrim(COALESCE(p_transfer_reference, ''))) < 3 THEN RAISE EXCEPTION 'TRANSFER_REFERENCE_REQUIRED' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_payout FROM public.payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYOUT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_payout.status = 'PAID' THEN RETURN jsonb_build_object('success', TRUE, 'is_idempotent', TRUE, 'payout_id', p_payout_id, 'status', 'PAID', 'transfer_reference', v_payout.transfer_reference); END IF;
  IF v_payout.status <> 'AVAILABLE' OR v_payout.scheduled_release_at > v_now THEN RAISE EXCEPTION 'PAYOUT_NOT_AVAILABLE' USING ERRCODE = '22000'; END IF;
  IF NULLIF(btrim(v_payout.destination_key), '') IS NULL THEN RAISE EXCEPTION 'PIX_DESTINATION_REQUIRED' USING ERRCODE = '22000'; END IF;
  UPDATE public.payouts SET status = 'PAID', released_at = v_now, processed_at = v_now, processed_by = v_uid,
    transfer_reference = btrim(p_transfer_reference), updated_at = v_now WHERE id = p_payout_id;
  INSERT INTO public.audit_logs (id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at)
  VALUES (gen_random_uuid(), v_uid, 'MANUAL_PIX_PAYOUT_COMPLETED', 'Payout', p_payout_id,
    jsonb_build_object('status', v_payout.status), jsonb_build_object('status', 'PAID', 'amount_in_cents', v_payout.amount_in_cents, 'transfer_reference', btrim(p_transfer_reference)), v_now);
  RETURN jsonb_build_object('success', TRUE, 'is_idempotent', FALSE, 'payout_id', p_payout_id, 'status', 'PAID', 'released_at', v_now, 'transfer_reference', btrim(p_transfer_reference));
END;
$$;

REVOKE ALL ON FUNCTION public.mark_manual_payout(UUID, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_manual_payout(UUID, VARCHAR) TO authenticated;

-- Financial settings are Admin-only. The combined cap is enforced when the
-- payout snapshot is prepared; the current configured MAZZI fee is never
-- allowed to consume more than the remaining cap after gateway fees.
CREATE OR REPLACE FUNCTION public.update_admin_platform_configurations(p_updates JSONB)
RETURNS TABLE (key VARCHAR(100), value JSONB)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE v_uid UUID := auth.uid(); v_item RECORD; v_before JSONB; v_after JSONB; v_fee_updates JSONB := '{}'::JSONB;
  v_allowed CONSTANT TEXT[] := ARRAY['platformFeeDefaultPercentage','mercadoPagoFeePercentage','maxTotalFeePercentage','availabilityHorizonDays','quoteExpirationMinutes','minimumBookingNoticeHours','payoutSafetyPeriodHours','searchRadiusDefaultsKm'];
BEGIN
  IF v_uid IS NULL OR NOT public.current_user_has_permission('admin.platform.manage_settings'::public.app_permission) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'object' OR p_updates = '{}'::jsonb THEN RAISE EXCEPTION 'INVALID_PLATFORM_CONFIG_UPDATES' USING ERRCODE = '22023'; END IF;
  FOR v_item IN SELECT item.json_key FROM jsonb_object_keys(p_updates) AS item(json_key) LOOP
    IF NOT (v_item.json_key = ANY(v_allowed)) OR jsonb_typeof(p_updates -> v_item.json_key) <> 'number' THEN RAISE EXCEPTION 'UNSUPPORTED_PLATFORM_CONFIG_KEY: %', v_item.json_key USING ERRCODE = '22023'; END IF;
  END LOOP;
  IF p_updates ? 'platformFeeDefaultPercentage' AND ((p_updates->>'platformFeeDefaultPercentage')::NUMERIC < 0 OR (p_updates->>'platformFeeDefaultPercentage')::NUMERIC > 100) THEN RAISE EXCEPTION 'INVALID_FEE_PERCENTAGE' USING ERRCODE = '22023'; END IF;
  IF p_updates ? 'mercadoPagoFeePercentage' AND ((p_updates->>'mercadoPagoFeePercentage')::NUMERIC < 0 OR (p_updates->>'mercadoPagoFeePercentage')::NUMERIC > 100) THEN RAISE EXCEPTION 'INVALID_GATEWAY_FEE_PERCENTAGE' USING ERRCODE = '22023'; END IF;
  IF p_updates ? 'maxTotalFeePercentage' AND ((p_updates->>'maxTotalFeePercentage')::NUMERIC < 0 OR (p_updates->>'maxTotalFeePercentage')::NUMERIC > 100) THEN RAISE EXCEPTION 'INVALID_TOTAL_FEE_PERCENTAGE' USING ERRCODE = '22023'; END IF;
  IF (p_updates ? 'mercadoPagoFeePercentage') AND (p_updates ? 'maxTotalFeePercentage') AND (p_updates->>'mercadoPagoFeePercentage')::NUMERIC > (p_updates->>'maxTotalFeePercentage')::NUMERIC THEN RAISE EXCEPTION 'GATEWAY_FEE_EXCEEDS_TOTAL_FEE_CAP' USING ERRCODE = '22023'; END IF;
  SELECT COALESCE(jsonb_object_agg(pc.key, pc.value), '{}'::jsonb) INTO v_before FROM public.platform_configurations pc WHERE pc.key IN ('platform_fees','platform_operations','quote_settings','scheduling_settings');
  IF p_updates ? 'platformFeeDefaultPercentage' THEN v_fee_updates := v_fee_updates || jsonb_build_object('default_percentage', p_updates->'platformFeeDefaultPercentage'); END IF;
  IF p_updates ? 'mercadoPagoFeePercentage' THEN v_fee_updates := v_fee_updates || jsonb_build_object('mercadopago_fee_percentage', p_updates->'mercadoPagoFeePercentage'); END IF;
  IF p_updates ? 'maxTotalFeePercentage' THEN v_fee_updates := v_fee_updates || jsonb_build_object('max_total_fee_percentage', p_updates->'maxTotalFeePercentage'); END IF;
  IF v_fee_updates <> '{}'::JSONB THEN
    INSERT INTO public.platform_configurations (key, value, updated_by, updated_at) VALUES ('platform_fees', v_fee_updates, v_uid, NOW())
    ON CONFLICT ON CONSTRAINT platform_configurations_key_key DO UPDATE SET value = public.platform_configurations.value || excluded.value, updated_by = v_uid, updated_at = NOW();
  END IF;
  IF p_updates ? 'quoteExpirationMinutes' THEN
    INSERT INTO public.platform_configurations (key, value, updated_by, updated_at) VALUES ('quote_settings', jsonb_build_object('expiration_minutes', p_updates->'quoteExpirationMinutes'), v_uid, NOW())
    ON CONFLICT ON CONSTRAINT platform_configurations_key_key DO UPDATE SET value = public.platform_configurations.value || excluded.value, updated_by = v_uid, updated_at = NOW();
  END IF;
  IF p_updates ? 'availabilityHorizonDays' THEN
    INSERT INTO public.platform_configurations (key, value, updated_by, updated_at) VALUES ('scheduling_settings', jsonb_build_object('max_booking_horizon_days', p_updates->'availabilityHorizonDays'), v_uid, NOW())
    ON CONFLICT ON CONSTRAINT platform_configurations_key_key DO UPDATE SET value = public.platform_configurations.value || excluded.value, updated_by = v_uid, updated_at = NOW();
  END IF;
  IF p_updates ? 'minimumBookingNoticeHours' OR p_updates ? 'searchRadiusDefaultsKm' THEN
    INSERT INTO public.platform_configurations (key, value, updated_by, updated_at) VALUES ('platform_operations', jsonb_strip_nulls(jsonb_build_object('minimum_notice_hours', p_updates->'minimumBookingNoticeHours', 'search_radius_km', p_updates->'searchRadiusDefaultsKm')), v_uid, NOW())
    ON CONFLICT ON CONSTRAINT platform_configurations_key_key DO UPDATE SET value = public.platform_configurations.value || excluded.value, updated_by = v_uid, updated_at = NOW();
  END IF;
  IF p_updates ? 'payoutSafetyPeriodHours' THEN
    INSERT INTO public.platform_configurations (key, value, updated_by, updated_at) VALUES ('platform_operations', jsonb_build_object('payout_safety_period_hours', p_updates->'payoutSafetyPeriodHours'), v_uid, NOW())
    ON CONFLICT ON CONSTRAINT platform_configurations_key_key DO UPDATE SET value = public.platform_configurations.value || excluded.value, updated_by = v_uid, updated_at = NOW();
  END IF;
  SELECT COALESCE(jsonb_object_agg(pc.key, pc.value), '{}'::jsonb) INTO v_after FROM public.platform_configurations pc WHERE pc.key IN ('platform_fees','platform_operations','quote_settings','scheduling_settings');
  INSERT INTO public.audit_logs (id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at) VALUES (gen_random_uuid(), v_uid, 'PLATFORM_CONFIG_UPDATED', 'PlatformConfiguration', 'platform_configurations', v_before, v_after, NOW());
  RETURN QUERY SELECT pc.key, pc.value FROM public.platform_configurations pc ORDER BY pc.key;
END;
$$;

REVOKE ALL ON FUNCTION public.update_admin_platform_configurations(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_admin_platform_configurations(JSONB) TO authenticated;
