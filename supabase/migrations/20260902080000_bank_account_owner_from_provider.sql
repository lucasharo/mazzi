-- MAZZI — O titular da conta bancária vem do cadastro canônico do PRO.
-- O formulário envia somente os dados bancários.

CREATE OR REPLACE FUNCTION public.save_my_bank_account(
  p_bank_code VARCHAR,
  p_branch_number VARCHAR,
  p_account_number VARCHAR,
  p_account_digit VARCHAR,
  p_account_type VARCHAR,
  p_holder_name VARCHAR,
  p_holder_document VARCHAR DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_provider_id UUID;
  v_holder VARCHAR;
  v_document VARCHAR;
  v_bank_code VARCHAR := regexp_replace(btrim(COALESCE(p_bank_code, '')), '\D', '', 'g');
  v_branch VARCHAR := regexp_replace(btrim(COALESCE(p_branch_number, '')), '\D', '', 'g');
  v_account VARCHAR := regexp_replace(btrim(COALESCE(p_account_number, '')), '\D', '', 'g');
  v_digit VARCHAR := regexp_replace(btrim(COALESCE(p_account_digit, '')), '\D', '', 'g');
  v_type VARCHAR := upper(btrim(COALESCE(p_account_type, '')));
  v_row public.provider_bank_accounts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  SELECT p.id, COALESCE(NULLIF(btrim(p.legal_name), ''), NULLIF(btrim(p.trade_name), '')), NULLIF(regexp_replace(btrim(COALESCE(p.document_number, '')), '\D', '', 'g'), '')
    INTO v_provider_id, v_holder, v_document
    FROM public.providers p
   WHERE p.user_id = v_uid AND p.status NOT IN ('BLOCKED', 'SUSPENDED')
   ORDER BY p.created_at LIMIT 1;
  IF v_provider_id IS NULL THEN RAISE EXCEPTION 'PROVIDER_NOT_FOUND' USING ERRCODE = '42501'; END IF;
  IF v_holder IS NULL OR length(v_holder) < 3 THEN RAISE EXCEPTION 'PROVIDER_NAME_REQUIRED' USING ERRCODE = '22023'; END IF;
  IF v_document IS NULL OR (v_document !~ '^\d{11}$' AND v_document !~ '^\d{14}$') THEN RAISE EXCEPTION 'PROVIDER_DOCUMENT_REQUIRED' USING ERRCODE = '22023'; END IF;
  IF v_bank_code !~ '^\d{3}$' THEN RAISE EXCEPTION 'BANK_CODE_INVALID' USING ERRCODE = '22023'; END IF;
  IF v_branch !~ '^\d{3,6}$' THEN RAISE EXCEPTION 'BANK_BRANCH_INVALID' USING ERRCODE = '22023'; END IF;
  IF v_account !~ '^\d{3,20}$' THEN RAISE EXCEPTION 'BANK_ACCOUNT_NUMBER_INVALID' USING ERRCODE = '22023'; END IF;
  IF v_digit !~ '^\d{1,2}$' THEN RAISE EXCEPTION 'BANK_ACCOUNT_DIGIT_INVALID' USING ERRCODE = '22023'; END IF;
  IF v_type NOT IN ('CHECKING', 'SAVINGS') THEN RAISE EXCEPTION 'BANK_ACCOUNT_TYPE_INVALID' USING ERRCODE = '22023'; END IF;

  INSERT INTO public.provider_bank_accounts(provider_id, bank_code, branch_number, account_number, account_digit, account_type, holder_name, holder_document, is_active, updated_at)
  VALUES (v_provider_id, v_bank_code, v_branch, v_account, v_digit, v_type, v_holder, v_document, TRUE, NOW())
  ON CONFLICT (provider_id) DO UPDATE SET bank_code=EXCLUDED.bank_code, branch_number=EXCLUDED.branch_number, account_number=EXCLUDED.account_number, account_digit=EXCLUDED.account_digit, account_type=EXCLUDED.account_type, holder_name=EXCLUDED.holder_name, holder_document=EXCLUDED.holder_document, is_active=TRUE, updated_at=NOW()
  RETURNING * INTO v_row;

  INSERT INTO public.audit_logs(id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at)
  VALUES (gen_random_uuid(), v_uid, 'BANK_ACCOUNT_UPDATED', 'ProviderBankAccount', v_provider_id, '{}'::jsonb,
    jsonb_build_object('bank_code',v_row.bank_code,'branch_number',v_row.branch_number,'account_number_masked',public.bank_account_number_mask(v_row.account_number,v_row.account_digit),'account_type',v_row.account_type,'holder_name',v_row.holder_name), NOW());

  RETURN jsonb_build_object('id',v_row.id,'provider_id',v_row.provider_id,'bank_code',v_row.bank_code,'branch_number',v_row.branch_number,'account_number_masked',public.bank_account_number_mask(v_row.account_number,v_row.account_digit),'account_type',v_row.account_type,'holder_name',v_row.holder_name,'holder_document',v_row.holder_document,'is_active',v_row.is_active,'updated_at',v_row.updated_at);
END; $$;
REVOKE ALL ON FUNCTION public.save_my_bank_account(VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_my_bank_account(VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO authenticated;
