-- ============================================================================
-- MAZZI PLATFORM — USER EMAIL EXISTENCE CHECK (SECURITY DEFINER RPC)
-- Migration: 20260817000030_check_user_email_exists.sql
-- Description: Creates a safe RPC function to check if an email exists in public.users
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_user_email_exists(email_to_check TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF email_to_check IS NULL OR trim(email_to_check) = '' THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.users
    WHERE lower(email) = lower(trim(email_to_check))
      AND deleted_at IS NULL
  );
END;
$$;

-- Allow anon and authenticated users to call this RPC
GRANT EXECUTE ON FUNCTION public.check_user_email_exists(TEXT) TO anon, authenticated, service_role;
