-- MAZZI — A retenção da MAZZI já inclui o custo do meio de pagamento.
-- gateway_fee_in_cents permanece registrado para auditoria, mas não é abatido
-- novamente do valor devido ao PRO.

DO $$
DECLARE
  v_function_definition text;
  v_old_block text := $old$
  v_amount := GREATEST(
    0,
    v_booking.total_in_cents
      - GREATEST(0, LEAST(v_booking.total_in_cents, v_refund_amount))
      - v_booking.platform_fee_in_cents
      - v_gateway_fee
  );
$old$;
  v_new_block text := $new$
  v_amount := GREATEST(
    0,
    v_booking.total_in_cents
      - GREATEST(0, LEAST(v_booking.total_in_cents, v_refund_amount))
      - v_booking.platform_fee_in_cents
  );
$new$;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_function_definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'ensure_booking_payout'
     AND pg_get_function_identity_arguments(p.oid) = 'p_booking_id uuid';

  IF v_function_definition IS NULL THEN
    RAISE EXCEPTION 'A função ensure_booking_payout não está disponível.';
  END IF;
  IF position(v_old_block in v_function_definition) = 0 THEN
    RAISE EXCEPTION 'O cálculo de payout esperado não foi encontrado.';
  END IF;

  EXECUTE replace(v_function_definition, v_old_block, v_new_block);
END;
$$;

-- Recalcula valores pendentes sem alterar repasses já pagos ou em processamento.
SELECT public.ensure_booking_payout(id)
FROM public.bookings
WHERE status::TEXT IN (
  'COMPLETED', 'DISPUTED', 'CANCELLED_BY_STUDENT',
  'CANCELLED_BY_PROVIDER', 'PARTIALLY_REFUNDED', 'REFUNDED'
);
