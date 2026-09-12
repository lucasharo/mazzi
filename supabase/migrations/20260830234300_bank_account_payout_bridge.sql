-- Usa a conta bancária cadastrada pelo prestador nos novos repasses.
-- Destino Pix legado continua sendo aceito apenas para preservar histórico.

CREATE OR REPLACE FUNCTION public.get_admin_payouts()
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_safety NUMERIC := 24;
  v_gateway_pct NUMERIC := 5;
  v_cap_pct NUMERIC := 10;
  v_result JSONB;
BEGIN
  IF v_uid IS NULL OR NOT public.current_user_has_permission('admin.finance.read_all'::public.app_permission) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE((value->>'payout_safety_period_hours')::NUMERIC, 24)
    INTO v_safety FROM public.platform_configurations WHERE key = 'platform_operations';
  SELECT COALESCE((value->>'mercadopago_fee_percentage')::NUMERIC, 5),
         COALESCE((value->>'max_total_fee_percentage')::NUMERIC, 10)
    INTO v_gateway_pct, v_cap_pct FROM public.platform_configurations WHERE key = 'platform_fees';

  WITH eligible AS (
    SELECT b.*, p.id AS payment_id, p.metadata AS payment_metadata,
      p.gateway_fee_in_cents AS payment_gateway_fee,
      CASE WHEN ba.id IS NOT NULL THEN 'BANK_ACCOUNT' ELSE d.key_type END AS destination_type,
      CASE WHEN ba.id IS NOT NULL THEN
        format('Banco %s · Agência %s · Conta %s-%s · %s', ba.bank_code, ba.branch_number,
          ba.account_number, ba.account_digit,
          CASE WHEN ba.account_type = 'SAVINGS' THEN 'Poupança' ELSE 'Corrente' END)
        ELSE d.pix_key END AS destination_value,
      CASE WHEN ba.id IS NOT NULL THEN
        format('Banco %s · Ag. %s · Conta %s-%s · %s', ba.bank_code, ba.branch_number,
          public.bank_account_number_mask(ba.account_number, ba.account_digit),
          CASE WHEN ba.account_type = 'SAVINGS' THEN 'Poupança' ELSE 'Corrente' END)
        ELSE public.pix_key_mask(d.key_type, d.pix_key) END AS destination_masked,
      COALESCE(ba.holder_name, d.holder_name) AS destination_holder,
      COALESCE(ba.holder_document, d.holder_document) AS destination_document,
      ba.id AS bank_account_id
    FROM public.bookings b
    JOIN LATERAL (
      SELECT p.* FROM public.payments p
       WHERE p.booking_id = b.id AND p.status = 'PAID'
       ORDER BY p.created_at DESC LIMIT 1
    ) p ON TRUE
    LEFT JOIN public.provider_bank_accounts ba
      ON ba.provider_id = b.provider_id AND ba.is_active IS TRUE
    LEFT JOIN public.provider_pix_destinations d
      ON d.provider_id = b.provider_id AND d.is_active IS TRUE AND ba.id IS NULL
    WHERE b.status = 'COMPLETED'
  ), gateway_calculated AS (
    SELECT e.*, COALESCE(e.completed_at, e.lesson_finished_at, e.updated_at)
      + make_interval(hours => v_safety::INTEGER) AS scheduled_at,
      e.total_in_cents AS gross_cents,
      LEAST(e.total_in_cents, GREATEST(0, COALESCE(e.payment_gateway_fee,
        CASE WHEN e.payment_metadata->>'gateway_fee_in_cents' ~ '^\d+$'
          THEN (e.payment_metadata->>'gateway_fee_in_cents')::INTEGER
          ELSE FLOOR(e.total_in_cents * v_gateway_pct / 100)::INTEGER END,
        FLOOR(e.total_in_cents * v_gateway_pct / 100)::INTEGER))) AS gateway_cents
    FROM eligible e
  ), calculated AS (
    SELECT g.*, LEAST(g.platform_fee_in_cents,
      GREATEST(0, FLOOR(g.total_in_cents * v_cap_pct / 100)::INTEGER - g.gateway_cents)) AS platform_cents
    FROM gateway_calculated g
  )
  INSERT INTO public.payouts (
    provider_id, booking_id, amount_in_cents, status, scheduled_release_at, idempotency_key,
    gross_amount_in_cents, platform_fee_in_cents, gateway_fee_in_cents, gateway_fee_source,
    transfer_method, destination_key_type, destination_key, destination_key_masked,
    recipient_name, recipient_document, updated_at
  )
  SELECT provider_id, id, GREATEST(0, gross_cents - gateway_cents - platform_cents),
    CASE WHEN scheduled_at > NOW() THEN 'PENDING'::public.payout_status
         WHEN destination_type IS NULL THEN 'BLOCKED'::public.payout_status
         ELSE 'AVAILABLE'::public.payout_status END,
    scheduled_at, 'payout_' || id, gross_cents, platform_cents, gateway_cents,
    CASE WHEN payment_gateway_fee IS NOT NULL OR payment_metadata->>'gateway_fee_in_cents' IS NOT NULL
      THEN 'GATEWAY_RESPONSE' ELSE 'CONFIGURED_ESTIMATE' END,
    CASE WHEN bank_account_id IS NOT NULL THEN 'MANUAL_BANK_ACCOUNT' ELSE 'MANUAL_PIX' END,
    destination_type, destination_value, destination_masked, destination_holder,
    destination_document, NOW()
  FROM calculated
  ON CONFLICT (booking_id) DO UPDATE SET
    amount_in_cents = EXCLUDED.amount_in_cents,
    status = CASE WHEN public.payouts.status = 'PAID' THEN public.payouts.status ELSE EXCLUDED.status END,
    scheduled_release_at = EXCLUDED.scheduled_release_at,
    gross_amount_in_cents = EXCLUDED.gross_amount_in_cents,
    platform_fee_in_cents = EXCLUDED.platform_fee_in_cents,
    gateway_fee_in_cents = EXCLUDED.gateway_fee_in_cents,
    gateway_fee_source = EXCLUDED.gateway_fee_source,
    transfer_method = EXCLUDED.transfer_method,
    destination_key_type = EXCLUDED.destination_key_type,
    destination_key = EXCLUDED.destination_key,
    destination_key_masked = EXCLUDED.destination_key_masked,
    recipient_name = EXCLUDED.recipient_name,
    recipient_document = EXCLUDED.recipient_document,
    updated_at = NOW();

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', po.id, 'provider_id', po.provider_id, 'booking_id', po.booking_id,
    'amount_in_cents', po.amount_in_cents, 'status', po.status,
    'scheduled_release_at', po.scheduled_release_at, 'released_at', po.released_at,
    'gross_amount_in_cents', po.gross_amount_in_cents,
    'platform_fee_in_cents', po.platform_fee_in_cents,
    'gateway_fee_in_cents', po.gateway_fee_in_cents,
    'gateway_fee_source', po.gateway_fee_source, 'transfer_method', po.transfer_method,
    'destination_key_type', po.destination_key_type, 'destination_key', po.destination_key,
    'destination_key_masked', po.destination_key_masked,
    'recipient_name', po.recipient_name, 'recipient_document', po.recipient_document,
    'transfer_reference', po.transfer_reference, 'processed_at', po.processed_at,
    'provider_name', COALESCE(pr.trade_name, pr.legal_name, 'Prestador')
  ) ORDER BY po.scheduled_release_at), '[]'::jsonb)
    INTO v_result
    FROM public.payouts po JOIN public.providers pr ON pr.id = po.provider_id
   WHERE po.booking_id IN (SELECT b.id FROM public.bookings b WHERE b.status = 'COMPLETED');
  RETURN v_result;
END;
$$;

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
  IF NULLIF(btrim(v_payout.destination_key), '') IS NULL THEN RAISE EXCEPTION 'BANK_ACCOUNT_REQUIRED' USING ERRCODE = '22000'; END IF;
  UPDATE public.payouts SET status = 'PAID', released_at = v_now, processed_at = v_now, processed_by = v_uid,
    transfer_reference = btrim(p_transfer_reference), updated_at = v_now WHERE id = p_payout_id;
  INSERT INTO public.audit_logs (id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at)
  VALUES (gen_random_uuid(), v_uid, 'PAYOUT_COMPLETED', 'Payout', p_payout_id,
    jsonb_build_object('status', v_payout.status),
    jsonb_build_object('status', 'PAID', 'amount_in_cents', v_payout.amount_in_cents, 'transfer_reference', btrim(p_transfer_reference)), v_now);
  RETURN jsonb_build_object('success', TRUE, 'is_idempotent', FALSE, 'payout_id', p_payout_id, 'status', 'PAID', 'released_at', v_now, 'transfer_reference', btrim(p_transfer_reference));
END;
$$;
