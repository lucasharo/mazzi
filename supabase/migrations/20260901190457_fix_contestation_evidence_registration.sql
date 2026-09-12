CREATE OR REPLACE FUNCTION public.register_booking_dispute_evidence(p_dispute_id UUID,p_storage_path TEXT,p_original_name TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, storage, pg_temp AS $$
DECLARE v_uid UUID:=auth.uid(); v_object storage.objects%ROWTYPE; v_evidence public.booking_dispute_evidence%ROWTYPE; v_dispute public.booking_disputes%ROWTYPE; v_count INTEGER;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000'; END IF;
  IF p_original_name IS NULL OR length(btrim(p_original_name)) NOT BETWEEN 1 AND 255 THEN RAISE EXCEPTION 'INVALID_FILE_NAME' USING ERRCODE='22023'; END IF;
  IF p_storage_path NOT LIKE 'disputes/'||p_dispute_id::TEXT||'/'||v_uid::TEXT||'/%' THEN RAISE EXCEPTION 'INVALID_STORAGE_PATH' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_dispute FROM public.booking_disputes WHERE id=p_dispute_id;
  IF NOT FOUND OR v_dispute.status NOT IN ('OPEN','AWAITING_STUDENT_RESPONSE','AWAITING_PROVIDER_RESPONSE','UNDER_REVIEW') THEN RAISE EXCEPTION 'DISPUTE_EVIDENCE_FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF v_dispute.status='AWAITING_STUDENT_RESPONSE' AND NOT EXISTS(SELECT 1 FROM public.bookings b WHERE b.id=v_dispute.booking_id AND b.student_id=v_uid) THEN RAISE EXCEPTION 'DISPUTE_EVIDENCE_NOT_YOUR_TURN' USING ERRCODE='42501'; END IF;
  IF v_dispute.status='AWAITING_PROVIDER_RESPONSE' AND NOT EXISTS(SELECT 1 FROM public.bookings b JOIN public.providers p ON p.id=b.provider_id WHERE b.id=v_dispute.booking_id AND p.user_id=v_uid) THEN RAISE EXCEPTION 'DISPUTE_EVIDENCE_NOT_YOUR_TURN' USING ERRCODE='42501'; END IF;
  SELECT count(*) INTO v_count FROM public.booking_dispute_evidence WHERE dispute_id=p_dispute_id AND uploaded_by=v_uid;
  IF v_count>=10 THEN RAISE EXCEPTION 'EVIDENCE_LIMIT_REACHED' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_object FROM storage.objects WHERE bucket_id='booking-dispute-evidence' AND name=p_storage_path;
  IF NOT FOUND THEN RAISE EXCEPTION 'EVIDENCE_OBJECT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  INSERT INTO public.booking_dispute_evidence(dispute_id,uploaded_by,storage_path,evidence_type,metadata) VALUES(p_dispute_id,v_uid,p_storage_path,CASE WHEN COALESCE(v_object.metadata->>'mimetype','') LIKE 'image/%' THEN 'IMAGE' ELSE 'DOCUMENT' END,jsonb_build_object('original_name',btrim(p_original_name),'mime_type',COALESCE(v_object.metadata->>'mimetype','application/octet-stream'),'size',COALESCE((v_object.metadata->>'size')::BIGINT,0))) RETURNING * INTO v_evidence;
  RETURN to_jsonb(v_evidence);
END; $$;
REVOKE ALL ON FUNCTION public.register_booking_dispute_evidence(UUID,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_booking_dispute_evidence(UUID,TEXT,TEXT) TO authenticated;
