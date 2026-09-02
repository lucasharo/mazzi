-- Each participant can access only the evidence they uploaded.
-- Platform finance admins retain access for dispute resolution.

DROP POLICY IF EXISTS booking_dispute_evidence_read ON storage.objects;
CREATE POLICY booking_dispute_evidence_read ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'booking-dispute-evidence'
  AND (storage.foldername(name))[1] = 'disputes'
  AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND (
    (storage.foldername(name))[3] = (SELECT auth.uid())::TEXT
    OR public.current_user_has_permission('admin.finance.read_all'::public.app_permission)
  )
);

CREATE OR REPLACE FUNCTION public.get_booking_dispute_evidence(p_dispute_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO public, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.created_at),'[]'::JSONB)
  FROM public.booking_dispute_evidence e
  WHERE e.dispute_id = p_dispute_id
    AND (
      e.uploaded_by = auth.uid()
      OR public.current_user_has_permission('admin.finance.read_all'::public.app_permission)
    );
$$;

REVOKE ALL ON FUNCTION public.get_booking_dispute_evidence(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_booking_dispute_evidence(UUID) TO authenticated;

-- The opener may upload during the initial submission only. Further uploads
-- belong to the participant whose turn it is to respond.
CREATE OR REPLACE FUNCTION public.register_booking_dispute_evidence(
  p_dispute_id UUID, p_storage_path TEXT, p_original_name TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, storage, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_object storage.objects%ROWTYPE;
  v_evidence public.booking_dispute_evidence%ROWTYPE;
  v_dispute public.booking_disputes%ROWTYPE;
  v_count INTEGER;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000'; END IF;
  IF p_original_name IS NULL OR length(btrim(p_original_name)) NOT BETWEEN 1 AND 255 THEN RAISE EXCEPTION 'INVALID_FILE_NAME' USING ERRCODE='22023'; END IF;
  IF p_storage_path NOT LIKE 'disputes/' || p_dispute_id::TEXT || '/' || v_uid::TEXT || '/%' THEN RAISE EXCEPTION 'INVALID_STORAGE_PATH' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_dispute FROM public.booking_disputes WHERE id=p_dispute_id;
  IF NOT FOUND OR v_dispute.status NOT IN ('OPEN','AWAITING_RESPONSE','UNDER_REVIEW') THEN RAISE EXCEPTION 'DISPUTE_EVIDENCE_FORBIDDEN' USING ERRCODE='42501'; END IF;
  SELECT count(*) INTO v_count FROM public.booking_dispute_evidence WHERE dispute_id=p_dispute_id AND uploaded_by=v_uid;
  IF v_uid = v_dispute.opened_by AND v_count > 0 THEN RAISE EXCEPTION 'DISPUTE_EVIDENCE_NOT_YOUR_TURN' USING ERRCODE='42501'; END IF;
  IF v_uid <> v_dispute.opened_by AND v_dispute.status NOT IN ('OPEN','AWAITING_RESPONSE') THEN RAISE EXCEPTION 'DISPUTE_EVIDENCE_NOT_YOUR_TURN' USING ERRCODE='42501'; END IF;
  IF v_count >= 10 THEN RAISE EXCEPTION 'EVIDENCE_LIMIT_REACHED' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_object FROM storage.objects WHERE bucket_id='booking-dispute-evidence' AND name=p_storage_path AND owner_id=v_uid::TEXT;
  IF NOT FOUND THEN RAISE EXCEPTION 'EVIDENCE_OBJECT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  INSERT INTO public.booking_dispute_evidence(dispute_id,uploaded_by,storage_path,evidence_type,metadata)
  VALUES (p_dispute_id,v_uid,p_storage_path,CASE WHEN COALESCE(v_object.metadata->>'mimetype','') LIKE 'image/%' THEN 'IMAGE' ELSE 'DOCUMENT' END,
    jsonb_build_object('original_name',btrim(p_original_name),'mime_type',COALESCE(v_object.metadata->>'mimetype','application/octet-stream'),'size',COALESCE((v_object.metadata->>'size')::BIGINT,0)))
  RETURNING * INTO v_evidence;
  RETURN to_jsonb(v_evidence);
END; $$;
REVOKE ALL ON FUNCTION public.register_booking_dispute_evidence(UUID,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_booking_dispute_evidence(UUID,TEXT,TEXT) TO authenticated;
