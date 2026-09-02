-- Make the expected responder explicit in the dispute status.
-- The request text remains in information_request; no separate recipient column is needed.

ALTER TABLE public.booking_disputes DROP CONSTRAINT IF EXISTS booking_disputes_status_check;

UPDATE public.booking_disputes
SET status = CASE
  WHEN information_requested_from = 'PROVIDER' THEN 'AWAITING_PROVIDER_RESPONSE'
  WHEN information_requested_from = 'STUDENT' THEN 'AWAITING_STUDENT_RESPONSE'
  WHEN opened_by_role = 'STUDENT' THEN 'AWAITING_PROVIDER_RESPONSE'
  ELSE 'AWAITING_STUDENT_RESPONSE'
END
WHERE status = 'AWAITING_RESPONSE';

ALTER TABLE public.booking_disputes
  ADD CONSTRAINT booking_disputes_status_check CHECK (status IN (
    'OPEN', 'AWAITING_STUDENT_RESPONSE', 'AWAITING_PROVIDER_RESPONSE',
    'UNDER_REVIEW', 'RESOLVED', 'CANCELLED'
  ));

DROP INDEX IF EXISTS public.booking_disputes_one_active_per_booking;
CREATE UNIQUE INDEX booking_disputes_one_active_per_booking
  ON public.booking_disputes (booking_id)
  WHERE status IN ('OPEN', 'AWAITING_STUDENT_RESPONSE', 'AWAITING_PROVIDER_RESPONSE', 'UNDER_REVIEW');

ALTER TABLE public.booking_disputes DROP COLUMN IF EXISTS information_requested_from;

CREATE OR REPLACE FUNCTION public.open_booking_dispute(p_booking_id UUID, p_reason_code VARCHAR, p_description TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid(); v_booking public.bookings%ROWTYPE; v_provider_user UUID;
  v_role VARCHAR(20); v_deadline TIMESTAMPTZ; v_dispute public.booking_disputes%ROWTYPE;
  v_payout public.payouts%ROWTYPE; v_status VARCHAR(30);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000'; END IF;
  SELECT b.* INTO v_booking FROM public.bookings b WHERE b.id=p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  SELECT pr.user_id INTO v_provider_user FROM public.providers pr WHERE pr.id=v_booking.provider_id;
  IF v_booking.student_id=v_uid THEN v_role:='STUDENT'; ELSIF v_provider_user=v_uid THEN v_role:='PROVIDER'; ELSE RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF v_booking.status <> 'COMPLETED' THEN RAISE EXCEPTION 'BOOKING_NOT_COMPLETED' USING ERRCODE='22000'; END IF;
  v_deadline := COALESCE(v_booking.completed_at,v_booking.lesson_finished_at,v_booking.updated_at)+make_interval(hours=>public.get_payout_safety_period_hours());
  IF clock_timestamp()>v_deadline THEN RAISE EXCEPTION 'DISPUTE_WINDOW_EXPIRED' USING ERRCODE='22000'; END IF;
  IF upper(btrim(COALESCE(p_reason_code,''))) NOT IN ('PROVIDER_NO_SHOW','STUDENT_NO_SHOW','LESSON_NOT_DELIVERED','TIME_MISMATCH','MEETING_POINT_MISMATCH','SERVICE_MISMATCH','SAFETY_CONCERN','OTHER') THEN RAISE EXCEPTION 'INVALID_DISPUTE_REASON' USING ERRCODE='22023'; END IF;
  v_status := CASE WHEN v_role='STUDENT' THEN 'AWAITING_PROVIDER_RESPONSE' ELSE 'AWAITING_STUDENT_RESPONSE' END;
  INSERT INTO public.booking_disputes(booking_id,opened_by,opened_by_role,reason_code,description,status)
  VALUES(p_booking_id,v_uid,v_role,upper(btrim(p_reason_code)),btrim(p_description),v_status) RETURNING * INTO v_dispute;
  SELECT * INTO v_payout FROM public.payouts WHERE booking_id=p_booking_id FOR UPDATE;
  IF FOUND AND v_payout.status IN ('PENDING','AVAILABLE','FAILED') THEN UPDATE public.payouts SET status='BLOCKED',failure_reason='DISPUTE_OPEN',updated_at=NOW() WHERE id=v_payout.id; END IF;
  UPDATE public.bookings SET status='DISPUTED',updated_at=NOW() WHERE id=p_booking_id;
  RETURN to_jsonb(v_dispute);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'ACTIVE_DISPUTE_ALREADY_EXISTS' USING ERRCODE='23505';
END; $$;
REVOKE ALL ON FUNCTION public.open_booking_dispute(UUID,VARCHAR,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_booking_dispute(UUID,VARCHAR,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_booking_dispute_information(p_dispute_id UUID, p_requested_from TEXT, p_request TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
DECLARE v_dispute public.booking_disputes%ROWTYPE; v_hours INTEGER; v_status VARCHAR(40);
BEGIN
  IF NOT public.current_user_has_permission('admin.finance.read_all'::public.app_permission) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF upper(p_requested_from) NOT IN ('STUDENT','PROVIDER') OR length(btrim(p_request))<5 THEN RAISE EXCEPTION 'INVALID_INFORMATION_REQUEST' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_dispute FROM public.booking_disputes WHERE id=p_dispute_id FOR UPDATE;
  IF NOT FOUND OR v_dispute.status IN ('RESOLVED','CANCELLED') THEN RAISE EXCEPTION 'DISPUTE_NOT_ACTIVE' USING ERRCODE='22000'; END IF;
  SELECT COALESCE((value->>'contestation_response_hours')::INTEGER,72) INTO v_hours FROM public.platform_configurations WHERE key='platform_operations';
  v_status := CASE WHEN upper(p_requested_from)='STUDENT' THEN 'AWAITING_STUDENT_RESPONSE' ELSE 'AWAITING_PROVIDER_RESPONSE' END;
  UPDATE public.booking_disputes SET status=v_status,information_request=btrim(p_request),response_by=NULL,response_text=NULL,responded_at=NULL,response_due_at=NOW()+make_interval(hours=>v_hours),updated_at=NOW() WHERE id=p_dispute_id RETURNING * INTO v_dispute;
  RETURN to_jsonb(v_dispute);
END; $$;
REVOKE ALL ON FUNCTION public.request_booking_dispute_information(UUID,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_booking_dispute_information(UUID,TEXT,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_booking_dispute(p_dispute_id UUID, p_response_text TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
DECLARE v_uid UUID:=auth.uid(); v_dispute public.booking_disputes%ROWTYPE; v_booking public.bookings%ROWTYPE; v_provider_user UUID; v_allowed BOOLEAN:=false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000'; END IF;
  SELECT * INTO v_dispute FROM public.booking_disputes WHERE id=p_dispute_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DISPUTE_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id=v_dispute.booking_id;
  SELECT user_id INTO v_provider_user FROM public.providers WHERE id=v_booking.provider_id;
  IF v_dispute.status='AWAITING_STUDENT_RESPONSE' THEN v_allowed:=v_uid=v_booking.student_id;
  ELSIF v_dispute.status='AWAITING_PROVIDER_RESPONSE' THEN v_allowed:=v_uid=v_provider_user;
  ELSE v_allowed:=v_dispute.status='OPEN' AND v_uid<>v_dispute.opened_by AND v_uid IN (v_booking.student_id,v_provider_user); END IF;
  IF NOT v_allowed THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF v_dispute.status NOT IN ('OPEN','AWAITING_STUDENT_RESPONSE','AWAITING_PROVIDER_RESPONSE') THEN RAISE EXCEPTION 'DISPUTE_NOT_AWAITING_RESPONSE' USING ERRCODE='22000'; END IF;
  IF NOW()>v_dispute.response_due_at THEN RAISE EXCEPTION 'DISPUTE_RESPONSE_DEADLINE_EXPIRED' USING ERRCODE='22000'; END IF;
  UPDATE public.booking_disputes SET response_by=v_uid,response_text=btrim(p_response_text),responded_at=NOW(),status='UNDER_REVIEW',information_request=NULL,updated_at=NOW() WHERE id=p_dispute_id RETURNING * INTO v_dispute;
  RETURN to_jsonb(v_dispute);
END; $$;
REVOKE ALL ON FUNCTION public.respond_booking_dispute(UUID,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_booking_dispute(UUID,TEXT) TO authenticated;

-- Keep evidence upload available while the dispute is waiting for either party.
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
  SELECT * INTO v_object FROM storage.objects WHERE bucket_id='booking-dispute-evidence' AND name=p_storage_path AND owner_id=v_uid::TEXT;
  IF NOT FOUND THEN RAISE EXCEPTION 'EVIDENCE_OBJECT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  INSERT INTO public.booking_dispute_evidence(dispute_id,uploaded_by,storage_path,evidence_type,metadata) VALUES(p_dispute_id,v_uid,p_storage_path,CASE WHEN COALESCE(v_object.metadata->>'mimetype','') LIKE 'image/%' THEN 'IMAGE' ELSE 'DOCUMENT' END,jsonb_build_object('original_name',btrim(p_original_name),'mime_type',COALESCE(v_object.metadata->>'mimetype','application/octet-stream'),'size',COALESCE((v_object.metadata->>'size')::BIGINT,0))) RETURNING * INTO v_evidence;
  RETURN to_jsonb(v_evidence);
END; $$;
REVOKE ALL ON FUNCTION public.register_booking_dispute_evidence(UUID,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_booking_dispute_evidence(UUID,TEXT,TEXT) TO authenticated;

DROP POLICY IF EXISTS booking_dispute_evidence_upload ON storage.objects;
CREATE POLICY booking_dispute_evidence_upload ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id='booking-dispute-evidence'
  AND owner_id=(SELECT auth.uid())::TEXT
  AND name ~ '^disputes/[0-9a-f-]+/[0-9a-f-]+/[^/]+$'
  AND (storage.foldername(name))[1]='disputes'
  AND (storage.foldername(name))[3]=(SELECT auth.uid())::TEXT
  AND EXISTS (
    SELECT 1 FROM public.booking_disputes d
    JOIN public.bookings b ON b.id=d.booking_id
    JOIN public.providers p ON p.id=b.provider_id
    WHERE d.id=((storage.foldername(name))[2])::UUID
      AND d.status IN ('OPEN','AWAITING_STUDENT_RESPONSE','AWAITING_PROVIDER_RESPONSE','UNDER_REVIEW')
      AND (b.student_id=(SELECT auth.uid()) OR p.user_id=(SELECT auth.uid()))
  )
);
