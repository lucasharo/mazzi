-- MAZZI — School ↔ Instructor membership and invitation lifecycle
-- Forward-only model extension. Existing RLS helpers continue to use is_active.

CREATE TYPE public.school_invitation_status AS ENUM (
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'CANCELLED',
  'EXPIRED'
);

CREATE TYPE public.school_membership_status AS ENUM (
  'PENDING_COMPLIANCE',
  'ACTIVE',
  'SUSPENDED',
  'ENDED'
);

CREATE TABLE public.driving_school_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.providers(id),
  target_user_id UUID NULL REFERENCES public.users(id),
  invited_name VARCHAR(255) NULL,
  invited_email VARCHAR(255) NULL,
  invited_phone VARCHAR(50) NULL,
  role public.user_role NOT NULL DEFAULT 'INSTRUCTOR',
  status public.school_invitation_status NOT NULL DEFAULT 'PENDING',
  invited_by UUID NOT NULL REFERENCES public.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ NULL,
  declined_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT driving_school_invitations_target_check
    CHECK (target_user_id IS NOT NULL OR NULLIF(BTRIM(invited_email), '') IS NOT NULL),
  CONSTRAINT driving_school_invitations_role_check
    CHECK (role = 'INSTRUCTOR')
);

-- The school_id provider type is validated by the future invitation RPC.
CREATE UNIQUE INDEX driving_school_invitations_pending_user_uidx
  ON public.driving_school_invitations (school_id, target_user_id)
  WHERE status = 'PENDING' AND target_user_id IS NOT NULL;

CREATE UNIQUE INDEX driving_school_invitations_pending_email_uidx
  ON public.driving_school_invitations (school_id, LOWER(BTRIM(invited_email)))
  WHERE status = 'PENDING' AND invited_email IS NOT NULL;

ALTER TABLE public.driving_school_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.driving_school_invitations FROM PUBLIC, anon, authenticated;

-- Keep the legacy boolean because existing policies and helpers depend on it.
ALTER TABLE public.driving_school_staff
  ADD COLUMN membership_status public.school_membership_status
    NOT NULL DEFAULT 'SUSPENDED',
  ADD COLUMN source_invitation_id UUID NULL
    REFERENCES public.driving_school_invitations(id),
  ADD COLUMN accepted_at TIMESTAMPTZ NULL,
  ADD COLUMN suspended_at TIMESTAMPTZ NULL,
  ADD COLUMN suspended_by UUID NULL REFERENCES public.users(id),
  ADD COLUMN ended_at TIMESTAMPTZ NULL,
  ADD COLUMN ended_by UUID NULL REFERENCES public.users(id),
  ADD COLUMN end_reason TEXT NULL;

UPDATE public.driving_school_staff
SET membership_status = CASE
  WHEN is_active IS TRUE THEN 'ACTIVE'::public.school_membership_status
  ELSE 'SUSPENDED'::public.school_membership_status
END;

CREATE OR REPLACE FUNCTION public.sync_school_staff_membership_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO public, pg_temp
AS $$
BEGIN
  -- membership_status is canonical for inserts and explicit status changes.
  IF TG_OP = 'INSERT' THEN
    NEW.is_active := (NEW.membership_status = 'ACTIVE'::public.school_membership_status);
    RETURN NEW;
  END IF;

  -- A legacy write changing only is_active may transition ACTIVE/SUSPENDED,
  -- but must never revive or rewrite PENDING_COMPLIANCE/ENDED.
  IF NEW.membership_status IS DISTINCT FROM OLD.membership_status THEN
    NEW.is_active := (NEW.membership_status = 'ACTIVE'::public.school_membership_status);
  ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    CASE OLD.membership_status
      WHEN 'ACTIVE'::public.school_membership_status THEN
        NEW.membership_status := CASE
          WHEN NEW.is_active IS TRUE THEN 'ACTIVE'::public.school_membership_status
          ELSE 'SUSPENDED'::public.school_membership_status
        END;
      WHEN 'SUSPENDED'::public.school_membership_status THEN
        NEW.membership_status := CASE
          WHEN NEW.is_active IS TRUE THEN 'ACTIVE'::public.school_membership_status
          ELSE 'SUSPENDED'::public.school_membership_status
        END;
      WHEN 'PENDING_COMPLIANCE'::public.school_membership_status,
           'ENDED'::public.school_membership_status THEN
        NEW.membership_status := OLD.membership_status;
    END CASE;
    NEW.is_active := (NEW.membership_status = 'ACTIVE'::public.school_membership_status);
  ELSE
    -- Unrelated updates retain the canonical status/boolean relationship.
    NEW.is_active := (NEW.membership_status = 'ACTIVE'::public.school_membership_status);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_school_staff_membership_status ON public.driving_school_staff;
CREATE TRIGGER sync_school_staff_membership_status
  BEFORE INSERT OR UPDATE ON public.driving_school_staff
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_school_staff_membership_status();

ALTER TABLE public.driving_school_staff
  ADD CONSTRAINT driving_school_staff_membership_consistency_check
  CHECK (
    (membership_status = 'ACTIVE' AND is_active IS TRUE)
    OR (membership_status IN ('PENDING_COMPLIANCE', 'SUSPENDED', 'ENDED') AND is_active IS FALSE)
  );

REVOKE ALL ON FUNCTION public.sync_school_staff_membership_status() FROM PUBLIC;

-- Direct membership mutations are only allowed through the secure lifecycle RPCs below.
DROP POLICY IF EXISTS "School admin can manage school staff" ON public.driving_school_staff;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.driving_school_staff FROM PUBLIC, anon, authenticated;

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
  v_uid UUID := auth.uid();
  v_email TEXT := LOWER(BTRIM(p_invited_email));
  v_school public.providers%ROWTYPE;
  v_target_user_id UUID;
  v_invitation public.driving_school_invitations%ROWTYPE;
  v_existing_membership public.driving_school_staff%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_current_user_active() THEN RAISE EXCEPTION 'USER_NOT_ACTIVE'; END IF;
  IF NOT public.is_school_admin(p_school_id) THEN RAISE EXCEPTION 'SCHOOL_ADMIN_REQUIRED'; END IF;
  IF v_email IS NULL OR v_email = '' THEN RAISE EXCEPTION 'INVITED_EMAIL_REQUIRED'; END IF;
  IF p_expires_in_days IS NULL OR p_expires_in_days < 1 OR p_expires_in_days > 30 THEN
    RAISE EXCEPTION 'INVALID_EXPIRATION_DAYS';
  END IF;

  SELECT * INTO v_school FROM public.providers WHERE id = p_school_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'SCHOOL_NOT_FOUND'; END IF;
  IF v_school.type <> 'DRIVING_SCHOOL'::public.provider_type THEN
    RAISE EXCEPTION 'PROVIDER_NOT_DRIVING_SCHOOL';
  END IF;

  SELECT id INTO v_target_user_id
  FROM public.users
  WHERE LOWER(BTRIM(email)) = v_email
  LIMIT 1;

  IF v_target_user_id IS NOT NULL THEN
    SELECT * INTO v_existing_membership
    FROM public.driving_school_staff
    WHERE school_id = p_school_id AND user_id = v_target_user_id
    FOR UPDATE;
    IF FOUND THEN
      IF v_existing_membership.membership_status = 'ENDED'::public.school_membership_status THEN
        RAISE EXCEPTION 'MEMBERSHIP_REHIRE_FLOW_NOT_IMPLEMENTED';
      END IF;
      RAISE EXCEPTION 'MEMBERSHIP_ALREADY_EXISTS';
    END IF;
  END IF;

  INSERT INTO public.driving_school_invitations (
    school_id, target_user_id, invited_name, invited_email, invited_phone,
    role, status, invited_by, expires_at
  ) VALUES (
    p_school_id, v_target_user_id, NULLIF(BTRIM(p_invited_name), ''), v_email,
    NULLIF(BTRIM(p_invited_phone), ''), 'INSTRUCTOR', 'PENDING', v_uid,
    NOW() + make_interval(days => p_expires_in_days)
  )
  RETURNING * INTO v_invitation;

  RETURN jsonb_build_object(
    'success', TRUE,
    'invitation_id', v_invitation.id,
    'status', v_invitation.status,
    'existing_mazzi_user', (v_target_user_id IS NOT NULL),
    'expires_at', v_invitation.expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_school_instructor_invitation(p_invitation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_user public.users%ROWTYPE;
  v_invitation public.driving_school_invitations%ROWTYPE;
  v_membership public.driving_school_staff%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_user FROM public.users WHERE id = v_uid AND status = 'ACTIVE'::public.user_status;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_ACTIVE'; END IF;

  SELECT * INTO v_invitation
  FROM public.driving_school_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVITATION_NOT_FOUND'; END IF;
  IF v_invitation.status <> 'PENDING'::public.school_invitation_status THEN
    RAISE EXCEPTION 'INVITATION_ALREADY_PROCESSED';
  END IF;
  IF v_invitation.expires_at <= NOW() THEN
    UPDATE public.driving_school_invitations
    SET status = 'EXPIRED', updated_at = NOW()
    WHERE id = v_invitation.id;
    RAISE EXCEPTION 'INVITATION_EXPIRED';
  END IF;
  IF v_invitation.target_user_id IS NOT NULL AND v_invitation.target_user_id <> v_uid THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;
  IF v_invitation.target_user_id IS NULL
     AND LOWER(BTRIM(v_user.email)) <> LOWER(BTRIM(v_invitation.invited_email)) THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  SELECT * INTO v_membership
  FROM public.driving_school_staff
  WHERE school_id = v_invitation.school_id AND user_id = v_uid
  FOR UPDATE;
  IF FOUND THEN
    IF v_membership.membership_status = 'ENDED'::public.school_membership_status THEN
      RAISE EXCEPTION 'MEMBERSHIP_REHIRE_FLOW_NOT_IMPLEMENTED';
    END IF;
    RAISE EXCEPTION 'MEMBERSHIP_ALREADY_EXISTS';
  END IF;

  INSERT INTO public.user_roles (user_id, role, granted_by)
  VALUES (v_uid, 'INSTRUCTOR', v_uid)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.driving_school_staff (
    school_id, user_id, role, membership_status, is_active,
    source_invitation_id, accepted_at
  ) VALUES (
    v_invitation.school_id, v_uid, 'INSTRUCTOR', 'PENDING_COMPLIANCE', FALSE,
    v_invitation.id, NOW()
  );

  UPDATE public.driving_school_invitations
  SET status = 'ACCEPTED', accepted_at = NOW(), target_user_id = v_uid, updated_at = NOW()
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'invitation_id', v_invitation.id,
    'school_id', v_invitation.school_id,
    'membership_status', 'PENDING_COMPLIANCE'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_school_instructor_invitation(p_invitation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_user public.users%ROWTYPE;
  v_invitation public.driving_school_invitations%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_user FROM public.users WHERE id = v_uid AND status = 'ACTIVE'::public.user_status;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_ACTIVE'; END IF;
  SELECT * INTO v_invitation FROM public.driving_school_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVITATION_NOT_FOUND'; END IF;
  IF v_invitation.status <> 'PENDING'::public.school_invitation_status THEN
    RAISE EXCEPTION 'INVITATION_ALREADY_PROCESSED';
  END IF;
  IF v_invitation.expires_at <= NOW() THEN
    UPDATE public.driving_school_invitations SET status = 'EXPIRED', updated_at = NOW() WHERE id = v_invitation.id;
    RAISE EXCEPTION 'INVITATION_EXPIRED';
  END IF;
  IF (v_invitation.target_user_id IS NOT NULL AND v_invitation.target_user_id <> v_uid)
     OR (v_invitation.target_user_id IS NULL AND LOWER(BTRIM(v_user.email)) <> LOWER(BTRIM(v_invitation.invited_email))) THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  UPDATE public.driving_school_invitations
  SET status = 'DECLINED', declined_at = NOW(), updated_at = NOW()
  WHERE id = v_invitation.id;
  RETURN jsonb_build_object('success', TRUE, 'invitation_id', v_invitation.id, 'status', 'DECLINED');
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_school_instructor_invitation(p_invitation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_invitation public.driving_school_invitations%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_current_user_active() THEN RAISE EXCEPTION 'USER_NOT_ACTIVE'; END IF;
  SELECT * INTO v_invitation FROM public.driving_school_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVITATION_NOT_FOUND'; END IF;
  IF NOT public.is_school_admin(v_invitation.school_id) THEN RAISE EXCEPTION 'SCHOOL_ADMIN_REQUIRED'; END IF;
  IF v_invitation.status <> 'PENDING'::public.school_invitation_status THEN
    RAISE EXCEPTION 'INVITATION_ALREADY_PROCESSED';
  END IF;

  UPDATE public.driving_school_invitations
  SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW()
  WHERE id = v_invitation.id;
  RETURN jsonb_build_object('success', TRUE, 'invitation_id', v_invitation.id, 'status', 'CANCELLED');
END;
$$;

REVOKE ALL ON FUNCTION public.create_school_instructor_invitation(UUID, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_school_instructor_invitation(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decline_school_instructor_invitation(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_school_instructor_invitation(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_school_instructor_invitation(UUID, TEXT, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_school_instructor_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_school_instructor_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_school_instructor_invitation(UUID) TO authenticated;
