-- TASK-096A4R: reduce public database surface without changing business logic.

-- Preserve the historical views, but make them obey caller privileges and
-- remove their unused direct application-role exposure. Public catalog flows
-- use explicit RPCs instead.
ALTER VIEW public.public_vehicles SET (security_invoker = true);
REVOKE SELECT ON public.public_vehicles FROM PUBLIC, anon, authenticated;

ALTER VIEW public.public_service_offerings SET (security_invoker = true);
REVOKE SELECT ON public.public_service_offerings FROM PUBLIC, anon, authenticated;

-- Review operations retain their SECURITY DEFINER bodies and internal RBAC
-- guards, but are no longer callable by anonymous/public roles.
REVOKE EXECUTE ON FUNCTION public.review_compliance_document(
  uuid,
  public.compliance_status,
  text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_compliance_document(
  uuid,
  public.compliance_status,
  text
) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.review_vehicle(
  uuid,
  public.vehicle_status,
  text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_vehicle(
  uuid,
  public.vehicle_status,
  text
) TO authenticated;

-- Trigger helpers are database-internal and are not application RPCs.
REVOKE EXECUTE ON FUNCTION public.enforce_booking_schedule_exceptions()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_schedule_lock_on_availability()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_availability_resource_scope()
  FROM PUBLIC, anon, authenticated;

-- The vehicle catalog has an authenticated Admin caller only. Keep its
-- existing signature and privileged behavior, but remove anonymous/public
-- execution rather than introducing a second public contract.
REVOKE EXECUTE ON FUNCTION public.get_public_vehicle_catalog()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_vehicle_catalog()
  TO authenticated;
