-- MAZZI — TASK-096A4M-R6
-- Forward-only provisioning for private provider compliance storage.
-- This migration intentionally does not modify compliance_documents rows.

BEGIN;

-- Keep the bucket private and compatible with the existing upload contract.
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'provider-compliance-docs',
  'provider-compliance-docs',
  FALSE,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = FALSE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Replace the historical names without changing unrelated storage policies.
DROP POLICY IF EXISTS "Providers can upload own compliance documents to storage" ON storage.objects;
DROP POLICY IF EXISTS "Providers and reviewers can read compliance documents from storage" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete compliance documents from storage" ON storage.objects;

DROP POLICY IF EXISTS "R6 compliance storage provider insert" ON storage.objects;
DROP POLICY IF EXISTS "R6 compliance storage owner or reviewer read" ON storage.objects;
DROP POLICY IF EXISTS "R6 compliance storage provider delete" ON storage.objects;
DROP POLICY IF EXISTS "R6 compliance storage reviewer delete" ON storage.objects;

-- The browser can only upload to providers/{owned-provider}/compliance/{doc}/{file}.
-- The provider UUID is validated before it is cast, preventing malformed paths
-- from turning an RLS check into an exception or a cross-tenant lookup.
CREATE POLICY "R6 compliance storage provider insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'provider-compliance-docs'
    AND public.is_current_user_active()
    AND name ~ '^providers/[^/]+/compliance/[^/]+/[^/]+$'
    AND (storage.foldername(name))[1] = 'providers'
    AND (storage.foldername(name))[3] = 'compliance'
    AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND public.is_provider_owner(((storage.foldername(name))[2])::uuid)
  );

-- Providers may read only their own objects. Authorized compliance reviewers
-- may read objects for review. No anon policy is created.
CREATE POLICY "R6 compliance storage owner or reviewer read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'provider-compliance-docs'
    AND public.is_current_user_active()
    AND name ~ '^providers/[^/]+/compliance/[^/]+/[^/]+$'
    AND (
      public.is_compliance_reviewer()
      OR (
        (storage.foldername(name))[1] = 'providers'
        AND (storage.foldername(name))[3] = 'compliance'
        AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        AND public.is_provider_owner(((storage.foldername(name))[2])::uuid)
      )
    )
  );

-- Provider-scoped deletion is limited to the owner so failed DB persistence
-- can clean up its just-uploaded orphan. There is intentionally no UPDATE
-- policy, so objects cannot be broadly overwritten through the client.
CREATE POLICY "R6 compliance storage provider delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'provider-compliance-docs'
    AND public.is_current_user_active()
    AND name ~ '^providers/[^/]+/compliance/[^/]+/[^/]+$'
    AND (storage.foldername(name))[1] = 'providers'
    AND (storage.foldername(name))[3] = 'compliance'
    AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND public.is_provider_owner(((storage.foldername(name))[2])::uuid)
  );

CREATE POLICY "R6 compliance storage reviewer delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'provider-compliance-docs'
    AND public.is_current_user_active()
    AND name ~ '^providers/[^/]+/compliance/[^/]+/[^/]+$'
    AND public.is_compliance_reviewer()
  );

COMMIT;
