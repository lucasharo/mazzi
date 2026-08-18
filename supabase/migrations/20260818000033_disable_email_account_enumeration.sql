-- ============================================================================
-- MAZZI MIGRATION 20260818000033
-- Disable Email Account Enumeration (Security Hardening)
-- ============================================================================

-- 1. Drop public.check_user_email_exists function to prevent account enumeration
DROP FUNCTION IF EXISTS public.check_user_email_exists(TEXT);

-- 2. Reconcile schema_migrations ledger for migration 20260818000033
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '20260818000033',
  'disable_email_account_enumeration',
  ARRAY[
    'DROP FUNCTION IF EXISTS public.check_user_email_exists(TEXT);'
  ]
)
ON CONFLICT (version) DO NOTHING;
