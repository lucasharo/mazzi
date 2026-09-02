-- The payments SELECT policy already limits rows to the booking parties or
-- platform admins. Grant the table privilege required for that policy to run
-- through the Data API; RLS remains the authorization boundary.
GRANT SELECT ON TABLE public.payments TO authenticated;
