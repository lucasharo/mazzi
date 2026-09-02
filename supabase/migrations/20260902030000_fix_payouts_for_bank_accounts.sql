-- Usa a conta bancária cadastrada pelo PRO como destino dos repasses manuais.
-- A função anterior consultava somente provider_payment_accounts (Stripe Connect),
-- enquanto o cadastro bancário da tela fica em provider_bank_accounts.
CREATE OR REPLACE FUNCTION public.ensure_booking_payout(p_booking_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_account public.provider_bank_accounts%ROWTYPE;
  v_gateway_fee INTEGER;
  v_amount INTEGER;
  v_release_at TIMESTAMPTZ;
  v_payout_id UUID;
  v_has_dispute BOOLEAN;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR v_booking.status NOT IN ('COMPLETED', 'DISPUTED') THEN RETURN NULL; END IF;

  SELECT * INTO v_payment FROM public.payments
   WHERE booking_id = p_booking_id AND status = 'PAID'
   ORDER BY paid_at DESC NULLS LAST, created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO v_account FROM public.provider_bank_accounts
   WHERE provider_id = v_booking.provider_id AND is_active IS TRUE
   ORDER BY updated_at DESC LIMIT 1;

  v_gateway_fee := GREATEST(0, COALESCE(v_payment.gateway_fee_in_cents, 0));
  v_amount := GREATEST(0, v_booking.total_in_cents - v_booking.platform_fee_in_cents - v_gateway_fee);
  v_release_at := COALESCE(v_booking.completed_at, v_booking.lesson_finished_at, v_booking.updated_at)
    + make_interval(hours => public.get_payout_safety_period_hours());
  SELECT EXISTS (
    SELECT 1 FROM public.booking_disputes
    WHERE booking_id = p_booking_id AND status IN ('OPEN','AWAITING_RESPONSE','UNDER_REVIEW')
  ) INTO v_has_dispute;

  INSERT INTO public.payouts (
    provider_id, booking_id, amount_in_cents, status, scheduled_release_at,
    idempotency_key, gross_amount_in_cents, platform_fee_in_cents,
    gateway_fee_in_cents, gateway_fee_source, transfer_method,
    destination_key_type, destination_key, destination_key_masked,
    recipient_name, recipient_document, updated_at
  ) VALUES (
    v_booking.provider_id, p_booking_id, v_amount,
    CASE WHEN v_has_dispute THEN 'BLOCKED'::public.payout_status
         WHEN v_account.id IS NULL THEN 'BLOCKED'::public.payout_status
         ELSE 'PENDING'::public.payout_status END,
    v_release_at, 'stripe-transfer:' || p_booking_id, v_booking.total_in_cents,
    v_booking.platform_fee_in_cents, v_gateway_fee,
    CASE WHEN v_payment.gateway_fee_in_cents IS NULL THEN 'CONFIGURED_ESTIMATE' ELSE 'GATEWAY_RESPONSE' END,
    'MANUAL_BANK_ACCOUNT', 'BANK_ACCOUNT',
    CASE WHEN v_account.id IS NULL THEN NULL
         ELSE format('Banco %s · Agência %s · Conta %s-%s', v_account.bank_code,
           v_account.branch_number, v_account.account_number, v_account.account_digit) END,
    CASE WHEN v_account.id IS NULL THEN NULL
         ELSE format('Banco %s · Ag. %s · Conta %s', v_account.bank_code,
           v_account.branch_number, public.bank_account_number_mask(v_account.account_number, v_account.account_digit)) END,
    v_account.holder_name, v_account.holder_document, NOW()
  ) ON CONFLICT (booking_id) DO UPDATE SET
    amount_in_cents = EXCLUDED.amount_in_cents,
    scheduled_release_at = EXCLUDED.scheduled_release_at,
    status = CASE WHEN public.payouts.status IN ('PAID','PROCESSING') THEN public.payouts.status ELSE EXCLUDED.status END,
    destination_key_type = EXCLUDED.destination_key_type,
    destination_key = EXCLUDED.destination_key,
    destination_key_masked = EXCLUDED.destination_key_masked,
    recipient_name = EXCLUDED.recipient_name,
    recipient_document = EXCLUDED.recipient_document,
    transfer_method = EXCLUDED.transfer_method,
    updated_at = NOW()
  RETURNING id INTO v_payout_id;

  RETURN v_payout_id;
END;
$$;

-- Atualiza registros criados antes da correção para a conta bancária atual.
SELECT public.ensure_booking_payout(id)
FROM public.bookings
WHERE status = 'COMPLETED';
