-- TASK-087 — allow the DEV dispatcher to read its private canonical rows.
-- These grants are server-side only; anon/authenticated remain revoked.

BEGIN;

GRANT SELECT ON TABLE public.notifications TO service_role;
GRANT SELECT ON TABLE public.user_push_devices TO service_role;
GRANT SELECT ON TABLE public.push_deliveries TO service_role;

COMMIT;
