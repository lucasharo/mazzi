-- PostgREST requires a table-level UPDATE privilege for the notification
-- read-state PATCH. RLS still limits updates to the authenticated user's rows.
GRANT UPDATE ON TABLE public.notifications TO authenticated;
