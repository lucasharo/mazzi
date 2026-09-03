-- Permite ao próprio instrutor editar os dados que já cadastrou.
-- A função continua protegida e nunca fica exposta via Data API direta.
CREATE OR REPLACE FUNCTION public.get_my_bank_account()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE v_uid UUID := auth.uid(); v_row public.provider_bank_accounts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  SELECT b.* INTO v_row FROM public.provider_bank_accounts b
  JOIN public.providers p ON p.id = b.provider_id
  WHERE p.user_id = v_uid AND b.is_active IS TRUE
  ORDER BY b.updated_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;
  RETURN jsonb_build_object(
    'id', v_row.id, 'provider_id', v_row.provider_id, 'bank_code', v_row.bank_code,
    'branch_number', v_row.branch_number, 'account_number', v_row.account_number,
    'account_digit', v_row.account_digit, 'account_number_masked', public.bank_account_number_mask(v_row.account_number, v_row.account_digit),
    'account_type', v_row.account_type, 'holder_name', v_row.holder_name,
    'holder_document', v_row.holder_document, 'is_active', v_row.is_active, 'updated_at', v_row.updated_at
  );
END;
$$;
