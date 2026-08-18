-- ============================================================================
-- MAZZI PLATFORM — STORAGE BUCKET FOR USER AVATARS
-- Sprint 17: Provision public-read storage bucket for user profile photos
-- with secure RLS policies scoped to authenticated user ID.
-- ============================================================================

-- 1. Create or update the 'avatars' storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  TRUE, -- Public read for avatars
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 2. Storage Upload (INSERT) Policy
-- Users can only upload avatars into their own folder: avatars/{user_id}/*
DROP POLICY IF EXISTS "Users can upload own avatar to storage" ON storage.objects;
CREATE POLICY "Users can upload own avatar to storage" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. Storage Read (SELECT) Policy
-- Anyone can view avatars from the public bucket
DROP POLICY IF EXISTS "Public can read avatars from storage" ON storage.objects;
CREATE POLICY "Public can read avatars from storage" ON storage.objects
  FOR SELECT TO public
  USING (
    bucket_id = 'avatars'
  );

-- 4. Storage Update (UPDATE) Policy
DROP POLICY IF EXISTS "Users can update own avatar in storage" ON storage.objects;
CREATE POLICY "Users can update own avatar in storage" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 5. Storage Delete (DELETE) Policy
DROP POLICY IF EXISTS "Users can delete own avatar from storage" ON storage.objects;
CREATE POLICY "Users can delete own avatar from storage" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
