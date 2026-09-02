-- Storage may create the object before owner_id is materialized. The authenticated
-- user is already bound to folder 3 and the dispute/booking participant check.
DROP POLICY IF EXISTS booking_dispute_evidence_upload ON storage.objects;
CREATE POLICY booking_dispute_evidence_upload ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id='booking-dispute-evidence'
  AND auth.uid() IS NOT NULL
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
