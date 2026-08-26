-- Keep anonymous EXECUTE limited to the explicit public marketplace RPCs.
-- validate_cpf is needed by authenticated profile/onboarding policies, not by anon.
REVOKE ALL ON FUNCTION public.validate_cpf(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_cpf(text) TO authenticated, service_role;

-- Trigger functions are internal implementation details and must not be API-callable.
REVOKE ALL ON FUNCTION public.trigger_validate_user_student_identity() FROM PUBLIC;
