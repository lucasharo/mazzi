-- Internal trigger helpers must never be callable through the Data API.
REVOKE ALL ON FUNCTION public.enforce_quote_instructor_eligibility() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_booking_instructor_eligibility() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_school_invitation_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_school_membership_status_event() FROM PUBLIC, anon, authenticated;
