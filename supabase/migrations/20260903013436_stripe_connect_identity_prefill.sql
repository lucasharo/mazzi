-- MAZZI — Trusted Stripe Connect identity prefill for hosted onboarding.
-- Only the authenticated owner can call this function. It returns a narrow,
-- sanitized identity projection; banking details, documents and legal
-- acceptance remain exclusively in Stripe's onboarding flow.

CREATE OR REPLACE FUNCTION public.get_my_provider_identity()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_provider public.providers%ROWTYPE;
  v_user public.users%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_provider
    FROM public.providers
   WHERE user_id = v_uid
     AND status NOT IN ('BLOCKED', 'SUSPENDED')
   ORDER BY created_at
   LIMIT 1;

  IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;

  SELECT * INTO v_user
    FROM public.users
   WHERE id = v_uid;

  RETURN jsonb_build_object(
    'id', v_provider.id,
    'user_id', v_provider.user_id,
    'provider_type', v_provider.type::text,
    'legal_name', v_provider.legal_name,
    'trade_name', v_provider.trade_name,
    'document_number', regexp_replace(COALESCE(v_provider.document_number, ''), '\D', '', 'g'),
    'phone', COALESCE(NULLIF(v_provider.phone, ''), NULLIF(v_user.phone, '')),
    'public_contact', v_provider.public_contact,
    'commercial_email', v_provider.commercial_email,
    'neighborhood', v_provider.neighborhood,
    'city', v_provider.city,
    'state', v_provider.state,
    'postal_code', v_provider.postal_code,
    'address', v_provider.address,
    'user_name', v_user.name,
    'user_email', v_user.email,
    'user_phone', v_user.phone,
    'user_cpf', regexp_replace(COALESCE(v_user.cpf, ''), '\D', '', 'g'),
    'birth_date', v_user.birth_date
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_provider_identity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_provider_identity() TO authenticated;
