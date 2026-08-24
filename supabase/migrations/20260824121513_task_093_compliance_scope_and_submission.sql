-- TASK-093: enforce compliance scope and authoritative provider submissions.

CREATE OR REPLACE FUNCTION public.provider_submit_compliance_document(
  p_provider_id UUID,
  p_document_type public.compliance_doc_type,
  p_storage_path TEXT,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
) RETURNS public.compliance_documents
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_doc public.compliance_documents;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF NOT public.is_current_user_active() THEN RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE='42501'; END IF;
  IF NOT public.is_provider_owner(p_provider_id) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF p_document_type = 'MAZZI_TERMS_ACCEPTANCE' THEN RAISE EXCEPTION 'USE_TERMS_ACCEPTANCE_RPC' USING ERRCODE='22023'; END IF;
  IF p_storage_path IS NULL OR btrim(p_storage_path) = '' THEN RAISE EXCEPTION 'STORAGE_PATH_REQUIRED' USING ERRCODE='22023'; END IF;
  INSERT INTO public.compliance_documents (provider_id,user_id,vehicle_id,membership_id,scope,document_type,storage_path,status,expires_at)
  VALUES (p_provider_id,auth.uid(),NULL,NULL,'PROVIDER',p_document_type,p_storage_path,'PENDING',p_expires_at)
  RETURNING * INTO v_doc;
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,new_value,severity,created_at)
  VALUES (auth.uid(),'COMPLIANCE_DOCUMENT_SUBMITTED','COMPLIANCE_DOCUMENTS',v_doc.id,
    jsonb_build_object('provider_id',p_provider_id,'document_type',p_document_type::TEXT,'scope','PROVIDER'),'INFO',NOW());
  RETURN v_doc;
END;
$$;

CREATE OR REPLACE FUNCTION public.provider_accept_mazzi_terms(
  p_provider_id UUID,
  p_terms_version TEXT
) RETURNS public.compliance_documents
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_doc public.compliance_documents; v_path TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF NOT public.is_current_user_active() THEN RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE='42501'; END IF;
  IF NOT public.is_provider_owner(p_provider_id) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF p_terms_version IS NULL OR p_terms_version !~ '^[A-Za-z0-9._-]+$' THEN RAISE EXCEPTION 'INVALID_TERMS_VERSION' USING ERRCODE='22023'; END IF;
  v_path := 'acceptance://mazzi-ethics/' || p_terms_version;
  SELECT * INTO v_doc FROM public.compliance_documents
  WHERE provider_id=p_provider_id AND user_id=auth.uid() AND scope='PROVIDER'
    AND document_type='MAZZI_TERMS_ACCEPTANCE' AND storage_path=v_path
  ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN RETURN v_doc; END IF;
  INSERT INTO public.compliance_documents (provider_id,user_id,vehicle_id,membership_id,scope,document_type,storage_path,status)
  VALUES (p_provider_id,auth.uid(),NULL,NULL,'PROVIDER','MAZZI_TERMS_ACCEPTANCE',v_path,'APPROVED')
  RETURNING * INTO v_doc;
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,new_value,severity,created_at)
  VALUES (auth.uid(),'MAZZI_TERMS_ACCEPTED','COMPLIANCE_DOCUMENTS',v_doc.id,
    jsonb_build_object('provider_id',p_provider_id,'document_type','MAZZI_TERMS_ACCEPTANCE','terms_version',p_terms_version,'scope','PROVIDER'),'INFO',NOW());
  RETURN v_doc;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_instructor_global_compliance_valid(
  p_user_id UUID, p_category public.vehicle_category DEFAULT NULL
) RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.providers legacy
    WHERE legacy.type='INSTRUCTOR' AND legacy.user_id=p_user_id AND legacy.status='ACTIVE'
      AND legacy.created_at < TIMESTAMPTZ '2026-08-21 21:30:00+00'
      AND NOT EXISTS (SELECT 1 FROM public.compliance_documents d WHERE d.provider_id=legacy.id)
  ) OR (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id=p_user_id AND u.status='ACTIVE' AND (u.role='INSTRUCTOR' OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=u.id AND ur.role='INSTRUCTOR')))
    AND NOT EXISTS (
      SELECT 1 FROM public.compliance_requirements r
      WHERE r.scope='USER_GLOBAL'::public.compliance_document_scope AND r.is_mandatory IS TRUE
        AND (p_category IS NULL OR r.category IS NULL OR r.category=p_category)
        AND (r.effective_from IS NULL OR r.effective_from<=NOW()) AND (r.effective_to IS NULL OR r.effective_to>=NOW())
        AND r.regulatory_status NOT IN ('SUPERSEDED','INACTIVE')
        AND NOT EXISTS (
          SELECT 1 FROM public.compliance_documents d
          WHERE d.scope='USER_GLOBAL'::public.compliance_document_scope AND d.user_id=p_user_id
            AND d.provider_id IS NULL AND d.membership_id IS NULL AND d.vehicle_id IS NULL
            AND d.document_type::TEXT IN ('CNH_EAR','CREDENTIAL_DETRAN','CREDENTIAL_DETRAN_SP','CRIMINAL_BACKGROUND')
            AND d.status='APPROVED' AND (d.expires_at IS NULL OR d.expires_at>NOW())
            AND (d.document_type::TEXT=r.document_type::TEXT OR (r.document_type::TEXT='CNH_EAR' AND d.document_type::TEXT='CNH') OR (r.document_type::TEXT='CREDENTIAL_DETRAN_SP' AND d.document_type::TEXT='CREDENTIAL_DETRAN'))
        )
    )
  );
$$;

DROP POLICY IF EXISTS "Providers can insert own compliance documents" ON public.compliance_documents;
REVOKE SELECT ON TABLE public.compliance_documents FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.compliance_documents FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, SELECT ON TABLE public.compliance_documents FROM anon;
GRANT SELECT ON TABLE public.compliance_documents TO authenticated;

REVOKE ALL ON FUNCTION public.provider_submit_compliance_document(UUID,public.compliance_doc_type,TEXT,TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.provider_accept_mazzi_terms(UUID,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_submit_compliance_document(UUID,public.compliance_doc_type,TEXT,TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.provider_accept_mazzi_terms(UUID,TEXT) TO authenticated, service_role;
