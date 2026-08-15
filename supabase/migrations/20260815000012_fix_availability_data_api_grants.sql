-- ============================================================================
-- MAZZI PLATFORM - FIX AVAILABILITY DATA API GRANTS
-- ============================================================================
--
-- Purpose:
--   Expose scheduling tables to Supabase Data API roles.
--
-- Context:
--   The tables already have RLS enabled and ownership policies defined, but the
--   Data API returned 403 because only the postgres role had table grants.
--   Grants are required before RLS policies can be evaluated by PostgREST.
--
-- Security:
--   RLS remains the authorization boundary. These grants only make the tables
--   reachable by the API roles.

grant select on public.availabilities to anon, authenticated, service_role;
grant insert, update, delete on public.availabilities to authenticated, service_role;

grant select, insert, update, delete on public.availability_exceptions to authenticated, service_role;
