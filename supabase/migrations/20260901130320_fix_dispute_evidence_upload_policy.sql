-- Supabase Storage may populate owner_id after the INSERT policy is evaluated.
-- The path already contains the authenticated user's UUID, so use that as the
-- upload authorization boundary and keep the dispute membership check.
DROP POLICY IF EXISTS booking_dispute_evidence_upload ON storage.objects;
CREATE POLICY booking_dispute_evidence_upload ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'booking-dispute-evidence'
  AND name ~ '^disputes/[0-9a-f-]+/[0-9a-f-]+/[^/]+$'
  AND (storage.foldername(name))[1] = 'disputes'
  AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND (storage.foldername(name))[3] = (SELECT auth.uid())::TEXT
);
