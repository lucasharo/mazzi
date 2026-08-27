BEGIN;

CREATE OR REPLACE FUNCTION public.review_compliance_document(
  p_document_id uuid,
  p_status public.compliance_status,
  p_rejection_reason text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS public.compliance_documents
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_doc public.compliance_documents;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_compliance_reviewer() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_status NOT IN ('APPROVED', 'REJECTED') THEN RAISE EXCEPTION 'INVALID_REVIEW_STATUS'; END IF;

  UPDATE public.compliance_documents
  SET status=p_status,
      rejection_reason=CASE WHEN p_status='REJECTED' THEN p_rejection_reason ELSE NULL END,
      expires_at=CASE WHEN p_status='APPROVED' THEN p_expires_at ELSE expires_at END,
      reviewed_by=auth.uid(), reviewed_at=NOW(), updated_at=NOW()
  WHERE id=p_document_id RETURNING * INTO v_doc;
  IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_NOT_FOUND'; END IF;
  RETURN v_doc;
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_compliance_document(uuid, public.compliance_status, text, timestamptz) TO authenticated;

COMMIT;
