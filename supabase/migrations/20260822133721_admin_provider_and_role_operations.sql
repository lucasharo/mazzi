-- MAZZI — TASK-076: transactional Admin provider lifecycle and role operations.

CREATE OR REPLACE FUNCTION public.admin_review_provider(
  p_provider_id UUID,
  p_status public.provider_status,
  p_reason TEXT DEFAULT NULL
)
RETURNS public.providers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_previous public.providers;
  v_updated public.providers;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('ACTIVE', 'REJECTED', 'SUSPENDED', 'BLOCKED') THEN
    RAISE EXCEPTION 'INVALID_PROVIDER_STATUS' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_previous FROM public.providers WHERE id = p_provider_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROVIDER_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF p_status = 'ACTIVE' AND v_previous.type = 'INSTRUCTOR'::public.provider_type
     AND (v_previous.user_id IS NULL OR NOT public.is_instructor_global_compliance_valid(v_previous.user_id, NULL)) THEN
    RAISE EXCEPTION 'PROVIDER_COMPLIANCE_REQUIRED' USING ERRCODE = '42501';
  END IF;

  UPDATE public.providers
  SET status = p_status,
      submitted_at = CASE WHEN p_status = 'PENDING_REVIEW' THEN COALESCE(submitted_at, now()) ELSE submitted_at END,
      approved_at = CASE WHEN p_status = 'ACTIVE' THEN now() ELSE approved_at END,
      approved_by = CASE WHEN p_status = 'ACTIVE' THEN v_uid ELSE approved_by END,
      rejected_at = CASE WHEN p_status = 'REJECTED' THEN now() ELSE rejected_at END,
      rejected_by = CASE WHEN p_status = 'REJECTED' THEN v_uid ELSE rejected_by END,
      rejection_reason = CASE WHEN p_status = 'REJECTED' THEN NULLIF(BTRIM(p_reason), '') ELSE rejection_reason END,
      suspended_at = CASE WHEN p_status = 'SUSPENDED' THEN now() ELSE suspended_at END,
      updated_at = now()
  WHERE id = p_provider_id
  RETURNING * INTO v_updated;

  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, previous_value, new_value)
  VALUES (v_uid, 'ADMIN_PROVIDER_REVIEW', 'Provider', p_provider_id::TEXT,
    jsonb_build_object('status', v_previous.status),
    jsonb_build_object('status', p_status, 'reason', NULLIF(BTRIM(p_reason), '')));
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_provider(UUID, public.provider_status, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_provider(UUID, public.provider_status, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_user_role(
  p_user_id UUID,
  p_role public.user_role
)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_previous public.users;
  v_updated public.users;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  IF p_user_id = v_uid THEN RAISE EXCEPTION 'SELF_ROLE_CHANGE_FORBIDDEN' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_previous FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  UPDATE public.users SET role = p_role, updated_at = now() WHERE id = p_user_id RETURNING * INTO v_updated;
  INSERT INTO public.user_roles(user_id, role, granted_by)
  VALUES (p_user_id, p_role, v_uid)
  ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, previous_value, new_value)
  VALUES (v_uid, 'ADMIN_USER_ROLE_CHANGED', 'User', p_user_id::TEXT,
    jsonb_build_object('role', v_previous.role), jsonb_build_object('role', p_role));
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user_role(UUID, public.user_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(UUID, public.user_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_refund_mock_booking(
  p_booking_id UUID,
  p_reason TEXT DEFAULT 'ADMIN_MOCK_REFUND'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_payment RECORD;
  v_refunded BIGINT;
  v_key TEXT := 'admin_mock_refund:' || p_booking_id::TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  SELECT p.* INTO v_payment FROM public.payments p WHERE p.booking_id = p_booking_id ORDER BY p.created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF UPPER(COALESCE(v_payment.gateway_provider, '')) NOT IN ('MOCK_VALIDATION', 'SUPABASE_GATEWAY', 'FAKE') THEN
    RAISE EXCEPTION 'REAL_GATEWAY_REFUND_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(SUM(r.amount_in_cents), 0) INTO v_refunded
  FROM public.refunds r WHERE r.payment_id = v_payment.id AND r.status = 'PROCESSED';
  IF v_refunded >= v_payment.amount_in_cents THEN
    RETURN jsonb_build_object('success', TRUE, 'is_existing', TRUE, 'amount_in_cents', v_refunded);
  END IF;
  RETURN public.process_booking_refund(
    v_payment.id,
    (v_payment.amount_in_cents - v_refunded)::INT,
    COALESCE(NULLIF(BTRIM(p_reason), ''), 'ADMIN_MOCK_REFUND'),
    v_key,
    NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_refund_mock_booking(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_refund_mock_booking(UUID, TEXT) TO authenticated;
