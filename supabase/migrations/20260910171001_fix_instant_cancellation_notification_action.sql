-- MAZZI — Corrige a ação de navegação da notificação de cancelamento Aula Agora
-- A tabela de notificações usa `details` para abrir o detalhe da reserva.

DO $$
DECLARE
  v_function_definition text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_function_definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'finalize_instant_booking_cancellation'
     AND pg_get_function_identity_arguments(p.oid) = 'p_booking_id uuid, p_reason text, p_reason_code text, p_idempotency_key text, p_refund_amount_in_cents integer, p_external_refund_id text, p_actor_id uuid';

  IF v_function_definition IS NULL THEN
    RAISE EXCEPTION 'A função finalize_instant_booking_cancellation não está disponível.';
  END IF;

  v_function_definition := replace(
    v_function_definition,
    '''PRO'', ''booking''',
    '''PRO'', ''details'''
  );

  IF position('''PRO'', ''details''' in v_function_definition) = 0 THEN
    RAISE EXCEPTION 'A ação de navegação não foi corrigida na função de finalização.';
  END IF;

  EXECUTE v_function_definition;
END;
$$;
