-- TASK-086: reconcile legacy primary roles with the normalized role set.
-- This migration only adds the primary role that is already recorded on users.

BEGIN;

INSERT INTO public.user_roles (user_id, role, granted_by)
SELECT u.id, u.role, NULL
FROM public.users AS u
WHERE u.role IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles AS ur
    WHERE ur.user_id = u.id
      AND ur.role = u.role
  )
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_primary_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF NEW.role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role, granted_by)
    VALUES (NEW.id, NEW.role, NULL)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_primary_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_primary_user_role() FROM anon;
REVOKE ALL ON FUNCTION public.sync_primary_user_role() FROM authenticated;

DROP TRIGGER IF EXISTS trg_sync_primary_user_role ON public.users;
CREATE TRIGGER trg_sync_primary_user_role
AFTER INSERT OR UPDATE OF role ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_primary_user_role();

COMMIT;
