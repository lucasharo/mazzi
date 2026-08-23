-- TASK-085: canonicalize bookings and quotes read authorization.
-- Historical policies are removed only here; historical migrations remain unchanged.

BEGIN;

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- Remove the legacy/publicly-scoped policies and their application-role JWT checks.
DROP POLICY IF EXISTS "Parties can read own bookings" ON public.bookings;
DROP POLICY IF EXISTS bookings_provider_select ON public.bookings;
DROP POLICY IF EXISTS bookings_student_select ON public.bookings;
DROP POLICY IF EXISTS quotes_provider_select ON public.quotes;
DROP POLICY IF EXISTS quotes_student_select ON public.quotes;
DROP POLICY IF EXISTS quotes_student_insert ON public.quotes;

-- Public search, slot, and booking-context contracts use dedicated RPCs.
REVOKE SELECT ON TABLE public.bookings FROM anon;

-- Quotes are created transactionally by create_quote_from_offering().
REVOKE INSERT ON TABLE public.quotes FROM authenticated;

CREATE POLICY bookings_authenticated_select
ON public.bookings
FOR SELECT
TO authenticated
USING (
  (select public.is_current_user_active())
  AND (
    student_id = (select auth.uid())
    OR instructor_id = (select auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.providers p
      WHERE p.id = bookings.provider_id
        AND p.user_id = (select auth.uid())
    )
    OR (select public.is_platform_admin())
  )
);

CREATE POLICY quotes_authenticated_select
ON public.quotes
FOR SELECT
TO authenticated
USING (
  (select public.is_current_user_active())
  AND (
    student_id = (select auth.uid())
    OR instructor_id = (select auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.providers p
      WHERE p.id = quotes.provider_id
        AND p.user_id = (select auth.uid())
    )
    OR (select public.is_platform_admin())
  )
);

COMMIT;
