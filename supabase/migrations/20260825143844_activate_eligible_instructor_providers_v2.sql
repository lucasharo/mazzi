-- R10B: central provider activation eligibility and automatic promotion.
-- Provider-scoped legacy compliance rows are accepted as equivalent evidence
-- for the same provider; no frontend state is used as authority.
BEGIN;

DROP FUNCTION public.admin_review_provider(uuid, public.provider_status, text);

CREATE OR REPLACE FUNCTION public.is_provider_activation_eligible(p_provider_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.providers p
    JOIN public.users u ON u.id=p.user_id
    WHERE p.id=p_provider_id
      AND p.type='INSTRUCTOR'::public.provider_type
      AND p.status IN ('DRAFT'::public.provider_status,'PENDING_REVIEW'::public.provider_status)
      AND u.status='ACTIVE'
      AND (u.role='INSTRUCTOR'::public.user_role OR EXISTS (
        SELECT 1 FROM public.user_roles ur WHERE ur.user_id=u.id AND ur.role='INSTRUCTOR'::public.user_role
      ))
      AND NOT EXISTS (
        SELECT 1
        FROM public.compliance_requirements r
        WHERE r.scope='USER_GLOBAL'::public.compliance_document_scope
          AND r.provider_type='INSTRUCTOR'::public.provider_type
          AND r.is_mandatory IS TRUE
          AND (r.effective_from IS NULL OR r.effective_from<=NOW())
          AND (r.effective_to IS NULL OR r.effective_to>=NOW())
          AND r.regulatory_status NOT IN ('SUPERSEDED','INACTIVE')
          AND NOT EXISTS (
            SELECT 1
            FROM public.compliance_documents d
            WHERE d.status='APPROVED'::public.compliance_status
              AND (d.expires_at IS NULL OR d.expires_at>NOW())
              AND (
                (d.scope='USER_GLOBAL'::public.compliance_document_scope
                  AND d.user_id=p.user_id AND d.provider_id IS NULL)
                OR
                (d.scope='PROVIDER'::public.compliance_document_scope
                  AND d.provider_id=p.id)
              )
              AND (
                d.document_type::text=r.document_type::text
                OR (r.document_type::text='CNH_EAR' AND d.document_type::text='CNH')
                OR (r.document_type::text='CREDENTIAL_DETRAN_SP' AND d.document_type::text='CREDENTIAL_DETRAN')
              )
          )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_provider_activation_eligible(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.promote_eligible_instructor_provider()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_provider public.providers;
BEGIN
  IF NEW.status='APPROVED'::public.compliance_status AND NEW.provider_id IS NOT NULL THEN
    UPDATE public.providers p
    SET status='ACTIVE'::public.provider_status,
        approved_at=COALESCE(p.approved_at,NOW()),
        updated_at=NOW()
    WHERE p.id=NEW.provider_id
      AND p.type='INSTRUCTOR'::public.provider_type
      AND p.status IN ('DRAFT'::public.provider_status,'PENDING_REVIEW'::public.provider_status)
      AND public.is_provider_activation_eligible(p.id)
    RETURNING p.* INTO v_provider;

    IF FOUND THEN
      INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,previous_value,new_value,created_at)
      VALUES (NEW.reviewed_by,'PROVIDER_AUTO_ACTIVATED','Provider',v_provider.id::text,
        jsonb_build_object('status','DRAFT'),jsonb_build_object('status','ACTIVE'),NOW());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS promote_eligible_instructor_provider_after_compliance
  ON public.compliance_documents;
CREATE TRIGGER promote_eligible_instructor_provider_after_compliance
AFTER INSERT OR UPDATE OF status, provider_id ON public.compliance_documents
FOR EACH ROW EXECUTE FUNCTION public.promote_eligible_instructor_provider();

CREATE OR REPLACE FUNCTION public.admin_review_provider(
  p_provider_id uuid, p_status public.provider_status, p_reason text)
RETURNS public.providers
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_uid uuid:=auth.uid(); v_previous public.providers; v_updated public.providers;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000'; END IF;
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF p_status NOT IN ('ACTIVE','REJECTED','SUSPENDED','BLOCKED') THEN RAISE EXCEPTION 'INVALID_PROVIDER_STATUS' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_previous FROM public.providers WHERE id=p_provider_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROVIDER_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF p_status='ACTIVE' AND v_previous.type='INSTRUCTOR'::public.provider_type
     AND NOT public.is_provider_activation_eligible(p_provider_id) THEN
    RAISE EXCEPTION 'PROVIDER_COMPLIANCE_REQUIRED' USING ERRCODE='42501';
  END IF;
  UPDATE public.providers SET status=p_status,
    submitted_at=CASE WHEN p_status='PENDING_REVIEW' THEN COALESCE(submitted_at,NOW()) ELSE submitted_at END,
    approved_at=CASE WHEN p_status='ACTIVE' THEN NOW() ELSE approved_at END,
    approved_by=CASE WHEN p_status='ACTIVE' THEN v_uid ELSE approved_by END,
    rejected_at=CASE WHEN p_status='REJECTED' THEN NOW() ELSE rejected_at END,
    rejected_by=CASE WHEN p_status='REJECTED' THEN v_uid ELSE rejected_by END,
    rejection_reason=CASE WHEN p_status='REJECTED' THEN NULLIF(BTRIM(p_reason),'') ELSE rejection_reason END,
    suspended_at=CASE WHEN p_status='SUSPENDED' THEN NOW() ELSE suspended_at END,
    updated_at=NOW()
  WHERE id=p_provider_id RETURNING * INTO v_updated;
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,previous_value,new_value)
  VALUES(v_uid,'ADMIN_PROVIDER_REVIEW','Provider',p_provider_id::text,
    jsonb_build_object('status',v_previous.status),
    jsonb_build_object('status',p_status,'reason',NULLIF(BTRIM(p_reason),'')));
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_provider(uuid,public.provider_status,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_provider(uuid,public.provider_status,text) TO authenticated;

DO $$
DECLARE v_provider_id uuid; v_previous public.provider_status;
BEGIN
  FOR v_provider_id,v_previous IN
    SELECT id,status FROM public.providers
    WHERE type='INSTRUCTOR'::public.provider_type
      AND status IN ('DRAFT'::public.provider_status,'PENDING_REVIEW'::public.provider_status)
  LOOP
    IF public.is_provider_activation_eligible(v_provider_id) THEN
      UPDATE public.providers SET status='ACTIVE'::public.provider_status,
        approved_at=COALESCE(approved_at,NOW()),updated_at=NOW()
      WHERE id=v_provider_id;
      INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,previous_value,new_value,created_at)
      VALUES(NULL,'PROVIDER_RECONCILIATION_ACTIVATED','Provider',v_provider_id::text,
        jsonb_build_object('status',v_previous),jsonb_build_object('status','ACTIVE'),NOW());
    END IF;
  END LOOP;
END;
$$;

COMMIT;
