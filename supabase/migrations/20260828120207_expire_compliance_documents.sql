-- Keep compliance document status synchronized with expires_at.
-- A document that was approved but reached its expiration date must be
-- visible as EXPIRED in every app and must be eligible for resubmission.

BEGIN;

ALTER TABLE public.compliance_documents
  DROP CONSTRAINT IF EXISTS compliance_documents_canonical_status_check;

ALTER TABLE public.compliance_documents
  ADD CONSTRAINT compliance_documents_canonical_status_check
  CHECK (status::text IN ('PENDING', 'IN_REVIEW', 'REJECTED', 'APPROVED', 'EXPIRED'));

CREATE OR REPLACE FUNCTION public.refresh_expired_compliance_documents()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  UPDATE public.compliance_documents
  SET status = 'EXPIRED'::public.compliance_status,
      updated_at = NOW()
  WHERE status = 'APPROVED'::public.compliance_status
    AND expires_at IS NOT NULL
    AND expires_at <= NOW();

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  RETURN v_expired_count;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_expired_compliance_documents() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_expired_compliance_documents() TO authenticated, service_role;

-- Make the current data consistent as soon as this migration is applied.
UPDATE public.compliance_documents
SET status = 'EXPIRED'::public.compliance_status,
    updated_at = NOW()
WHERE status = 'APPROVED'::public.compliance_status
  AND expires_at IS NOT NULL
  AND expires_at <= NOW();

COMMIT;
