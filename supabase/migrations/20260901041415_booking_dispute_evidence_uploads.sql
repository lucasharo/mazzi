-- Private evidence uploads for operational booking disputes.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'booking-dispute-evidence',
  'booking-dispute-evidence',
  FALSE,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- This migration is ordered before the later payout/dispute consolidation
-- migration. Keep the historical replay self-contained so its dependent
-- index, policies and functions never reference tables that do not exist yet.
-- The later migration uses IF NOT EXISTS and remains idempotent.
CREATE TABLE IF NOT EXISTS public.booking_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
  opened_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  opened_by_role VARCHAR(20) NOT NULL CHECK (opened_by_role IN ('STUDENT', 'PROVIDER')),
  reason_code VARCHAR(60) NOT NULL CHECK (reason_code IN (
    'PROVIDER_NO_SHOW', 'STUDENT_NO_SHOW', 'LESSON_NOT_DELIVERED',
    'TIME_MISMATCH', 'MEETING_POINT_MISMATCH', 'SERVICE_MISMATCH',
    'SAFETY_CONCERN', 'OTHER'
  )),
  description TEXT NOT NULL CHECK (length(btrim(description)) BETWEEN 10 AND 4000),
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (status IN (
    'OPEN', 'AWAITING_RESPONSE', 'UNDER_REVIEW', 'RESOLVED', 'CANCELLED'
  )),
  response_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  response_text TEXT CHECK (response_text IS NULL OR length(btrim(response_text)) BETWEEN 10 AND 4000),
  responded_at TIMESTAMPTZ,
  resolution_code VARCHAR(40) CHECK (resolution_code IS NULL OR resolution_code IN (
    'NO_ACTION', 'FULL_REFUND', 'PARTIAL_REFUND', 'RELEASE_PAYOUT', 'RESCHEDULE'
  )),
  resolution_notes TEXT,
  refund_amount_in_cents INTEGER CHECK (refund_amount_in_cents IS NULL OR refund_amount_in_cents >= 0),
  resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  response_due_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.booking_dispute_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES public.booking_disputes(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  storage_path TEXT NOT NULL CHECK (length(btrim(storage_path)) > 0),
  evidence_type VARCHAR(30) NOT NULL DEFAULT 'DOCUMENT' CHECK (evidence_type IN ('IMAGE', 'DOCUMENT', 'LOCATION', 'OTHER')),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS booking_dispute_evidence_storage_path_key
  ON public.booking_dispute_evidence (storage_path);

DROP POLICY IF EXISTS booking_dispute_evidence_upload ON storage.objects;
CREATE POLICY booking_dispute_evidence_upload ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'booking-dispute-evidence'
  AND owner_id = (SELECT auth.uid())::TEXT
  AND name ~ '^disputes/[0-9a-f-]+/[0-9a-f-]+/[^/]+$'
  AND (storage.foldername(name))[1] = 'disputes'
  AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND (storage.foldername(name))[3] = (SELECT auth.uid())::TEXT
  AND EXISTS (
    SELECT 1
    FROM public.booking_disputes d
    JOIN public.bookings b ON b.id = d.booking_id
    JOIN public.providers p ON p.id = b.provider_id
    WHERE d.id = ((storage.foldername(name))[2])::UUID
      AND d.status IN ('OPEN', 'AWAITING_RESPONSE', 'UNDER_REVIEW')
      AND (b.student_id = (SELECT auth.uid()) OR p.user_id = (SELECT auth.uid()))
  )
);

DROP POLICY IF EXISTS booking_dispute_evidence_read ON storage.objects;
CREATE POLICY booking_dispute_evidence_read ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'booking-dispute-evidence'
  AND (storage.foldername(name))[1] = 'disputes'
  AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.booking_disputes d
    JOIN public.bookings b ON b.id = d.booking_id
    JOIN public.providers p ON p.id = b.provider_id
    WHERE d.id = ((storage.foldername(name))[2])::UUID
      AND (
        b.student_id = (SELECT auth.uid())
        OR p.user_id = (SELECT auth.uid())
        OR public.current_user_has_permission('admin.finance.read_all'::public.app_permission)
      )
  )
);

DROP POLICY IF EXISTS booking_dispute_evidence_orphan_delete ON storage.objects;
CREATE POLICY booking_dispute_evidence_orphan_delete ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'booking-dispute-evidence'
  AND owner_id = (SELECT auth.uid())::TEXT
  AND NOT EXISTS (
    SELECT 1 FROM public.booking_dispute_evidence e WHERE e.storage_path = name
  )
);

CREATE OR REPLACE FUNCTION public.register_booking_dispute_evidence(
  p_dispute_id UUID,
  p_storage_path TEXT,
  p_original_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, storage, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_object storage.objects%ROWTYPE;
  v_evidence public.booking_dispute_evidence%ROWTYPE;
  v_count INTEGER;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000'; END IF;
  IF p_original_name IS NULL OR length(btrim(p_original_name)) NOT BETWEEN 1 AND 255 THEN
    RAISE EXCEPTION 'INVALID_FILE_NAME' USING ERRCODE='22023';
  END IF;
  IF p_storage_path NOT LIKE 'disputes/' || p_dispute_id::TEXT || '/' || v_uid::TEXT || '/%' THEN
    RAISE EXCEPTION 'INVALID_STORAGE_PATH' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.booking_disputes d
    JOIN public.bookings b ON b.id=d.booking_id
    JOIN public.providers p ON p.id=b.provider_id
    WHERE d.id=p_dispute_id
      AND d.status IN ('OPEN','AWAITING_RESPONSE','UNDER_REVIEW')
      AND (b.student_id=v_uid OR p.user_id=v_uid)
  ) THEN RAISE EXCEPTION 'DISPUTE_EVIDENCE_FORBIDDEN' USING ERRCODE='42501'; END IF;

  SELECT * INTO v_object FROM storage.objects
  WHERE bucket_id='booking-dispute-evidence' AND name=p_storage_path AND owner_id=v_uid::TEXT;
  IF NOT FOUND THEN RAISE EXCEPTION 'EVIDENCE_OBJECT_NOT_FOUND' USING ERRCODE='P0002'; END IF;

  SELECT count(*) INTO v_count FROM public.booking_dispute_evidence
  WHERE dispute_id=p_dispute_id AND uploaded_by=v_uid;
  IF v_count >= 10 THEN RAISE EXCEPTION 'EVIDENCE_LIMIT_REACHED' USING ERRCODE='22023'; END IF;

  INSERT INTO public.booking_dispute_evidence(dispute_id,uploaded_by,storage_path,evidence_type,metadata)
  VALUES (
    p_dispute_id,
    v_uid,
    p_storage_path,
    CASE WHEN COALESCE(v_object.metadata->>'mimetype','') LIKE 'image/%' THEN 'IMAGE' ELSE 'DOCUMENT' END,
    jsonb_build_object(
      'original_name', btrim(p_original_name),
      'mime_type', COALESCE(v_object.metadata->>'mimetype','application/octet-stream'),
      'size', COALESCE((v_object.metadata->>'size')::BIGINT,0)
    )
  )
  RETURNING * INTO v_evidence;
  RETURN to_jsonb(v_evidence);
END;
$$;
REVOKE ALL ON FUNCTION public.register_booking_dispute_evidence(UUID,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_booking_dispute_evidence(UUID,TEXT,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_booking_dispute_evidence(p_dispute_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO public, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.created_at),'[]'::JSONB)
  FROM public.booking_dispute_evidence e
  WHERE e.dispute_id=p_dispute_id;
$$;
REVOKE ALL ON FUNCTION public.get_booking_dispute_evidence(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_booking_dispute_evidence(UUID) TO authenticated;
GRANT SELECT ON public.booking_dispute_evidence TO authenticated;
