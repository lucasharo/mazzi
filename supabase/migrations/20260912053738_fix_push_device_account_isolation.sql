-- A physical push destination must belong to only one account per app.
-- Registration transfers ownership atomically, while logout can disable every
-- destination owned by the authenticated account in the current app context.

BEGIN;

-- Keep the most recently seen owner before enforcing active-device uniqueness.
WITH ranked_endpoints AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY app_context, provider, endpoint
      ORDER BY last_seen_at DESC, updated_at DESC, created_at DESC, id DESC
    ) AS position
  FROM public.user_push_devices
  WHERE disabled_at IS NULL
    AND invalidated_at IS NULL
)
UPDATE public.user_push_devices AS device
SET disabled_at = NOW(), updated_at = NOW()
FROM ranked_endpoints AS ranked
WHERE device.id = ranked.id
  AND ranked.position > 1;

WITH ranked_fingerprints AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY app_context, provider, device_fingerprint
      ORDER BY last_seen_at DESC, updated_at DESC, created_at DESC, id DESC
    ) AS position
  FROM public.user_push_devices
  WHERE disabled_at IS NULL
    AND invalidated_at IS NULL
)
UPDATE public.user_push_devices AS device
SET disabled_at = NOW(), updated_at = NOW()
FROM ranked_fingerprints AS ranked
WHERE device.id = ranked.id
  AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_push_devices_active_endpoint
  ON public.user_push_devices(app_context, provider, endpoint)
  WHERE disabled_at IS NULL AND invalidated_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_push_devices_active_fingerprint
  ON public.user_push_devices(app_context, provider, device_fingerprint)
  WHERE disabled_at IS NULL AND invalidated_at IS NULL;

CREATE OR REPLACE FUNCTION public.register_my_push_device(
  p_provider TEXT,
  p_app_context TEXT,
  p_device_fingerprint TEXT,
  p_endpoint TEXT,
  p_public_key TEXT DEFAULT NULL,
  p_auth_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
  v_can_register BOOLEAN;
  v_provider TEXT := BTRIM(p_provider);
  v_app_context TEXT := BTRIM(p_app_context);
  v_device_fingerprint TEXT := BTRIM(p_device_fingerprint);
  v_endpoint TEXT := BTRIM(p_endpoint);
BEGIN
  IF v_uid IS NULL OR NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF v_provider NOT IN ('WEB_PUSH', 'FCM') OR v_app_context NOT IN ('STUDENT', 'PRO') THEN
    RAISE EXCEPTION 'INVALID_PUSH_DEVICE' USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = v_uid AND u.status = 'ACTIVE'::public.user_status
      AND ((v_app_context = 'STUDENT' AND u.role::TEXT = 'STUDENT')
        OR (v_app_context = 'PRO' AND u.role::TEXT IN ('INSTRUCTOR', 'SCHOOL_ADMIN', 'SCHOOL_STAFF')))
    UNION ALL
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ((v_app_context = 'STUDENT' AND ur.role::TEXT = 'STUDENT')
        OR (v_app_context = 'PRO' AND ur.role::TEXT IN ('INSTRUCTOR', 'SCHOOL_ADMIN', 'SCHOOL_STAFF')))
  ) INTO v_can_register;
  IF NOT v_can_register THEN
    RAISE EXCEPTION 'INVALID_PUSH_CONTEXT' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(v_device_fingerprint, '') IS NULL OR char_length(v_device_fingerprint) NOT BETWEEN 16 AND 128
     OR NULLIF(v_endpoint, '') IS NULL OR char_length(v_endpoint) > 2048 THEN
    RAISE EXCEPTION 'INVALID_PUSH_DEVICE' USING ERRCODE = '22023';
  END IF;

  -- Serialize both token reuse and stable-device reuse. The endpoint lock is
  -- always acquired first, which keeps concurrent registrations deadlock-free.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'push-endpoint:' || v_app_context || ':' || v_provider || ':' || v_endpoint,
    0
  ));
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'push-fingerprint:' || v_app_context || ':' || v_provider || ':' || v_device_fingerprint,
    0
  ));

  UPDATE public.user_push_devices
  SET disabled_at = NOW(), updated_at = NOW()
  WHERE app_context = v_app_context
    AND provider = v_provider
    AND disabled_at IS NULL
    AND invalidated_at IS NULL
    AND (endpoint = v_endpoint OR device_fingerprint = v_device_fingerprint)
    AND NOT (user_id = v_uid AND device_fingerprint = v_device_fingerprint);

  INSERT INTO public.user_push_devices (
    user_id, app_context, provider, device_fingerprint, endpoint,
    public_key, auth_key, last_seen_at, disabled_at, invalidated_at, updated_at
  )
  VALUES (
    v_uid, v_app_context, v_provider, v_device_fingerprint, v_endpoint,
    NULLIF(BTRIM(p_public_key), ''), NULLIF(BTRIM(p_auth_key), ''),
    NOW(), NULL, NULL, NOW()
  )
  ON CONFLICT (user_id, app_context, provider, device_fingerprint) DO UPDATE
    SET endpoint = EXCLUDED.endpoint,
        public_key = EXCLUDED.public_key,
        auth_key = EXCLUDED.auth_key,
        last_seen_at = NOW(),
        disabled_at = NULL,
        invalidated_at = NULL,
        updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.disable_my_push_devices_for_context(p_app_context TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_app_context TEXT := BTRIM(p_app_context);
  v_disabled_count INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF v_app_context NOT IN ('STUDENT', 'PRO') THEN
    RAISE EXCEPTION 'INVALID_PUSH_CONTEXT' USING ERRCODE = '22023';
  END IF;

  UPDATE public.user_push_devices
  SET disabled_at = NOW(), updated_at = NOW()
  WHERE user_id = v_uid
    AND app_context = v_app_context
    AND disabled_at IS NULL;

  GET DIAGNOSTICS v_disabled_count = ROW_COUNT;
  RETURN v_disabled_count;
END;
$$;

REVOKE ALL ON FUNCTION public.register_my_push_device(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.disable_my_push_devices_for_context(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_my_push_device(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.disable_my_push_devices_for_context(TEXT) TO authenticated;

COMMIT;
