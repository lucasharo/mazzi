-- Keep the canonical status private. Access is exclusively through the
-- authenticated, authorization-checked SECURITY DEFINER RPCs.
BEGIN;

ALTER TABLE public.provider_instant_instructor_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS provider_instant_instructor_status_deny_direct_access
  ON public.provider_instant_instructor_status;
CREATE POLICY provider_instant_instructor_status_deny_direct_access
  ON public.provider_instant_instructor_status
  FOR ALL
  USING (FALSE)
  WITH CHECK (FALSE);
REVOKE ALL ON TABLE public.provider_instant_instructor_status FROM PUBLIC, anon, authenticated;

COMMIT;
