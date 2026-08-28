-- The Edge Function authenticates the caller and uses service_role only for
-- server-side reads and payment state transitions. RLS remains enabled and no
-- additional privilege is granted to anon/authenticated.
GRANT SELECT, UPDATE ON TABLE public.payments TO service_role;
GRANT SELECT ON TABLE public.bookings TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_mercadopago_test_payment(
  p_payment_id uuid,
  p_external_payment_id varchar,
  p_card_brand varchar DEFAULT NULL,
  p_card_last4 varchar DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_card_last4 text := NULLIF(regexp_replace(COALESCE(p_card_last4, ''), '\D', '', 'g'), '');
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'PAYMENT_FINALIZATION_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  UPDATE public.payments
  SET gateway_provider = 'mercadopago_test',
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
        'environment', 'test',
        'card_brand', NULLIF(trim(p_card_brand), ''),
        'card_last4', v_card_last4
      )),
      updated_at = now()
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND';
  END IF;

  RETURN public.confirm_booking_payment(p_payment_id, p_external_payment_id, now());
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_mercadopago_test_payment(uuid, varchar, varchar, varchar) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_mercadopago_test_payment(uuid, varchar, varchar, varchar) TO service_role;
