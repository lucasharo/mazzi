-- Keep the Storage policy intentionally narrow and let the SECURITY DEFINER RPC
-- perform the participant/turn validation against the booking tables.
DROP POLICY IF EXISTS booking_dispute_evidence_upload ON storage.objects;
CREATE POLICY booking_dispute_evidence_upload ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id='booking-dispute-evidence'
  AND auth.uid() IS NOT NULL
  AND name ~ '^disputes/[0-9a-f-]+/[0-9a-f-]+/[^/]+$'
  AND (storage.foldername(name))[1]='disputes'
  AND (storage.foldername(name))[3]=(SELECT auth.uid())::TEXT
);
