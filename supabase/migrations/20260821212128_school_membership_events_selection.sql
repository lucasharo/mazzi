-- MAZZI — membership history, rehire, selection mode and offering identity
-- Forward-only extension. No historical migration is modified.

CREATE TYPE public.booking_selection_mode AS ENUM (
  'SPECIFIC_INSTRUCTOR',
  'ANY_AVAILABLE_INSTRUCTOR'
);

CREATE TYPE public.school_membership_event_type AS ENUM (
  'INVITED',
  'ACCEPTED',
  'COMPLIANCE_PENDING',
  'ACTIVATED',
  'SUSPENDED',
  'ENDED',
  'REHIRE_INVITED',
  'REHIRE_ACCEPTED'
);

CREATE TABLE public.driving_school_membership_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID NULL REFERENCES public.driving_school_staff(id),
  school_id UUID NOT NULL REFERENCES public.providers(id),
  user_id UUID NULL REFERENCES public.users(id),
  event_type public.school_membership_event_type NOT NULL,
  previous_status public.school_membership_status NULL,
  new_status public.school_membership_status NULL,
  invitation_id UUID NULL REFERENCES public.driving_school_invitations(id),
  actor_id UUID NULL REFERENCES public.users(id),
  reason TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.driving_school_membership_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.driving_school_membership_events FROM PUBLIC, anon, authenticated;

CREATE INDEX driving_school_membership_events_membership_idx
  ON public.driving_school_membership_events (membership_id, created_at DESC);
CREATE INDEX driving_school_membership_events_school_user_idx
  ON public.driving_school_membership_events (school_id, user_id, created_at DESC);

ALTER TABLE public.quotes
  ADD COLUMN selection_mode public.booking_selection_mode;
ALTER TABLE public.bookings
  ADD COLUMN selection_mode public.booking_selection_mode;

UPDATE public.quotes SET selection_mode = 'SPECIFIC_INSTRUCTOR'
WHERE selection_mode IS NULL;
UPDATE public.bookings SET selection_mode = 'SPECIFIC_INSTRUCTOR'
WHERE selection_mode IS NULL;

ALTER TABLE public.quotes ALTER COLUMN selection_mode SET DEFAULT 'SPECIFIC_INSTRUCTOR';
ALTER TABLE public.bookings ALTER COLUMN selection_mode SET DEFAULT 'SPECIFIC_INSTRUCTOR';
ALTER TABLE public.quotes ALTER COLUMN selection_mode SET NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN selection_mode SET NOT NULL;

DROP INDEX IF EXISTS public.idx_uniq_active_offering;
CREATE UNIQUE INDEX idx_uniq_active_offering
  ON public.service_offerings (provider_id, instructor_id, vehicle_id, category, duration_minutes)
  WHERE status = 'ACTIVE' AND is_active = TRUE;

CREATE OR REPLACE FUNCTION public.record_school_membership_status_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_event public.school_membership_event_type;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'COMPLIANCE_PENDING';
  ELSIF NEW.membership_status IS DISTINCT FROM OLD.membership_status THEN
    v_event := CASE NEW.membership_status
      WHEN 'ACTIVE' THEN 'ACTIVATED'::public.school_membership_event_type
      WHEN 'SUSPENDED' THEN 'SUSPENDED'::public.school_membership_event_type
      WHEN 'ENDED' THEN 'ENDED'::public.school_membership_event_type
      ELSE 'COMPLIANCE_PENDING'::public.school_membership_event_type
    END;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.driving_school_membership_events (
    membership_id, school_id, user_id, event_type, previous_status, new_status, actor_id
  ) VALUES (
    NEW.id, NEW.school_id, NEW.user_id, v_event,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.membership_status END,
    NEW.membership_status, auth.uid()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS record_school_membership_status_event ON public.driving_school_staff;
CREATE TRIGGER record_school_membership_status_event
AFTER INSERT OR UPDATE OF membership_status ON public.driving_school_staff
FOR EACH ROW EXECUTE FUNCTION public.record_school_membership_status_event();

CREATE OR REPLACE FUNCTION public.try_activate_school_instructor_membership(
  p_membership_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_membership public.driving_school_staff%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_membership FROM public.driving_school_staff
  WHERE id = p_membership_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MEMBERSHIP_NOT_FOUND'; END IF;
  IF NOT (public.is_compliance_reviewer() OR public.is_school_admin(v_membership.school_id)
          OR v_membership.user_id = v_uid) THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;
  IF v_membership.membership_status <> 'PENDING_COMPLIANCE' THEN
    RETURN jsonb_build_object('success', FALSE, 'status', v_membership.membership_status);
  END IF;
  IF NOT public.is_provider_instructor_eligible(v_membership.school_id, v_membership.user_id) THEN
    RAISE EXCEPTION 'COMPLIANCE_NOT_SATISFIED';
  END IF;

  UPDATE public.driving_school_staff
  SET membership_status = 'ACTIVE', is_active = TRUE,
      suspended_at = NULL, suspended_by = NULL, ended_at = NULL,
      ended_by = NULL, end_reason = NULL, updated_at = NOW()
  WHERE id = v_membership.id;
  RETURN jsonb_build_object('success', TRUE, 'membership_id', v_membership.id, 'status', 'ACTIVE');
END;
$$;

REVOKE ALL ON FUNCTION public.try_activate_school_instructor_membership(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.try_activate_school_instructor_membership(UUID) TO authenticated;
