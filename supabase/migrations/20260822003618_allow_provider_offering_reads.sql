DROP POLICY IF EXISTS offerings_owner_select ON public.service_offerings;
CREATE POLICY offerings_owner_select
  ON public.service_offerings
  FOR SELECT
  TO authenticated
  USING (
    public.is_current_user_active()
    AND (
      provider_id IN (
        SELECT p.id
        FROM public.providers p
        WHERE p.user_id = auth.uid()
      )
      OR public.is_school_admin(provider_id)
      OR public.is_platform_admin()
    )
  );
