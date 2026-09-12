-- MAZZI — Payout residual de cancelamento parcialmente reembolsado.
-- Um pagamento PARTIALLY_REFUNDED ainda pode ter saldo devido ao PRO.

DO $$
DECLARE
  v_definition TEXT;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'claim_due_stripe_payouts'
     AND pg_get_function_identity_arguments(p.oid) = 'p_limit integer';

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'A função claim_due_stripe_payouts não está disponível.';
  END IF;

  v_definition := replace(
    v_definition,
    $old$payment.status='PAID'$old$,
    $new$payment.status IN ('PAID','PARTIALLY_REFUNDED','REFUNDED')$new$
  );
  v_definition := replace(
    v_definition,
    $old$p.status='PAID'$old$,
    $new$p.status IN ('PAID','PARTIALLY_REFUNDED','REFUNDED')$new$
  );

  EXECUTE v_definition;
END;
$$;
