-- A school owner is an administrator even when there is no staff row.
-- This keeps management RPCs usable during the school's onboarding lifecycle.
CREATE OR REPLACE FUNCTION public.is_school_admin(target_school_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.providers p
    JOIN public.users u ON u.id = p.user_id
    WHERE p.id = target_school_id
      AND p.type = 'DRIVING_SCHOOL'
      AND p.user_id = auth.uid()
      AND u.status = 'ACTIVE'
  )
  OR EXISTS (
    SELECT 1
    FROM public.driving_school_staff
    WHERE school_id = target_school_id
      AND user_id = auth.uid()
      AND role = 'SCHOOL_ADMIN'
      AND is_active = TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.is_school_admin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_school_admin(UUID) TO authenticated;
