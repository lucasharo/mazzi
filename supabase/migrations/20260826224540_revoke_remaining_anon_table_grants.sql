-- MAZZI security hardening: keep anonymous reads behind the explicit public RPC surface.
-- Direct table access is unnecessary for public search/booking discovery and broadens
-- the exposed database surface even when RLS currently filters all rows.

REVOKE SELECT ON TABLE public.users FROM anon;
REVOKE SELECT ON TABLE public.availability_exceptions FROM anon;
