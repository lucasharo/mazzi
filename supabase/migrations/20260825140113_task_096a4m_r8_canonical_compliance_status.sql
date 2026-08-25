-- TASK-096A4M-R8: canonicalize compliance document status values.
-- Provider lifecycle status and document validity (expires_at) remain separate.

UPDATE public.compliance_documents
SET status = CASE status::text
  WHEN 'EXPIRED' THEN 'REJECTED'::public.compliance_status
  ELSE status
END
WHERE status::text = 'EXPIRED';

ALTER TABLE public.compliance_documents
  DROP CONSTRAINT IF EXISTS compliance_documents_canonical_status_check;

ALTER TABLE public.compliance_documents
  ADD CONSTRAINT compliance_documents_canonical_status_check
  CHECK (status::text IN ('PENDING', 'IN_REVIEW', 'REJECTED', 'APPROVED'));

DROP POLICY IF EXISTS "Providers can insert own compliance documents" ON public.compliance_documents;
CREATE POLICY "Providers can insert own compliance documents"
ON public.compliance_documents
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_current_user_active()
  AND (public.is_provider_owner(provider_id) OR user_id = auth.uid())
  AND (
    status IN ('PENDING'::public.compliance_status, 'IN_REVIEW'::public.compliance_status)
    OR (
      document_type = 'MAZZI_TERMS_ACCEPTANCE'::public.compliance_doc_type
      AND status = 'APPROVED'::public.compliance_status
      AND storage_path LIKE 'acceptance://mazzi-ethics/%'
    )
  )
);

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
  VALUES (p_provider_id,auth.uid(),NULL,NULL,'PROVIDER',p_document_type,p_storage_path,'IN_REVIEW',p_expires_at)
  RETURNING * INTO v_doc;
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,new_value,severity,created_at)
  VALUES (auth.uid(),'COMPLIANCE_DOCUMENT_SUBMITTED','COMPLIANCE_DOCUMENTS',v_doc.id,
    jsonb_build_object('provider_id',p_provider_id,'document_type',p_document_type::TEXT,'scope','PROVIDER'),'INFO',NOW());
  RETURN v_doc;
END;
$$;
CREATE OR REPLACE FUNCTION public.submit_my_global_compliance_document(
  p_document_type public.compliance_doc_type,
  p_storage_path TEXT,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS public.compliance_documents
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE v_doc public.compliance_documents;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_current_user_active() THEN RAISE EXCEPTION 'USER_NOT_ACTIVE'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'INSTRUCTOR')
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'INSTRUCTOR') THEN
    RAISE EXCEPTION 'INSTRUCTOR_ROLE_REQUIRED';
  END IF;
  INSERT INTO public.compliance_documents (
    provider_id, user_id, vehicle_id, membership_id, scope, document_type,
    storage_path, status, expires_at
  ) VALUES (
    NULL, auth.uid(), NULL, NULL, 'USER_GLOBAL', p_document_type,
    p_storage_path, 'IN_REVIEW', p_expires_at
  ) RETURNING * INTO v_doc;
  RETURN v_doc;
END;
$$;
