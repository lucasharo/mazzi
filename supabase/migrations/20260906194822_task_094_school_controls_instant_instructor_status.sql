-- TASK-094 — Allow an authorized driving school to control each instructor's
-- Aula Agora availability without changing vehicle-level eligibility.
-- The canonical state remains provider_id + instructor_id and keeps its
-- backend-owned one-hour window.

BEGIN;

CREATE OR REPLACE FUNCTION public.set_my_instant_instructor_online(
  p_provider_id UUID,
  p_instructor_id UUID,
  p_online BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_online BOOLEAN := COALESCE(p_online, FALSE);
  v_provider_type public.provider_type;
  v_is_linked_instructor BOOLEAN;
  v_previous_online BOOLEAN := FALSE;
  v_previous_since TIMESTAMPTZ;
  v_previous_expires_at TIMESTAMPTZ;
  v_online_since TIMESTAMPTZ;
  v_online_expires_at TIMESTAMPTZ;
BEGIN
  IF v_actor_id IS NULL OR NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT p.type
    INTO v_provider_type
  FROM public.providers p
  WHERE p.id = p_provider_id
    AND p.status = 'ACTIVE';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROVIDER_NOT_ACTIVE' USING ERRCODE = '22023';
  END IF;

  -- The instructor must belong to this exact provider. This check is kept
  -- separate from the actor authorization so provider_id cannot be spoofed.
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = p_instructor_id
      AND u.status = 'ACTIVE'
      AND (
        (
          v_provider_type = 'INSTRUCTOR'::public.provider_type
          AND EXISTS (
            SELECT 1
            FROM public.providers p
            WHERE p.id = p_provider_id
              AND p.user_id = p_instructor_id
          )
        )
        OR (
          v_provider_type = 'DRIVING_SCHOOL'::public.provider_type
          AND EXISTS (
            SELECT 1
            FROM public.driving_school_staff dss
            WHERE dss.school_id = p_provider_id
              AND dss.user_id = p_instructor_id
              AND dss.role = 'INSTRUCTOR'::public.user_role
              AND dss.membership_status = 'ACTIVE'::public.school_membership_status
              AND dss.is_active IS TRUE
          )
        )
      )
  ) INTO v_is_linked_instructor;

  IF NOT v_is_linked_instructor THEN
    RAISE EXCEPTION 'INSTANT_INSTRUCTOR_SCOPE_DENIED' USING ERRCODE = '42501';
  END IF;

  -- Autonomous providers remain self-controlled. For a driving school,
  -- can_manage_provider_schedule reuses the established owner/admin/staff
  -- RBAC and same-tenant membership checks.
  IF v_actor_id <> p_instructor_id
     AND NOT (
       v_provider_type = 'DRIVING_SCHOOL'::public.provider_type
       AND public.can_manage_provider_schedule(p_provider_id)
     ) THEN
    RAISE EXCEPTION 'INSTANT_INSTRUCTOR_SELF_ONLY' USING ERRCODE = '42501';
  END IF;

  -- Keep the existing contract: ON requires at least one active, eligible
  -- Aula Agora vehicle, while the full matching gates remain server-side.
  IF v_online AND NOT EXISTS (
    SELECT 1
    FROM public.provider_instant_settings s
    JOIN public.service_offerings o
      ON o.id = s.offering_id
     AND o.source = 'AULA_AGORA'
     AND o.instructor_id = p_instructor_id
     AND o.status = 'ACTIVE'
     AND o.is_active IS TRUE
    JOIN public.vehicles v
      ON v.id = o.vehicle_id
     AND v.provider_id = p_provider_id
     AND v.status = 'ACTIVE'
     AND v.deleted_at IS NULL
    WHERE s.provider_id = p_provider_id
      AND s.instant_enabled IS TRUE
  ) THEN
    RAISE EXCEPTION 'INSTANT_VEHICLE_NOT_ENABLED' USING ERRCODE = '22023';
  END IF;

  SELECT s.instant_online, s.online_since, s.online_expires_at
    INTO v_previous_online, v_previous_since, v_previous_expires_at
  FROM public.provider_instant_instructor_status s
  WHERE s.provider_id = p_provider_id
    AND s.instructor_id = p_instructor_id
  FOR UPDATE;

  IF v_online THEN
    v_online_since := NOW();
    v_online_expires_at := v_online_since + INTERVAL '1 hour';
  END IF;

  INSERT INTO public.provider_instant_instructor_status (
    provider_id,
    instructor_id,
    instant_online,
    online_since,
    online_expires_at,
    updated_at
  ) VALUES (
    p_provider_id,
    p_instructor_id,
    v_online,
    v_online_since,
    v_online_expires_at,
    NOW()
  )
  ON CONFLICT (provider_id, instructor_id) DO UPDATE SET
    instant_online = EXCLUDED.instant_online,
    online_since = EXCLUDED.online_since,
    online_expires_at = EXCLUDED.online_expires_at,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    previous_value,
    new_value,
    created_at
  ) VALUES (
    v_actor_id,
    'INSTANT_INSTRUCTOR_AVAILABILITY_UPDATED',
    'provider_instant_instructor_status',
    p_instructor_id::TEXT,
    jsonb_build_object(
      'provider_id', p_provider_id,
      'instructor_id', p_instructor_id,
      'instant_online', COALESCE(v_previous_online, FALSE),
      'online_since', v_previous_since,
      'online_expires_at', v_previous_expires_at,
      'actor_user_id', v_actor_id
    ),
    jsonb_build_object(
      'provider_id', p_provider_id,
      'instructor_id', p_instructor_id,
      'instant_online', v_online,
      'online_since', v_online_since,
      'online_expires_at', v_online_expires_at,
      'actor_user_id', v_actor_id
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'provider_id', p_provider_id,
    'instructor_id', p_instructor_id,
    'instant_online', v_online,
    'online_since', v_online_since,
    'online_expires_at', v_online_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_instant_instructor_online(UUID, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_instant_instructor_online(UUID, UUID, BOOLEAN) TO authenticated;

COMMIT;
