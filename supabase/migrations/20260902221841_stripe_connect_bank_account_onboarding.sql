-- MAZZI — Vincula a conta bancária cadastrada pelo PRO ao Stripe Connect.
-- A chave secreta da Stripe permanece exclusivamente na Edge Function.

CREATE INDEX IF NOT EXISTS provider_payment_accounts_provider_gateway_idx
  ON public.provider_payment_accounts(provider_id, gateway, updated_at DESC);

CREATE OR REPLACE FUNCTION public.get_my_provider_payment_account()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.provider_payment_accounts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  SELECT a.* INTO v_row
    FROM public.provider_payment_accounts a
    JOIN public.providers p ON p.id = a.provider_id
   WHERE p.user_id = v_uid AND a.gateway = 'STRIPE'
   ORDER BY a.updated_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;
  RETURN jsonb_build_object(
    'id', v_row.id, 'provider_id', v_row.provider_id, 'gateway', v_row.gateway,
    'external_account_id', v_row.external_account_id, 'status', v_row.status,
    'charges_enabled', v_row.charges_enabled, 'payouts_enabled', v_row.payouts_enabled,
    'onboarding_url', v_row.onboarding_url, 'metadata', v_row.metadata,
    'created_at', v_row.created_at, 'updated_at', v_row.updated_at
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_provider_payment_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_provider_payment_account() TO authenticated;

-- Novos repasses só entram no processador automático quando há Connect ativo.
-- Contas bancárias sem onboarding ficam bloqueadas e não são tratadas como repasse manual.
CREATE OR REPLACE FUNCTION public.ensure_booking_payout(p_booking_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_account public.provider_payment_accounts%ROWTYPE;
  v_gateway_fee INTEGER;
  v_amount INTEGER;
  v_release_at TIMESTAMPTZ;
  v_payout_id UUID;
  v_has_dispute BOOLEAN;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR v_booking.status NOT IN ('COMPLETED', 'DISPUTED') THEN RETURN NULL; END IF;
  SELECT * INTO v_payment FROM public.payments WHERE booking_id = p_booking_id AND status = 'PAID'
    ORDER BY paid_at DESC NULLS LAST, created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO v_account FROM public.provider_payment_accounts
   WHERE provider_id = v_booking.provider_id AND gateway = 'STRIPE'
   ORDER BY updated_at DESC LIMIT 1;
  v_gateway_fee := GREATEST(0, COALESCE(v_payment.gateway_fee_in_cents, 0));
  v_amount := GREATEST(0, v_booking.total_in_cents - v_booking.platform_fee_in_cents - v_gateway_fee);
  v_release_at := COALESCE(v_booking.completed_at, v_booking.lesson_finished_at, v_booking.updated_at)
    + make_interval(hours => public.get_payout_safety_period_hours());
  SELECT EXISTS (SELECT 1 FROM public.booking_disputes
    WHERE booking_id = p_booking_id AND status IN ('OPEN','AWAITING_RESPONSE','UNDER_REVIEW')) INTO v_has_dispute;

  INSERT INTO public.payouts (
    provider_id, booking_id, amount_in_cents, status, scheduled_release_at,
    idempotency_key, gross_amount_in_cents, platform_fee_in_cents, gateway_fee_in_cents,
    gateway_fee_source, transfer_method, destination_key_type, destination_key,
    destination_key_masked, updated_at
  ) VALUES (
    v_booking.provider_id, p_booking_id, v_amount,
    CASE WHEN v_has_dispute THEN 'BLOCKED'::public.payout_status
      WHEN v_account.id IS NULL OR v_account.status <> 'ACTIVE' OR NOT v_account.payouts_enabled
        THEN 'BLOCKED'::public.payout_status ELSE 'PENDING'::public.payout_status END,
    v_release_at, 'stripe-transfer:' || p_booking_id, v_booking.total_in_cents,
    v_booking.platform_fee_in_cents, v_gateway_fee,
    CASE WHEN v_payment.gateway_fee_in_cents IS NULL THEN 'CONFIGURED_ESTIMATE' ELSE 'GATEWAY_RESPONSE' END,
    'STRIPE_CONNECT', 'STRIPE_ACCOUNT', NULLIF(v_account.external_account_id, ''),
    CASE WHEN NULLIF(v_account.external_account_id, '') IS NULL THEN NULL
      ELSE 'acct_…' || right(v_account.external_account_id, 6) END, NOW()
  ) ON CONFLICT (booking_id) DO UPDATE SET
    amount_in_cents = EXCLUDED.amount_in_cents,
    scheduled_release_at = EXCLUDED.scheduled_release_at,
    status = CASE WHEN public.payouts.status IN ('PAID','PROCESSING') THEN public.payouts.status ELSE EXCLUDED.status END,
    destination_key_type = EXCLUDED.destination_key_type,
    destination_key = EXCLUDED.destination_key,
    destination_key_masked = EXCLUDED.destination_key_masked,
    transfer_method = EXCLUDED.transfer_method,
    updated_at = NOW()
  RETURNING id INTO v_payout_id;
  RETURN v_payout_id;
END;
$$;
