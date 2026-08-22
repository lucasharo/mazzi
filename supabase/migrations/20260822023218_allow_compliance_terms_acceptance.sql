-- Allow a provider to record acceptance of the MAZZI terms without uploading a file.
-- Ordinary compliance files remain restricted to PENDING on provider insert.

DROP POLICY IF EXISTS "Providers can insert own compliance documents" ON public.compliance_documents;

CREATE POLICY "Providers can insert own compliance documents"
ON public.compliance_documents
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_current_user_active()
  AND (public.is_provider_owner(provider_id) OR user_id = auth.uid())
  AND (
    status = 'PENDING'::public.compliance_status
    OR (
      document_type = 'MAZZI_TERMS_ACCEPTANCE'::public.compliance_doc_type
      AND status = 'APPROVED'::public.compliance_status
      AND storage_path LIKE 'acceptance://mazzi-ethics/%'
    )
  )
);
