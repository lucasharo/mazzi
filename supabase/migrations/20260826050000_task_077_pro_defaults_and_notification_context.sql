-- TASK-077 — one-time instructor defaults and context-isolated notifications.
-- Forward-only; no provider activation and no client-provided authority.

CREATE TABLE IF NOT EXISTS public.provider_schedule_bootstrap (
  provider_id UUID PRIMARY KEY REFERENCES public.providers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.provider_schedule_bootstrap ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.provider_schedule_bootstrap FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.onboard_my_instructor()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_user public.users%ROWTYPE;
  v_provider public.providers%ROWTYPE;
  v_role_added BOOLEAN := FALSE;
  v_provider_created BOOLEAN := FALSE;
  v_role_inserted_count INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND OR v_user.status <> 'ACTIVE'::public.user_status THEN
    RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE = '42501';
  END IF;
  IF v_user.cpf IS NULL OR NOT public.validate_cpf(v_user.cpf) THEN
    RAISE EXCEPTION 'CPF_REQUIRED_OR_INVALID' USING ERRCODE = '22023';
  END IF;
  IF v_user.birth_date IS NULL OR v_user.birth_date > (CURRENT_DATE - INTERVAL '18 years') THEN
    RAISE EXCEPTION 'MINIMUM_AGE_VIOLATION' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(BTRIM(v_user.phone), '') IS NULL THEN
    RAISE EXCEPTION 'PHONE_REQUIRED' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_roles(user_id, role, granted_by)
  VALUES (v_uid, 'INSTRUCTOR'::public.user_role, v_uid)
  ON CONFLICT (user_id, role) DO NOTHING;
  GET DIAGNOSTICS v_role_inserted_count = ROW_COUNT;
  v_role_added := v_role_inserted_count > 0;

  SELECT * INTO v_provider
  FROM public.providers
  WHERE user_id = v_uid AND type = 'INSTRUCTOR'::public.provider_type
  ORDER BY created_at ASC LIMIT 1 FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.providers (
      user_id, type, legal_name, trade_name, document_number, status, phone, city, state
    ) VALUES (
      v_uid, 'INSTRUCTOR'::public.provider_type, v_user.name, v_user.name,
      v_user.cpf, 'DRAFT'::public.provider_status, v_user.phone, 'São Paulo', 'SP'
    ) RETURNING * INTO v_provider;
    v_provider_created := TRUE;
  END IF;

  IF v_provider_created THEN
    INSERT INTO public.provider_schedule_bootstrap(provider_id) VALUES (v_provider.id)
    ON CONFLICT (provider_id) DO NOTHING;

    INSERT INTO public.availabilities (
      provider_id, instructor_id, vehicle_id, day_of_week, start_time, end_time, timezone, is_active
    )
    SELECT v_provider.id, v_uid, NULL, weekday, TIME '08:00', TIME '18:00', 'America/Sao_Paulo', TRUE
    FROM generate_series(1, 5) AS weekday;
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, previous_value, new_value)
  VALUES (
    v_uid, 'INSTRUCTOR_ONBOARDING_COMPLETED', 'USER', v_uid::TEXT,
    jsonb_build_object('instructor_role', FALSE),
    jsonb_build_object('instructor_role', TRUE, 'provider_id', v_provider.id, 'provider_status', v_provider.status, 'default_availability_created', v_provider_created)
  );

  RETURN jsonb_build_object('success', TRUE, 'role', 'INSTRUCTOR', 'role_added', v_role_added, 'provider_id', v_provider.id, 'provider_status', v_provider.status, 'default_availability_created', v_provider_created);
END;
$$;

REVOKE ALL ON FUNCTION public.onboard_my_instructor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.onboard_my_instructor() TO authenticated;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS app_context TEXT;

CREATE OR REPLACE FUNCTION public.resolve_notification_app_context(
  p_user_id UUID,
  p_entity_type TEXT,
  p_entity_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_student_id UUID;
BEGIN
  IF p_entity_type = 'booking' THEN
    SELECT student_id INTO v_student_id FROM public.bookings WHERE id = p_entity_id;
  ELSIF p_entity_type = 'conversation' THEN
    SELECT student_id INTO v_student_id FROM public.conversations WHERE id = p_entity_id;
  ELSIF p_entity_type = 'review' THEN
    SELECT student_id INTO v_student_id FROM public.reviews WHERE id = p_entity_id;
  END IF;
  RETURN CASE WHEN v_student_id = p_user_id THEN 'STUDENT' ELSE 'PRO' END;
END;
$$;

UPDATE public.notifications n
SET app_context = public.resolve_notification_app_context(n.user_id, n.entity_type, n.entity_id)
WHERE n.app_context IS NULL;

UPDATE public.notifications SET app_context = 'PRO' WHERE app_context IS NULL;

ALTER TABLE public.notifications
  ALTER COLUMN app_context SET DEFAULT 'PRO',
  ALTER COLUMN app_context SET NOT NULL;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_app_context_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_app_context_check CHECK (app_context IN ('STUDENT', 'PRO', 'ADMIN'));

CREATE OR REPLACE FUNCTION public.assign_notification_app_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF NEW.entity_type IN ('booking', 'conversation', 'review') THEN
    NEW.app_context := public.resolve_notification_app_context(NEW.user_id, NEW.entity_type, NEW.entity_id);
  ELSIF NEW.app_context IS NULL THEN
    NEW.app_context := 'PRO';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_notification_app_context ON public.notifications;
CREATE TRIGGER set_notification_app_context
  BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.assign_notification_app_context();

CREATE INDEX IF NOT EXISTS idx_notifications_user_context_unread_created_at
  ON public.notifications(user_id, app_context, is_read, created_at DESC);

REVOKE ALL ON FUNCTION public.resolve_notification_app_context(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_notification_app_context() FROM PUBLIC, anon, authenticated;
