-- MAZZI — Torna idempotente a notificação do cancelamento da Aula Agora
-- O trigger de alteração de status pode criar BOOKING_CANCELLED antes da RPC.

DO $$
DECLARE
  v_function_definition text;
  v_old_block text := $old$
  IF v_provider_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id, app_context, navigation_action)
    VALUES (v_provider_user_id, 'BOOKING_CANCELLED', 'Aula Agora cancelada', 'O aluno cancelou a Aula Agora.', 'booking', p_booking_id, 'PRO', 'details');
  END IF;
$old$;
  v_new_block text := $new$
  IF v_provider_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id, app_context, navigation_action)
    VALUES (v_provider_user_id, 'BOOKING_CANCELLED', 'Aula Agora cancelada', 'O aluno cancelou a Aula Agora.', 'booking', p_booking_id, 'PRO', 'details')
    ON CONFLICT (user_id, type, entity_type, entity_id)
      WHERE type IN ('BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'LESSON_COMPLETED', 'REVIEW_AVAILABLE')
    DO NOTHING;
  END IF;
$new$;
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
  IF position(v_old_block in v_function_definition) = 0 THEN
    RAISE EXCEPTION 'O bloco de notificação esperado não foi encontrado.';
  END IF;

  EXECUTE replace(v_function_definition, v_old_block, v_new_block);
END;
$$;
