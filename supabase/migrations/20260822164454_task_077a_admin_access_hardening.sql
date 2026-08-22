-- TASK-077A: compliance review follows the canonical permission matrix.
-- SUPPORT remains a valid RBAC role, but does not review compliance in the
-- Admin MVP. The existing review RPC and compliance RLS call this function.
CREATE OR REPLACE FUNCTION public.is_compliance_reviewer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND public.current_user_has_permission(
      'admin.compliance.review'::public.app_permission
    );
$function$;

REVOKE ALL ON FUNCTION public.is_compliance_reviewer() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_compliance_reviewer() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_compliance_reviewer() TO authenticated;
