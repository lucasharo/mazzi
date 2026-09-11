-- MAZZI — Garante repasse do PRO após reembolso parcial/total
-- O cancelamento atualiza o pagamento antes do trigger de payout.

DO $$
DECLARE
  v_function_definition text;
  v_old_block text := $old$
  WHERE booking_id = p_booking_id
    AND status = 'PAID'
  ORDER BY paid_at DESC NULLS LAST, created_at DESC
  LIMIT 1;
$old$;
  v_new_block text := $new$
  WHERE booking_id = p_booking_id
    AND status IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')
  ORDER BY paid_at DESC NULLS LAST, created_at DESC
  LIMIT 1;
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
    RAISE EXCEPTION 'O filtro de pagamento esperado não foi encontrado.';
  END IF;

  EXECUTE replace(v_function_definition, v_old_block, v_new_block);
END;
$$;

-- Reprocessa apenas estados já elegíveis; a função é idempotente e preserva
-- repasses já pagos ou em processamento.
SELECT public.ensure_booking_payout(id)
FROM public.bookings
WHERE status::TEXT IN (
  'COMPLETED', 'DISPUTED', 'CANCELLED_BY_STUDENT',
  'CANCELLED_BY_PROVIDER', 'PARTIALLY_REFUNDED', 'REFUNDED'
);
