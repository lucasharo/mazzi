-- MAZZI — Onboarding hospedado da Stripe.
-- O aplicativo não coleta nem consulta dados bancários; a Stripe coleta a conta
-- externa no Account Link e o MAZZI mantém somente o ID/status Connect.

CREATE OR REPLACE FUNCTION public.get_my_provider_identity()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.providers%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000'; END IF;
  SELECT * INTO v_row
    FROM public.providers
   WHERE user_id = v_uid AND status NOT IN ('BLOCKED', 'SUSPENDED')
   ORDER BY created_at
   LIMIT 1;
  IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;
  RETURN jsonb_build_object(
    'id', v_row.id,
    'user_id', v_row.user_id,
    'legal_name', v_row.legal_name,
    'trade_name', v_row.trade_name,
    'document_number', regexp_replace(COALESCE(v_row.document_number, ''), '\D', '', 'g')
  );
END; $$;
REVOKE ALL ON FUNCTION public.get_my_provider_identity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_provider_identity() TO authenticated;

-- Bloqueia novos acessos ao fluxo legado que armazenava agência e conta no MAZZI.
-- Os dados históricos não são apagados nesta migration; permanecem protegidos
-- para permitir uma remoção planejada e auditada em separado.
REVOKE ALL ON FUNCTION public.save_my_bank_account(VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_bank_account()
  FROM PUBLIC, anon, authenticated;
