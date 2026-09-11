-- MAZZI — Reutiliza um estorno Aula Agora pendente após falha de sincronização
-- Evita criar uma nova tentativa quando o Stripe já confirmou a anterior.

DO $$
DECLARE
  v_function_definition text;
  v_old_block text := $old$
  SELECT * INTO v_existing
    FROM public.refunds
   WHERE idempotency_key = v_key
   FOR UPDATE;
  IF FOUND THEN
    IF v_existing.booking_id <> p_booking_id OR v_existing.payment_id <> v_payment.id THEN
      RAISE EXCEPTION 'REFUND_IDEMPOTENCY_COLLISION' USING ERRCODE = '23505';
    END IF;
    IF v_existing.status NOT IN ('PENDING', 'PROCESSED') THEN
      RAISE EXCEPTION 'REFUND_STATE_INVALID' USING ERRCODE = '22000';
    END IF;
    v_refund_id := v_existing.id;
  END IF;
$old$;
  v_new_block text := $new$
  SELECT * INTO v_existing
    FROM public.refunds
   WHERE idempotency_key = v_key
   FOR UPDATE;
  IF NOT FOUND THEN
    SELECT * INTO v_existing
      FROM public.refunds
     WHERE booking_id = p_booking_id
       AND payment_id = v_payment.id
       AND status IN ('PENDING', 'PROCESSED')
     ORDER BY created_at DESC
     LIMIT 1
     FOR UPDATE;
    IF FOUND THEN
      v_key := v_existing.idempotency_key;
      v_refund_id := v_existing.id;
    END IF;
  ELSE
    IF v_existing.booking_id <> p_booking_id OR v_existing.payment_id <> v_payment.id THEN
      RAISE EXCEPTION 'REFUND_IDEMPOTENCY_COLLISION' USING ERRCODE = '23505';
    END IF;
    IF v_existing.status NOT IN ('PENDING', 'PROCESSED') THEN
      RAISE EXCEPTION 'REFUND_STATE_INVALID' USING ERRCODE = '22000';
    END IF;
    v_refund_id := v_existing.id;
  END IF;
$new$;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_function_definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'prepare_instant_booking_cancellation'
     AND pg_get_function_identity_arguments(p.oid) = 'p_booking_id uuid, p_reason text, p_reason_code text, p_idempotency_key text';

  IF v_function_definition IS NULL THEN
    RAISE EXCEPTION 'A função prepare_instant_booking_cancellation não está disponível.';
  END IF;
  IF position(v_old_block in v_function_definition) = 0 THEN
    RAISE EXCEPTION 'O bloco de idempotência esperado não foi encontrado.';
  END IF;

  EXECUTE replace(v_function_definition, v_old_block, v_new_block);
END;
$$;

