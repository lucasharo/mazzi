-- MAZZI — Reembolso integral não retém taxa da plataforma.
-- Em reembolsos parciais, a taxa congelada continua sendo aplicada.

DO $$
DECLARE
  v_definition text;
  v_old text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'ensure_booking_payout'
     AND pg_get_function_identity_arguments(p.oid) = 'p_booking_id uuid';

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'A função ensure_booking_payout não está disponível.';
  END IF;

  v_old := $old$
  v_refund_amount INTEGER;
  v_amount INTEGER;
$old$;
  v_new := $new$
  v_refund_amount INTEGER;
  v_platform_fee INTEGER;
  v_amount INTEGER;
$new$;
  IF position(v_old in v_definition) = 0 THEN
    RAISE EXCEPTION 'Bloco de declarações do payout não encontrado.';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $old$
  v_gateway_fee := GREATEST(0, COALESCE(v_payment.gateway_fee_in_cents, 0));
  v_amount := GREATEST(
    0,
    v_booking.total_in_cents
      - GREATEST(0, LEAST(v_booking.total_in_cents, v_refund_amount))
      - v_booking.platform_fee_in_cents
  );
$old$;
  v_new := $new$
  v_gateway_fee := GREATEST(0, COALESCE(v_payment.gateway_fee_in_cents, 0));
  v_refund_amount := GREATEST(0, LEAST(v_booking.total_in_cents, v_refund_amount));
  v_platform_fee := CASE
    WHEN v_refund_amount >= v_booking.total_in_cents THEN 0
    ELSE GREATEST(0, v_booking.platform_fee_in_cents)
  END;
  v_amount := GREATEST(
    0,
    v_booking.total_in_cents
      - v_refund_amount
      - v_platform_fee
  );
$new$;
  IF position(v_old in v_definition) = 0 THEN
    RAISE EXCEPTION 'Cálculo do payout não encontrado.';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $old$
    v_booking.platform_fee_in_cents,
    v_gateway_fee,
$old$;
  v_new := $new$
    v_platform_fee,
    v_gateway_fee,
$new$;
  IF position(v_old in v_definition) = 0 THEN
    RAISE EXCEPTION 'Retenção da plataforma no insert do payout não encontrada.';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  EXECUTE v_definition;
END;
$$;

-- Reprocessa apenas valores ainda não pagos, preservando transferências já concluídas.
SELECT public.ensure_booking_payout(id)
FROM public.bookings
WHERE status::TEXT IN (
  'COMPLETED', 'DISPUTED', 'CANCELLED_BY_STUDENT',
  'CANCELLED_BY_PROVIDER', 'PARTIALLY_REFUNDED', 'REFUNDED'
);
