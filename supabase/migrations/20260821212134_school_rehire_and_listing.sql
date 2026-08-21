-- MAZZI — rehire lifecycle completion and membership event audit

CREATE OR REPLACE FUNCTION public.record_school_invitation_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_membership public.driving_school_staff%ROWTYPE;
  v_event public.school_membership_event_type;
BEGIN
  SELECT * INTO v_membership FROM public.driving_school_staff
  WHERE school_id = NEW.school_id AND user_id = NEW.target_user_id;
  v_event := CASE WHEN FOUND AND v_membership.membership_status = 'ENDED'
    THEN 'REHIRE_INVITED'::public.school_membership_event_type
    ELSE 'INVITED'::public.school_membership_event_type END;
  INSERT INTO public.driving_school_membership_events
    (membership_id, school_id, user_id, event_type, invitation_id, actor_id, metadata)
  VALUES
    (CASE WHEN FOUND THEN v_membership.id ELSE NULL END, NEW.school_id,
     NEW.target_user_id,
     v_event, NEW.id, NEW.invited_by, jsonb_build_object('invited_email', NEW.invited_email));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS record_school_invitation_event ON public.driving_school_invitations;
CREATE TRIGGER record_school_invitation_event
AFTER INSERT ON public.driving_school_invitations
FOR EACH ROW EXECUTE FUNCTION public.record_school_invitation_event();

CREATE OR REPLACE FUNCTION public.create_school_instructor_invitation(
  p_school_id UUID,
  p_invited_email TEXT,
  p_invited_name TEXT DEFAULT NULL,
  p_invited_phone TEXT DEFAULT NULL,
  p_expires_in_days INTEGER DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid(); v_email TEXT := LOWER(BTRIM(p_invited_email));
  v_target_user_id UUID; v_school public.providers%ROWTYPE;
  v_existing public.driving_school_staff%ROWTYPE; v_invitation public.driving_school_invitations%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_current_user_active() THEN RAISE EXCEPTION 'USER_NOT_ACTIVE'; END IF;
  IF NOT public.is_school_admin(p_school_id) THEN RAISE EXCEPTION 'SCHOOL_ADMIN_REQUIRED'; END IF;
  IF v_email IS NULL OR v_email = '' THEN RAISE EXCEPTION 'INVITED_EMAIL_REQUIRED'; END IF;
  IF p_expires_in_days IS NULL OR p_expires_in_days NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'INVALID_EXPIRATION_DAYS'; END IF;
  SELECT * INTO v_school FROM public.providers WHERE id = p_school_id;
  IF NOT FOUND OR v_school.type <> 'DRIVING_SCHOOL' THEN RAISE EXCEPTION 'PROVIDER_NOT_DRIVING_SCHOOL'; END IF;
  SELECT id INTO v_target_user_id FROM public.users WHERE LOWER(BTRIM(email)) = v_email LIMIT 1;
  IF v_target_user_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.driving_school_staff
    WHERE school_id = p_school_id AND user_id = v_target_user_id FOR UPDATE;
    IF FOUND AND v_existing.membership_status <> 'ENDED' THEN RAISE EXCEPTION 'MEMBERSHIP_ALREADY_EXISTS'; END IF;
  END IF;
  INSERT INTO public.driving_school_invitations
    (school_id, target_user_id, invited_name, invited_email, invited_phone, role, status, invited_by, expires_at)
  VALUES
    (p_school_id, v_target_user_id, NULLIF(BTRIM(p_invited_name), ''), v_email,
     NULLIF(BTRIM(p_invited_phone), ''), 'INSTRUCTOR', 'PENDING', v_uid,
     NOW() + make_interval(days => p_expires_in_days))
  RETURNING * INTO v_invitation;
  RETURN jsonb_build_object('success', TRUE, 'invitation_id', v_invitation.id,
    'status', v_invitation.status, 'existing_mazzi_user', v_target_user_id IS NOT NULL,
    'expires_at', v_invitation.expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_school_instructor_invitation(p_invitation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid(); v_user public.users%ROWTYPE;
  v_inv public.driving_school_invitations%ROWTYPE; v_membership public.driving_school_staff%ROWTYPE;
  v_rehire BOOLEAN := FALSE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_user FROM public.users WHERE id = v_uid AND status = 'ACTIVE';
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_ACTIVE'; END IF;
  SELECT * INTO v_inv FROM public.driving_school_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVITATION_NOT_FOUND'; END IF;
  IF v_inv.status <> 'PENDING' THEN RAISE EXCEPTION 'INVITATION_ALREADY_PROCESSED'; END IF;
  IF v_inv.expires_at <= NOW() THEN
    UPDATE public.driving_school_invitations SET status='EXPIRED',updated_at=NOW() WHERE id=v_inv.id;
    RAISE EXCEPTION 'INVITATION_EXPIRED';
  END IF;
  IF (v_inv.target_user_id IS NOT NULL AND v_inv.target_user_id <> v_uid)
     OR (v_inv.target_user_id IS NULL AND LOWER(BTRIM(v_user.email)) <> LOWER(BTRIM(v_inv.invited_email))) THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;
  SELECT * INTO v_membership FROM public.driving_school_staff
  WHERE school_id=v_inv.school_id AND user_id=v_uid FOR UPDATE;
  IF FOUND THEN
    IF v_membership.membership_status <> 'ENDED' THEN RAISE EXCEPTION 'MEMBERSHIP_ALREADY_EXISTS'; END IF;
    v_rehire := TRUE;
    UPDATE public.driving_school_staff SET membership_status='PENDING_COMPLIANCE',is_active=FALSE,
      source_invitation_id=v_inv.id,accepted_at=NOW(),suspended_at=NULL,suspended_by=NULL,
      ended_at=NULL,ended_by=NULL,end_reason=NULL,updated_at=NOW()
    WHERE id=v_membership.id;
    INSERT INTO public.driving_school_membership_events
      (membership_id,school_id,user_id,event_type,previous_status,new_status,invitation_id,actor_id)
    VALUES (v_membership.id,v_membership.school_id,v_membership.user_id,'REHIRE_ACCEPTED',
      'ENDED','PENDING_COMPLIANCE',v_inv.id,v_uid);
  ELSE
    INSERT INTO public.user_roles(user_id,role,granted_by) VALUES(v_uid,'INSTRUCTOR',v_uid)
      ON CONFLICT(user_id,role) DO NOTHING;
    INSERT INTO public.driving_school_staff(school_id,user_id,role,membership_status,is_active,source_invitation_id,accepted_at)
    VALUES(v_inv.school_id,v_uid,'INSTRUCTOR','PENDING_COMPLIANCE',FALSE,v_inv.id,NOW())
    RETURNING * INTO v_membership;
  END IF;
  UPDATE public.driving_school_invitations SET status='ACCEPTED',accepted_at=NOW(),target_user_id=v_uid,updated_at=NOW()
  WHERE id=v_inv.id;
  RETURN jsonb_build_object('success',TRUE,'invitation_id',v_inv.id,'school_id',v_inv.school_id,
    'membership_id',v_membership.id,'membership_status','PENDING_COMPLIANCE','rehire',v_rehire);
END;
$$;

REVOKE ALL ON FUNCTION public.create_school_instructor_invitation(UUID,TEXT,TEXT,TEXT,INTEGER) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.accept_school_instructor_invitation(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_school_instructor_invitation(UUID,TEXT,TEXT,TEXT,INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_school_instructor_invitation(UUID) TO authenticated;
