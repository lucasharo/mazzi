-- ============================================================================
-- MAZZI PLATFORM — MIGRATION 53: RLS-Safe Legacy Booking Category Recovery
-- File: supabase/migrations/20260818000053_secure_booking_category_fallback.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_my_booking_categories(p_booking_ids UUID[])
RETURNS TABLE (
  booking_id UUID,
  offering_id UUID,
  category TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    b.id AS booking_id,
    b.offering_id,
    so.category::TEXT
  FROM public.bookings b
  JOIN public.service_offerings so ON so.id = b.offering_id
  WHERE p_booking_ids IS NOT NULL
    AND cardinality(p_booking_ids) > 0
    AND b.id = ANY(p_booking_ids)
    AND auth.uid() IS NOT NULL
    AND public.is_booking_participant(b.id);
$$;

-- Permissions & Grants
REVOKE ALL ON FUNCTION public.get_my_booking_categories(UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_booking_categories(UUID[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_booking_categories(UUID[]) TO authenticated, service_role;
