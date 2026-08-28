-- Preserve payouts that have already been released for manual processing.
-- A refresh of the Admin list must not move AVAILABLE payouts back to PENDING.

CREATE OR REPLACE FUNCTION public.get_admin_payouts()
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
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
    INTO v_safety
    FROM public.platform_configurations
   WHERE key = 'platform_operations';

  SELECT COALESCE((value->>'mercadopago_fee_percentage')::NUMERIC, 5),
         COALESCE((value->>'max_total_fee_percentage')::NUMERIC, 10)
    INTO v_gateway_pct, v_cap_pct
    FROM public.platform_configurations
   WHERE key = 'platform_fees';

  WITH eligible AS (
    SELECT b.*, p.id AS payment_id, p.metadata AS payment_metadata,
           p.gateway_fee_in_cents AS payment_gateway_fee,
           d.key_type, d.pix_key, d.holder_name, d.holder_document
      FROM public.bookings b
      JOIN LATERAL (
        SELECT p.*
          FROM public.payments p
         WHERE p.booking_id = b.id
           AND p.status = 'PAID'
         ORDER BY p.created_at DESC
         LIMIT 1
      ) p ON TRUE
      LEFT JOIN public.provider_pix_destinations d
        ON d.provider_id = b.provider_id
       AND d.is_active IS TRUE
     WHERE b.status = 'COMPLETED'
  ), gateway_calculated AS (
    SELECT e.*,
           COALESCE(e.completed_at, e.lesson_finished_at, e.updated_at)
             + make_interval(hours => v_safety::INTEGER) AS scheduled_at,
           e.total_in_cents AS gross_cents,
           LEAST(
             e.total_in_cents,
             GREATEST(
               0,
               COALESCE(
                 e.payment_gateway_fee,
                 CASE
                   WHEN e.payment_metadata->>'gateway_fee_in_cents' ~ '^\d+$'
                     THEN (e.payment_metadata->>'gateway_fee_in_cents')::INTEGER
                   ELSE FLOOR(e.total_in_cents * v_gateway_pct / 100)::INTEGER
                 END,
                 FLOOR(e.total_in_cents * v_gateway_pct / 100)::INTEGER
               )
             )
           ) AS gateway_cents
      FROM eligible e
  ), calculated AS (
    SELECT g.*,
           LEAST(
             g.platform_fee_in_cents,
             GREATEST(0, FLOOR(g.total_in_cents * v_cap_pct / 100)::INTEGER - g.gateway_cents)
           ) AS platform_cents
      FROM gateway_calculated g
  ), inserted AS (
    INSERT INTO public.payouts (
      provider_id, booking_id, amount_in_cents, status, scheduled_release_at, idempotency_key,
      gross_amount_in_cents, platform_fee_in_cents, gateway_fee_in_cents, gateway_fee_source,
      transfer_method, destination_key_type, destination_key, destination_key_masked,
      recipient_name, recipient_document, updated_at
    )
    SELECT provider_id,
           id,
           GREATEST(0, gross_cents - gateway_cents - platform_cents),
           CASE
             WHEN scheduled_at > NOW() THEN 'PENDING'::public.payout_status
             WHEN key_type IS NULL THEN 'BLOCKED'::public.payout_status
             ELSE 'AVAILABLE'::public.payout_status
           END,
           scheduled_at,
           'payout_' || id,
           gross_cents,
           platform_cents,
           gateway_cents,
           CASE
             WHEN payment_gateway_fee IS NOT NULL
               OR payment_metadata->>'gateway_fee_in_cents' IS NOT NULL
               THEN 'GATEWAY_RESPONSE'
             ELSE 'CONFIGURED_ESTIMATE'
           END,
           'MANUAL_PIX',
           key_type,
           pix_key,
           public.pix_key_mask(key_type, pix_key),
           holder_name,
           holder_document,
           NOW()
      FROM calculated
    ON CONFLICT (booking_id) DO UPDATE
      SET amount_in_cents = EXCLUDED.amount_in_cents,
          status = CASE
            WHEN public.payouts.status IN (
              'PAID'::public.payout_status,
              'AVAILABLE'::public.payout_status
            ) THEN public.payouts.status
            ELSE EXCLUDED.status
          END,
          scheduled_release_at = EXCLUDED.scheduled_release_at,
          gross_amount_in_cents = EXCLUDED.gross_amount_in_cents,
          platform_fee_in_cents = EXCLUDED.platform_fee_in_cents,
          gateway_fee_in_cents = EXCLUDED.gateway_fee_in_cents,
          gateway_fee_source = EXCLUDED.gateway_fee_source,
          destination_key_type = EXCLUDED.destination_key_type,
          destination_key = EXCLUDED.destination_key,
          destination_key_masked = EXCLUDED.destination_key_masked,
          recipient_name = EXCLUDED.recipient_name,
          recipient_document = EXCLUDED.recipient_document,
          updated_at = NOW()
    RETURNING id
  )
  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'id', po.id,
               'provider_id', po.provider_id,
               'booking_id', po.booking_id,
               'amount_in_cents', po.amount_in_cents,
               'status', po.status,
               'scheduled_release_at', po.scheduled_release_at,
               'released_at', po.released_at,
               'gross_amount_in_cents', po.gross_amount_in_cents,
               'platform_fee_in_cents', po.platform_fee_in_cents,
               'gateway_fee_in_cents', po.gateway_fee_in_cents,
               'gateway_fee_source', po.gateway_fee_source,
               'transfer_method', po.transfer_method,
               'destination_key_type', po.destination_key_type,
               'destination_key', po.destination_key,
               'destination_key_masked', po.destination_key_masked,
               'recipient_name', po.recipient_name,
               'recipient_document', po.recipient_document,
               'transfer_reference', po.transfer_reference,
               'processed_at', po.processed_at,
               'provider_name', COALESCE(pr.trade_name, pr.legal_name, 'Prestador')
             )
             ORDER BY po.scheduled_release_at
           ),
           '[]'::JSONB
         )
    INTO v_result
    FROM public.payouts po
    JOIN public.providers pr ON pr.id = po.provider_id
   WHERE po.booking_id IN (
     SELECT b.id
       FROM public.bookings b
      WHERE b.status = 'COMPLETED'
   );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_payouts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_payouts() TO authenticated;
