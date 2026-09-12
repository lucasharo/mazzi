-- MAZZI — Conta Connect americana exclusiva para testes DEV.
-- Não substitui a conta STRIPE principal e não deve ser usada em Production.

CREATE OR REPLACE FUNCTION public.get_my_us_test_provider_payment_account()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.provider_payment_accounts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  SELECT a.* INTO v_row
    FROM public.provider_payment_accounts a
    JOIN public.providers p ON p.id = a.provider_id
   WHERE p.user_id = v_uid AND a.gateway = 'STRIPE_US_TEST'
   ORDER BY a.updated_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;
  RETURN jsonb_build_object(
    'id', v_row.id, 'provider_id', v_row.provider_id, 'gateway', v_row.gateway,
    'external_account_id', v_row.external_account_id, 'status', v_row.status,
    'charges_enabled', v_row.charges_enabled, 'payouts_enabled', v_row.payouts_enabled,
    'onboarding_url', v_row.onboarding_url, 'metadata', v_row.metadata,
    'created_at', v_row.created_at, 'updated_at', v_row.updated_at
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_us_test_provider_payment_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_us_test_provider_payment_account() TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_my_us_test_provider_payment_account(
  p_external_account_id TEXT, p_status TEXT, p_charges_enabled BOOLEAN,
  p_payouts_enabled BOOLEAN, p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_provider_id UUID;
  v_row public.provider_payment_accounts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  SELECT id INTO v_provider_id FROM public.providers
   WHERE user_id = v_uid AND status NOT IN ('BLOCKED', 'SUSPENDED')
   ORDER BY created_at LIMIT 1;
  IF v_provider_id IS NULL THEN RAISE EXCEPTION 'PROVIDER_NOT_FOUND' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.provider_payment_accounts(
    provider_id, gateway, external_account_id, status, charges_enabled,
    payouts_enabled, metadata, updated_at
  ) VALUES (
    v_provider_id, 'STRIPE_US_TEST', p_external_account_id, p_status,
    p_charges_enabled, p_payouts_enabled, COALESCE(p_metadata, '{}'::jsonb), NOW()
  )
  ON CONFLICT (provider_id, gateway) DO UPDATE SET
    external_account_id = EXCLUDED.external_account_id,
    status = EXCLUDED.status,
    charges_enabled = EXCLUDED.charges_enabled,
    payouts_enabled = EXCLUDED.payouts_enabled,
    metadata = EXCLUDED.metadata,
    updated_at = NOW()
  RETURNING * INTO v_row;
  RETURN jsonb_build_object(
    'id', v_row.id, 'provider_id', v_row.provider_id, 'gateway', v_row.gateway,
    'external_account_id', v_row.external_account_id, 'status', v_row.status,
    'charges_enabled', v_row.charges_enabled, 'payouts_enabled', v_row.payouts_enabled,
    'onboarding_url', v_row.onboarding_url, 'metadata', v_row.metadata,
    'created_at', v_row.created_at, 'updated_at', v_row.updated_at
  );
END;
$$;
REVOKE ALL ON FUNCTION public.upsert_my_us_test_provider_payment_account(TEXT, TEXT, BOOLEAN, BOOLEAN, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_my_us_test_provider_payment_account(TEXT, TEXT, BOOLEAN, BOOLEAN, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_my_us_test_provider_payment_account(
  p_external_account_id TEXT, p_status TEXT, p_charges_enabled BOOLEAN,
  p_payouts_enabled BOOLEAN, p_metadata JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.provider_payment_accounts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  UPDATE public.provider_payment_accounts a SET
    status = p_status, charges_enabled = p_charges_enabled,
    payouts_enabled = p_payouts_enabled,
    metadata = COALESCE(p_metadata, a.metadata), updated_at = NOW()
  FROM public.providers p
  WHERE a.provider_id = p.id AND p.user_id = v_uid
    AND a.gateway = 'STRIPE_US_TEST'
    AND a.external_account_id = p_external_account_id
  RETURNING a.* INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_ACCOUNT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object(
    'id', v_row.id, 'provider_id', v_row.provider_id, 'gateway', v_row.gateway,
    'external_account_id', v_row.external_account_id, 'status', v_row.status,
    'charges_enabled', v_row.charges_enabled, 'payouts_enabled', v_row.payouts_enabled,
    'onboarding_url', v_row.onboarding_url, 'metadata', v_row.metadata,
    'created_at', v_row.created_at, 'updated_at', v_row.updated_at
  );
END;
$$;
REVOKE ALL ON FUNCTION public.update_my_us_test_provider_payment_account(TEXT, TEXT, BOOLEAN, BOOLEAN, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_us_test_provider_payment_account(TEXT, TEXT, BOOLEAN, BOOLEAN, JSONB) TO authenticated;
