-- TASK-096A4M: Student -> MAZZI PRO profile migration.
-- Code-only migration. Do not apply this file from the client or outside the
-- controlled Supabase migration pipeline.

CREATE OR REPLACE FUNCTION public.lock_student_profile(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('student-profile:' || p_user_id::TEXT, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_current_user_student()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
     WHERE u.id = v_uid
       AND u.status = 'ACTIVE'
       AND (
         u.role = 'STUDENT'
         OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id AND ur.role = 'STUDENT')
       )
  ) THEN
    RAISE EXCEPTION 'STUDENT_PROFILE_INACTIVE' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.lock_student_profile(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_current_user_student() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_student_to_pro_migration_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_user public.users%ROWTYPE;
  v_provider public.providers%ROWTYPE;
  v_blockers TEXT[] := ARRAY[]::TEXT[];
  v_active_booking_count INTEGER := 0;
  v_has_student BOOLEAN := FALSE;
  v_has_instructor BOOLEAN := FALSE;
  v_identity_complete BOOLEAN := FALSE;
  v_role_conflict BOOLEAN := FALSE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;

  SELECT * INTO v_user FROM public.users WHERE id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role = 'STUDENT') OR v_user.role = 'STUDENT' INTO v_has_student;
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role = 'INSTRUCTOR') OR v_user.role = 'INSTRUCTOR' INTO v_has_instructor;
  SELECT * INTO v_provider FROM public.providers WHERE user_id = v_uid AND type = 'INSTRUCTOR' ORDER BY created_at LIMIT 1;

  v_identity_complete := v_user.status = 'ACTIVE'
    AND v_user.cpf IS NOT NULL
    AND public.validate_cpf(v_user.cpf)
    AND v_user.birth_date IS NOT NULL
    AND v_user.birth_date <= (CURRENT_DATE - INTERVAL '18 years')::DATE
    AND NULLIF(BTRIM(v_user.phone), '') IS NOT NULL;

  IF NOT v_identity_complete THEN v_blockers := array_append(v_blockers, 'IDENTITY_INCOMPLETE'); END IF;
  IF v_user.status <> 'ACTIVE' THEN v_blockers := array_append(v_blockers, 'USER_INACTIVE'); END IF;
  IF v_user.role::TEXT NOT IN ('STUDENT', 'INSTRUCTOR') THEN
    v_role_conflict := TRUE;
    v_blockers := array_append(v_blockers, 'ROLE_CONFLICT');
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_active_booking_count
    FROM public.bookings b
   WHERE b.student_id = v_uid
     AND (
       (b.status::TEXT = 'PENDING_PAYMENT' AND (b.hold_expires_at IS NULL OR b.hold_expires_at > NOW()))
       OR b.status::TEXT IN ('CONFIRMED', 'IN_PROGRESS', 'DISPUTED', 'PARTIALLY_REFUNDED')
     );
  IF v_active_booking_count > 0 THEN
    IF EXISTS (SELECT 1 FROM public.bookings b WHERE b.student_id = v_uid AND b.status::TEXT = 'PENDING_PAYMENT' AND (b.hold_expires_at IS NULL OR b.hold_expires_at > NOW())) THEN
      v_blockers := array_append(v_blockers, 'PENDING_STUDENT_PAYMENT');
    END IF;
    IF EXISTS (SELECT 1 FROM public.bookings b WHERE b.student_id = v_uid AND b.status::TEXT = 'DISPUTED') THEN
      v_blockers := array_append(v_blockers, 'STUDENT_DISPUTE_OPEN');
    END IF;
    IF EXISTS (SELECT 1 FROM public.bookings b WHERE b.student_id = v_uid AND b.status::TEXT IN ('CONFIRMED', 'IN_PROGRESS', 'PARTIALLY_REFUNDED')) THEN
      v_blockers := array_append(v_blockers, 'ACTIVE_STUDENT_BOOKING');
    END IF;
  END IF;

  SELECT ARRAY(SELECT DISTINCT item FROM unnest(v_blockers) item ORDER BY item) INTO v_blockers;
  RETURN jsonb_build_object(
    'student_profile_active', v_has_student AND v_user.status = 'ACTIVE',
    'instructor_role_active', v_has_instructor,
    'provider_id', v_provider.id,
    'provider_status', v_provider.status,
    'can_migrate', v_has_student AND v_identity_complete AND NOT v_role_conflict AND cardinality(v_blockers) = 0,
    'blockers', to_jsonb(COALESCE(v_blockers, ARRAY[]::TEXT[])),
    'active_booking_count', v_active_booking_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_student_to_pro_migration_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_student_to_pro_migration_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.migrate_my_student_profile_to_instructor()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_user public.users%ROWTYPE;
  v_provider public.providers%ROWTYPE;
  v_active_booking_count INTEGER;
  v_had_instructor BOOLEAN;
  v_had_student BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  PERFORM public.lock_student_profile(v_uid);
  SELECT * INTO v_user FROM public.users WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role = 'INSTRUCTOR') OR v_user.role = 'INSTRUCTOR' INTO v_had_instructor;
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role = 'STUDENT') OR v_user.role = 'STUDENT' INTO v_had_student;
  IF v_user.role::TEXT NOT IN ('STUDENT', 'INSTRUCTOR') THEN RAISE EXCEPTION 'STUDENT_TO_PRO_ROLE_CONFLICT' USING ERRCODE = '42501'; END IF;

  IF v_user.status <> 'ACTIVE' THEN RAISE EXCEPTION 'USER_INACTIVE' USING ERRCODE = '42501'; END IF;
  IF v_user.cpf IS NULL OR NOT public.validate_cpf(v_user.cpf) OR v_user.birth_date IS NULL OR v_user.birth_date > (CURRENT_DATE - INTERVAL '18 years')::DATE OR NULLIF(BTRIM(v_user.phone), '') IS NULL THEN
    RAISE EXCEPTION 'IDENTITY_INCOMPLETE' USING ERRCODE = '22023';
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_active_booking_count
    FROM public.bookings b
   WHERE b.student_id = v_uid
     AND ((b.status::TEXT = 'PENDING_PAYMENT' AND (b.hold_expires_at IS NULL OR b.hold_expires_at > NOW())) OR b.status::TEXT IN ('CONFIRMED', 'IN_PROGRESS', 'DISPUTED', 'PARTIALLY_REFUNDED'));
  IF v_active_booking_count > 0 THEN
    IF EXISTS (SELECT 1 FROM public.bookings b WHERE b.student_id = v_uid AND b.status::TEXT = 'PENDING_PAYMENT' AND (b.hold_expires_at IS NULL OR b.hold_expires_at > NOW())) THEN RAISE EXCEPTION 'PENDING_STUDENT_PAYMENT' USING ERRCODE = '55000'; END IF;
    IF EXISTS (SELECT 1 FROM public.bookings b WHERE b.student_id = v_uid AND b.status::TEXT = 'DISPUTED') THEN RAISE EXCEPTION 'STUDENT_DISPUTE_OPEN' USING ERRCODE = '55000'; END IF;
    RAISE EXCEPTION 'ACTIVE_STUDENT_BOOKING' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO v_provider FROM public.providers WHERE user_id = v_uid AND type = 'INSTRUCTOR' ORDER BY created_at LIMIT 1;
  IF NOT v_had_instructor OR v_provider.id IS NULL THEN
    PERFORM public.onboard_my_instructor();
    SELECT * INTO v_provider FROM public.providers WHERE user_id = v_uid AND type = 'INSTRUCTOR' ORDER BY created_at LIMIT 1;
  END IF;
  IF v_provider.id IS NULL THEN RAISE EXCEPTION 'PROVIDER_PROFILE_NOT_CREATED' USING ERRCODE = 'P0001'; END IF;

  UPDATE public.users SET role = 'INSTRUCTOR', updated_at = NOW() WHERE id = v_uid;
  DELETE FROM public.user_roles WHERE user_id = v_uid AND role = 'STUDENT';
  IF v_had_student THEN
    INSERT INTO public.audit_logs (id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at)
    VALUES (gen_random_uuid(), v_uid, 'STUDENT_PROFILE_MIGRATED_TO_INSTRUCTOR', 'User', v_uid,
      jsonb_build_object('primary_role', v_user.role, 'student_role', TRUE, 'provider_id', v_provider.id),
      jsonb_build_object('primary_role', 'INSTRUCTOR', 'student_role', FALSE, 'provider_id', v_provider.id), NOW());
  END IF;
  RETURN jsonb_build_object('success', TRUE, 'is_idempotent', NOT v_had_student, 'user_id', v_uid, 'provider_id', v_provider.id, 'provider_status', v_provider.status, 'primary_role', 'INSTRUCTOR');
END;
$$;

REVOKE ALL ON FUNCTION public.migrate_my_student_profile_to_instructor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.migrate_my_student_profile_to_instructor() TO authenticated;

-- Shared student guard for all direct student mutations. The row ownership
-- check lets provider/service workflows continue while every student-owned
-- payment and review insert is still tied to an active Student profile.
CREATE OR REPLACE FUNCTION public.guard_student_owned_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF TG_TABLE_NAME = 'payments' AND EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = NEW.booking_id AND b.student_id = auth.uid()) THEN
      PERFORM public.lock_student_profile(auth.uid());
      PERFORM public.assert_current_user_student();
    ELSIF TG_TABLE_NAME = 'reviews' AND NEW.student_id = auth.uid() THEN
      PERFORM public.lock_student_profile(auth.uid());
      PERFORM public.assert_current_user_student();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_student_payment_insert ON public.payments;
CREATE TRIGGER trg_guard_student_payment_insert
BEFORE INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.guard_student_owned_mutation();
DROP TRIGGER IF EXISTS trg_guard_student_review_insert ON public.reviews;
CREATE TRIGGER trg_guard_student_review_insert
BEFORE INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.guard_student_owned_mutation();

-- Internal trigger function: no direct PUBLIC/anon/authenticated execution.
REVOKE ALL ON FUNCTION public.guard_student_owned_mutation() FROM PUBLIC, anon, authenticated;

-- The latest booking RPCs acquire the same profile lock before their first
-- idempotency/read/write decision, then re-check the role after the lock.
CREATE OR REPLACE FUNCTION public.create_quote_from_offering(
  p_offering_id UUID,
  p_scheduled_start_at TIMESTAMPTZ,
  p_idempotency_key VARCHAR DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid(); v_offering public.service_offerings%ROWTYPE; v_provider public.providers%ROWTYPE; v_existing_quote public.quotes%ROWTYPE;
  v_scheduled_end_at TIMESTAMPTZ; v_now TIMESTAMPTZ := NOW(); v_expires_at TIMESTAMPTZ; v_platform_fee_percentage NUMERIC := 10; v_platform_fee_cents INT; v_total_in_cents INT; v_new_quote_id UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  PERFORM public.lock_student_profile(v_uid); PERFORM public.assert_current_user_student();
  SELECT COALESCE((value->>'default_percentage')::NUMERIC, 10) INTO v_platform_fee_percentage FROM public.platform_configurations WHERE key = 'platform_fees';
  v_platform_fee_percentage := GREATEST(0, LEAST(100, COALESCE(v_platform_fee_percentage, 10)));
  UPDATE public.bookings SET status = 'EXPIRED', expired_at = v_now, updated_at = v_now WHERE status = 'PENDING_PAYMENT' AND hold_expires_at <= v_now;
  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing_quote FROM public.quotes WHERE idempotency_key = TRIM(p_idempotency_key) AND student_id = v_uid LIMIT 1;
    IF FOUND THEN
      SELECT * INTO v_offering FROM public.service_offerings WHERE id = v_existing_quote.offering_id;
      IF NOT FOUND OR v_offering.category::TEXT <> 'B' THEN
        RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY: Only category B is supported for quotes' USING ERRCODE = '22023';
      END IF;
      IF v_existing_quote.offering_id <> p_offering_id OR v_existing_quote.scheduled_start_at <> p_scheduled_start_at THEN RAISE EXCEPTION 'QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST' USING ERRCODE = '23505'; END IF;
      IF v_existing_quote.status = 'ACTIVE' AND v_existing_quote.expires_at > v_now THEN RETURN jsonb_build_object('success',true,'is_idempotent',true,'quote_id',v_existing_quote.id,'student_id',v_uid,'provider_id',v_existing_quote.provider_id,'instructor_id',v_existing_quote.instructor_id,'vehicle_id',v_existing_quote.vehicle_id,'offering_id',v_existing_quote.offering_id,'scheduled_start_at',v_existing_quote.scheduled_start_at,'scheduled_end_at',v_existing_quote.scheduled_end_at,'price_in_cents',v_existing_quote.price_in_cents,'platform_fee_in_cents',v_existing_quote.platform_fee_in_cents,'total_in_cents',v_existing_quote.total_in_cents,'status',v_existing_quote.status,'expires_at',v_existing_quote.expires_at); END IF;
      RAISE EXCEPTION 'QUOTE_IDEMPOTENCY_KEY_STALE' USING ERRCODE = '22023';
    END IF;
  END IF;
  SELECT * INTO v_offering FROM public.service_offerings WHERE id = p_offering_id;
  IF NOT FOUND OR v_offering.status <> 'ACTIVE' OR v_offering.is_active IS NOT TRUE THEN RAISE EXCEPTION 'OFFERING_NOT_FOUND_OR_INACTIVE' USING ERRCODE = '22023'; END IF;
  IF v_offering.category::TEXT <> 'B' THEN RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY' USING ERRCODE = '22023'; END IF;
  IF v_offering.instructor_id IS NULL THEN RAISE EXCEPTION 'OFFERING_INSTRUCTOR_NOT_ASSIGNED' USING ERRCODE = '22023'; END IF;
  IF v_offering.vehicle_id IS NULL THEN RAISE EXCEPTION 'OFFERING_VEHICLE_NOT_ASSIGNED' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_provider FROM public.providers WHERE id = v_offering.provider_id;
  IF NOT FOUND OR v_provider.status <> 'ACTIVE' THEN RAISE EXCEPTION 'PROVIDER_INACTIVE' USING ERRCODE = '22023'; END IF;
  IF p_scheduled_start_at IS NULL OR p_scheduled_start_at <= v_now THEN RAISE EXCEPTION 'SLOT_MUST_BE_IN_FUTURE' USING ERRCODE = '22023'; END IF;
  IF NOT public.is_offering_slot_available(p_offering_id, p_scheduled_start_at) THEN RAISE EXCEPTION 'SELECTED_SLOT_NOT_AVAILABLE' USING ERRCODE = '22023'; END IF;
  v_scheduled_end_at := p_scheduled_start_at + MAKE_INTERVAL(mins => v_offering.duration_minutes); v_expires_at := v_now + INTERVAL '10 minutes'; v_platform_fee_cents := ROUND((v_offering.price_in_cents * v_platform_fee_percentage) / 100.0)::INT; v_total_in_cents := v_offering.price_in_cents; v_new_quote_id := gen_random_uuid();
  INSERT INTO public.quotes (id,student_id,provider_id,instructor_id,vehicle_id,offering_id,scheduled_start_at,scheduled_end_at,price_in_cents,platform_fee_in_cents,total_in_cents,status,expires_at,created_at,idempotency_key)
  VALUES (v_new_quote_id,v_uid,v_offering.provider_id,v_offering.instructor_id,v_offering.vehicle_id,v_offering.id,p_scheduled_start_at,v_scheduled_end_at,v_offering.price_in_cents,v_platform_fee_cents,v_total_in_cents,'ACTIVE',v_expires_at,v_now,NULLIF(TRIM(p_idempotency_key),''))
  ON CONFLICT (student_id,idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING RETURNING * INTO v_existing_quote;
  IF v_existing_quote.id IS NULL THEN SELECT * INTO v_existing_quote FROM public.quotes WHERE student_id=v_uid AND idempotency_key=NULLIF(TRIM(p_idempotency_key),''); IF NOT FOUND THEN RAISE EXCEPTION 'QUOTE_CONCURRENT_CONFLICT_UNRESOLVABLE' USING ERRCODE='40001'; END IF; IF v_existing_quote.offering_id<>p_offering_id OR v_existing_quote.scheduled_start_at<>p_scheduled_start_at THEN RAISE EXCEPTION 'QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST' USING ERRCODE='23505'; END IF; IF v_existing_quote.status='ACTIVE' AND v_existing_quote.expires_at>v_now THEN RETURN jsonb_build_object('success',true,'is_idempotent',true,'quote_id',v_existing_quote.id,'student_id',v_uid,'provider_id',v_existing_quote.provider_id,'instructor_id',v_existing_quote.instructor_id,'vehicle_id',v_existing_quote.vehicle_id,'offering_id',v_existing_quote.offering_id,'scheduled_start_at',v_existing_quote.scheduled_start_at,'scheduled_end_at',v_existing_quote.scheduled_end_at,'price_in_cents',v_existing_quote.price_in_cents,'platform_fee_in_cents',v_existing_quote.platform_fee_in_cents,'total_in_cents',v_existing_quote.total_in_cents,'status',v_existing_quote.status,'expires_at',v_existing_quote.expires_at); END IF; RAISE EXCEPTION 'QUOTE_IDEMPOTENCY_KEY_STALE' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('success',true,'is_idempotent',false,'quote_id',v_existing_quote.id,'student_id',v_uid,'provider_id',v_existing_quote.provider_id,'instructor_id',v_existing_quote.instructor_id,'vehicle_id',v_existing_quote.vehicle_id,'offering_id',v_existing_quote.offering_id,'scheduled_start_at',v_existing_quote.scheduled_start_at,'scheduled_end_at',v_existing_quote.scheduled_end_at,'price_in_cents',v_existing_quote.price_in_cents,'platform_fee_in_cents',v_existing_quote.platform_fee_in_cents,'total_in_cents',v_existing_quote.total_in_cents,'status',v_existing_quote.status,'expires_at',v_existing_quote.expires_at);
END; $$;

REVOKE ALL ON FUNCTION public.create_quote_from_offering(UUID,TIMESTAMPTZ,VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_quote_from_offering(UUID,TIMESTAMPTZ,VARCHAR) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.student_check_in_booking(p_booking_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_booking RECORD;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED: Usuário não autenticado.' USING ERRCODE = '28000'; END IF;
  PERFORM public.lock_student_profile(v_uid);
  PERFORM public.assert_current_user_student();
  IF NOT public.is_current_user_active() THEN RAISE EXCEPTION 'USER_NOT_ACTIVE: Usuário não está ativo no sistema.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND: Agendamento não encontrado.' USING ERRCODE = 'P0002'; END IF;
  IF v_booking.student_id <> v_uid THEN RAISE EXCEPTION 'UNAUTHORIZED_STUDENT: Acesso negado.' USING ERRCODE = '42501'; END IF;
  IF v_booking.checkin_student_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'is_idempotent', true, 'booking_id', p_booking_id, 'checkin_student_at', v_booking.checkin_student_at, 'message', 'Check-in do aluno já realizado anteriormente.');
  END IF;
  IF v_booking.status::TEXT NOT IN ('CONFIRMED', 'IN_PROGRESS') THEN RAISE EXCEPTION 'INVALID_STATUS: Novo check-in só é permitido para aulas operacionais.' USING ERRCODE = '42200'; END IF;
  IF v_now < v_booking.scheduled_start_at - INTERVAL '30 minutes' THEN RAISE EXCEPTION 'CHECKIN_WINDOW_NOT_OPEN: O check-in só fica disponível 30 minutos antes do início da aula.' USING ERRCODE = '42204'; END IF;
  UPDATE public.bookings SET checkin_student_at = v_now, updated_at = v_now WHERE id = p_booking_id;
  INSERT INTO public.audit_logs (id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at)
  VALUES (gen_random_uuid(), v_uid, 'STUDENT_CHECKIN_BOOKING', 'Booking', p_booking_id, jsonb_build_object('checkin_student_at', NULL), jsonb_build_object('checkin_student_at', v_now), v_now);
  RETURN jsonb_build_object('success', true, 'is_idempotent', false, 'booking_id', p_booking_id, 'checkin_student_at', v_now, 'message', 'Check-in do aluno realizado com sucesso.');
END; $$;

REVOKE ALL ON FUNCTION public.student_check_in_booking(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_check_in_booking(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_booking_hold(
  p_quote_id UUID, p_student_id UUID, p_idempotency_key VARCHAR DEFAULT NULL, p_hold_duration_minutes INTEGER DEFAULT 10
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, pg_temp AS $$
DECLARE
  v_student_id UUID := auth.uid(); v_quote RECORD; v_provider RECORD; v_vehicle RECORD; v_offering RECORD; v_existing_booking RECORD; v_booking_id UUID; v_payment_id UUID; v_now TIMESTAMPTZ := NOW(); v_hold_expires_at TIMESTAMPTZ; v_snapshot JSONB;
BEGIN
  IF v_student_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_student_id IS DISTINCT FROM v_student_id THEN RAISE EXCEPTION 'STUDENT_ID_MISMATCH' USING ERRCODE='42501'; END IF;
  PERFORM public.lock_student_profile(v_student_id); PERFORM public.assert_current_user_student();
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_booking FROM public.bookings WHERE idempotency_key=p_idempotency_key AND student_id=v_student_id;
    IF FOUND THEN
      IF v_existing_booking.quote_id=p_quote_id THEN SELECT id INTO v_payment_id FROM public.payments WHERE booking_id=v_existing_booking.id LIMIT 1; RETURN jsonb_build_object('success',true,'is_idempotent',true,'booking_id',v_existing_booking.id,'payment_id',v_payment_id,'status',v_existing_booking.status,'hold_expires_at',v_existing_booking.hold_expires_at); END IF;
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST' USING ERRCODE='23505';
    END IF;
  END IF;
  UPDATE public.bookings SET status='EXPIRED', expired_at=v_now, updated_at=v_now WHERE status='PENDING_PAYMENT' AND hold_expires_at <= v_now;
  SELECT * INTO v_quote FROM public.quotes WHERE id=p_quote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'QUOTE_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF v_quote.student_id IS DISTINCT FROM v_student_id THEN RAISE EXCEPTION 'CROSS_STUDENT_QUOTE_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  IF v_quote.status <> 'ACTIVE' THEN RAISE EXCEPTION 'QUOTE_NOT_ACTIVE' USING ERRCODE='22000'; END IF;
  IF v_quote.expires_at <= v_now THEN UPDATE public.quotes SET status='EXPIRED' WHERE id=p_quote_id; RAISE EXCEPTION 'QUOTE_EXPIRED' USING ERRCODE='22000'; END IF;
  IF EXISTS (SELECT 1 FROM public.bookings WHERE student_id=v_student_id AND status IN ('PENDING_PAYMENT','CONFIRMED','IN_PROGRESS') AND slot_range && tstzrange(v_quote.scheduled_start_at,v_quote.scheduled_end_at,'[)')) THEN RAISE EXCEPTION 'STUDENT_ALREADY_BOOKED_FOR_SLOT' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_provider FROM public.providers WHERE id=v_quote.provider_id;
  IF NOT FOUND OR v_provider.status <> 'ACTIVE' THEN RAISE EXCEPTION 'PROVIDER_NOT_ACTIVE' USING ERRCODE='22000'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('provider-schedule:' || v_quote.provider_id::TEXT, 0));
  SELECT * INTO v_vehicle FROM public.vehicles WHERE id=v_quote.vehicle_id;
  IF NOT FOUND OR v_vehicle.status <> 'ACTIVE' THEN RAISE EXCEPTION 'VEHICLE_NOT_ACTIVE' USING ERRCODE='22000'; END IF;
  SELECT * INTO v_offering FROM public.service_offerings WHERE id=v_quote.offering_id;
  IF NOT FOUND OR v_offering.is_active IS NOT TRUE THEN RAISE EXCEPTION 'OFFERING_NOT_ACTIVE' USING ERRCODE='22000'; END IF;
  IF v_offering.category::TEXT <> 'B' THEN RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY' USING ERRCODE='22023'; END IF;
  IF NOT public.is_offering_slot_available(v_quote.offering_id,v_quote.scheduled_start_at) THEN RAISE EXCEPTION 'SLOT_NO_LONGER_AVAILABLE' USING ERRCODE='23P01'; END IF;
  v_hold_expires_at := v_now + (p_hold_duration_minutes || ' minutes')::INTERVAL;
  v_snapshot := jsonb_build_object('providerId',v_provider.id,'providerName',v_provider.trade_name,'providerType',v_provider.type,'instructorId',v_quote.instructor_id,'instructorName','Instrutor ' || v_quote.instructor_id,'vehicleId',v_vehicle.id,'vehicleName',v_vehicle.brand || ' ' || v_vehicle.model,'vehicleBrand',v_vehicle.brand,'vehicleModel',v_vehicle.model,'category',v_offering.category,'transmission',v_vehicle.transmission,'durationMinutes',v_offering.duration_minutes,'priceInCents',v_quote.price_in_cents,'platformFeeInCents',v_quote.platform_fee_in_cents,'totalInCents',v_quote.total_in_cents,'meetingPoint',COALESCE(v_provider.neighborhood,v_provider.city));
  v_booking_id := gen_random_uuid();
  INSERT INTO public.bookings (id,student_id,provider_id,instructor_id,vehicle_id,offering_id,quote_id,status,scheduled_start_at,scheduled_end_at,hold_expires_at,idempotency_key,price_in_cents,platform_fee_in_cents,total_in_cents,snapshot_data,created_at,updated_at)
  VALUES (v_booking_id,v_student_id,v_quote.provider_id,v_quote.instructor_id,v_quote.vehicle_id,v_quote.offering_id,p_quote_id,'PENDING_PAYMENT',v_quote.scheduled_start_at,v_quote.scheduled_end_at,v_hold_expires_at,p_idempotency_key,v_quote.price_in_cents,v_quote.platform_fee_in_cents,v_quote.total_in_cents,v_snapshot,v_now,v_now);
  UPDATE public.quotes SET status='CONSUMED', consumed_at=v_now WHERE id=p_quote_id;
  v_payment_id := gen_random_uuid();
  INSERT INTO public.payments (id,booking_id,method,status,amount_in_cents,idempotency_key,gateway_provider,created_at,updated_at) VALUES (v_payment_id,v_booking_id,'PIX','PENDING',v_quote.total_in_cents,'idem_pay_' || v_booking_id,'fake_payment_gateway',v_now,v_now);
  INSERT INTO public.audit_logs (actor_id,action,entity_type,entity_id,new_value,ip_address,user_agent,severity,created_at) VALUES (v_student_id,'BOOKING_CREATE_HOLD','BOOKINGS',v_booking_id,jsonb_build_object('booking_id',v_booking_id,'payment_id',v_payment_id,'quote_id',p_quote_id),'127.0.0.1','PostgreSQL Trigger (SECURITY DEFINER)','INFO',v_now);
  RETURN jsonb_build_object('success',true,'booking_id',v_booking_id,'payment_id',v_payment_id,'status','PENDING_PAYMENT','hold_expires_at',v_hold_expires_at);
END; $$;

REVOKE ALL ON FUNCTION public.create_booking_hold(UUID,UUID,VARCHAR,INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_booking_hold(UUID,UUID,VARCHAR,INTEGER) TO authenticated, service_role;

-- Payment RPC contracts copied from the canonical fake-gateway definitions;
-- only the shared Student lock/assert is added before operational decisions.
CREATE OR REPLACE FUNCTION public.create_booking_payment(
  p_booking_id UUID,
  p_method public.payment_method,
  p_idempotency_key VARCHAR DEFAULT NULL,
  p_gateway_provider VARCHAR DEFAULT 'fake_payment_gateway'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_uid UUID; v_booking RECORD; v_payment RECORD; v_now TIMESTAMPTZ := NOW(); v_payment_id UUID; v_effective_idem_key VARCHAR;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '28000'; END IF;
  PERFORM public.lock_student_profile(v_uid);
  PERFORM public.assert_current_user_student();
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_booking.student_id <> v_uid THEN RAISE EXCEPTION 'CROSS_STUDENT_BOOKING_ACCESS_DENIED' USING ERRCODE = '42501'; END IF;
  IF v_booking.status <> 'PENDING_PAYMENT' THEN
    IF v_booking.status = 'CONFIRMED' THEN RAISE EXCEPTION 'BOOKING_ALREADY_PAID' USING ERRCODE = '22000';
    ELSE RAISE EXCEPTION 'BOOKING_NOT_PENDING_PAYMENT' USING ERRCODE = '22000'; END IF;
  END IF;
  IF v_booking.hold_expires_at IS NOT NULL AND v_booking.hold_expires_at <= v_now THEN
    UPDATE public.bookings SET status = 'EXPIRED', expired_at = v_now, updated_at = v_now WHERE id = p_booking_id;
    RETURN jsonb_build_object('success', false, 'error', 'BOOKING_HOLD_EXPIRED', 'message', 'The booking hold has expired');
  END IF;
  IF p_gateway_provider <> 'fake_payment_gateway' THEN RAISE EXCEPTION 'REAL_PAYMENT_GATEWAY_NOT_ENABLED' USING ERRCODE = '22000'; END IF;
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_payment FROM public.payments WHERE idempotency_key = p_idempotency_key;
    IF FOUND AND v_payment.booking_id <> p_booking_id THEN RAISE EXCEPTION 'PAYMENT_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BOOKING' USING ERRCODE = '22000'; END IF;
  END IF;
  SELECT * INTO v_payment FROM public.payments WHERE booking_id = p_booking_id ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN
    IF v_payment.status = 'PAID' THEN RAISE EXCEPTION 'BOOKING_ALREADY_PAID' USING ERRCODE = '22000'; END IF;
    IF v_payment.status IN ('REFUNDED', 'CHARGEBACK') THEN RAISE EXCEPTION 'PAYMENT_IN_TERMINAL_STATE_NO_RETRY' USING ERRCODE = '22000'; END IF;
    IF v_payment.status IN ('PENDING', 'AUTHORIZED') THEN
      IF v_payment.gateway_provider = 'supabase_gateway' THEN
        UPDATE public.payments SET gateway_provider = 'fake_payment_gateway', idempotency_key = 'idem_pay_' || p_booking_id, method = p_method, updated_at = v_now WHERE id = v_payment.id;
      ELSIF v_payment.method <> p_method AND v_payment.status = 'PENDING' THEN
        UPDATE public.payments SET method = p_method, updated_at = v_now WHERE id = v_payment.id;
      END IF;
      RETURN jsonb_build_object('success', true, 'is_idempotent', true, 'payment_id', v_payment.id, 'booking_id', v_payment.booking_id, 'status', v_payment.status, 'amount_in_cents', v_payment.amount_in_cents);
    END IF;
  END IF;
  v_payment_id := gen_random_uuid();
  v_effective_idem_key := 'idem_pay_' || p_booking_id || '_' || v_payment_id;
  INSERT INTO public.payments (id, booking_id, method, status, amount_in_cents, idempotency_key, gateway_provider, created_at, updated_at)
  VALUES (v_payment_id, p_booking_id, p_method, 'PENDING', v_booking.total_in_cents, v_effective_idem_key, p_gateway_provider, v_now, v_now);
  RETURN jsonb_build_object('success', true, 'is_idempotent', false, 'payment_id', v_payment_id, 'booking_id', p_booking_id, 'status', 'PENDING', 'amount_in_cents', v_booking.total_in_cents);
END; $$;

REVOKE ALL ON FUNCTION public.create_booking_payment(UUID, public.payment_method, VARCHAR, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_booking_payment(UUID, public.payment_method, VARCHAR, VARCHAR) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.confirm_booking_payment(
  p_payment_id UUID,
  p_external_payment_id VARCHAR DEFAULT NULL,
  p_paid_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid(); v_payment RECORD; v_booking RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '28000'; END IF;
  PERFORM public.lock_student_profile(v_uid);
  PERFORM public.assert_current_user_student();
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pagamento % não encontrado.', p_payment_id; END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = v_payment.booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reserva % associada ao pagamento não encontrada.', v_payment.booking_id; END IF;
  IF v_booking.student_id <> v_uid THEN RAISE EXCEPTION 'CROSS_STUDENT_PAYMENT_ACCESS_DENIED' USING ERRCODE = '42501'; END IF;
  IF v_payment.status = 'PAID' AND v_booking.status = 'CONFIRMED' THEN
    RETURN jsonb_build_object('success', true, 'already_paid', true, 'is_late_payment', false, 'refund_pending', false, 'booking_id', v_booking.id, 'payment_id', v_payment.id, 'status', 'CONFIRMED');
  END IF;
  IF v_booking.status IN ('EXPIRED', 'CANCELLED_BY_STUDENT', 'CANCELLED_BY_PROVIDER') THEN
    UPDATE public.payments SET status = 'PAID', paid_at = p_paid_at, external_transaction_id = COALESCE(p_external_payment_id, external_transaction_id), metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{auto_refund_required}', 'true'::jsonb), updated_at = NOW() WHERE id = v_payment.id;
    INSERT INTO public.financial_events (event_type, booking_id, payment_id, provider_id, student_id, amount_in_cents, platform_fee_in_cents, provider_amount_in_cents, metadata)
    VALUES ('PAYMENT_PAID', v_booking.id, v_payment.id, v_payment.provider_id, v_payment.student_id, v_payment.amount_in_cents, 0, 0, jsonb_build_object('late_payment_on_expired_booking', true, 'booking_status', v_booking.status));
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, new_value, ip_address, user_agent, severity, created_at)
    VALUES (v_booking.student_id, 'BOOKING_LATE_PAYMENT', 'BOOKINGS', v_booking.id, jsonb_build_object('booking_id', v_booking.id, 'payment_id', v_payment.id, 'booking_status', v_booking.status), '127.0.0.1', 'PostgreSQL Trigger (SECURITY DEFINER)', 'WARNING', NOW());
    RETURN jsonb_build_object('success', true, 'already_paid', false, 'is_late_payment', true, 'refund_pending', true, 'booking_id', v_booking.id, 'payment_id', v_payment.id, 'status', v_booking.status);
  END IF;
  UPDATE public.payments SET status = 'PAID', paid_at = p_paid_at, external_transaction_id = COALESCE(p_external_payment_id, external_transaction_id), updated_at = NOW() WHERE id = v_payment.id;
  UPDATE public.bookings SET status = 'CONFIRMED', confirmed_at = p_paid_at, updated_at = NOW() WHERE id = v_booking.id;
  INSERT INTO public.financial_events (event_type, booking_id, payment_id, provider_id, student_id, amount_in_cents, platform_fee_in_cents, provider_amount_in_cents)
  VALUES ('PAYMENT_PAID', v_booking.id, v_payment.id, v_payment.provider_id, v_payment.student_id, v_payment.amount_in_cents, v_payment.platform_fee_in_cents, v_payment.provider_amount_in_cents);
  INSERT INTO public.financial_events (event_type, booking_id, payment_id, provider_id, amount_in_cents, platform_fee_in_cents, provider_amount_in_cents)
  VALUES ('PLATFORM_FEE_RECORDED', v_booking.id, v_payment.id, v_payment.provider_id, v_payment.platform_fee_in_cents, v_payment.platform_fee_in_cents, 0);
  INSERT INTO public.financial_events (event_type, booking_id, payment_id, provider_id, amount_in_cents, platform_fee_in_cents, provider_amount_in_cents)
  VALUES ('PAYOUT_AVAILABLE', v_booking.id, v_payment.id, v_payment.provider_id, v_payment.provider_amount_in_cents, 0, v_payment.provider_amount_in_cents);
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, new_value, ip_address, user_agent, severity, created_at)
  VALUES (v_booking.student_id, 'BOOKING_PAYMENT_CONFIRM', 'BOOKINGS', v_booking.id, jsonb_build_object('booking_id', v_booking.id, 'payment_id', v_payment.id, 'booking_status', 'CONFIRMED'), '127.0.0.1', 'PostgreSQL Trigger (SECURITY DEFINER)', 'INFO', NOW());
  RETURN jsonb_build_object('success', true, 'already_paid', false, 'is_late_payment', false, 'refund_pending', false, 'booking_id', v_booking.id, 'payment_id', v_payment.id, 'status', 'CONFIRMED');
END; $$;

REVOKE ALL ON FUNCTION public.confirm_booking_payment(UUID, VARCHAR, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_booking_payment(UUID, VARCHAR, TIMESTAMPTZ) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mark_booking_payment_failed(
  p_payment_id UUID,
  p_reason VARCHAR DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE v_uid UUID := auth.uid(); v_payment RECORD; v_booking RECORD; v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '28000'; END IF;
  PERFORM public.lock_student_profile(v_uid);
  PERFORM public.assert_current_user_student();
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = v_payment.booking_id;
  IF NOT FOUND OR v_booking.student_id <> v_uid THEN RAISE EXCEPTION 'CROSS_STUDENT_PAYMENT_ACCESS_DENIED' USING ERRCODE = '42501'; END IF;
  IF v_payment.gateway_provider <> 'fake_payment_gateway' THEN RAISE EXCEPTION 'REAL_PAYMENT_GATEWAY_CONFIRMATION_REQUIRES_TRUSTED_BACKEND' USING ERRCODE = '42501'; END IF;
  IF v_payment.status NOT IN ('PENDING', 'AUTHORIZED') THEN RAISE EXCEPTION 'PAYMENT_NOT_IN_FAILURABLE_STATE' USING ERRCODE = '22000'; END IF;
  UPDATE public.payments SET status = 'FAILED', metadata = COALESCE(metadata, '{}') || jsonb_build_object('failureReason', p_reason), updated_at = v_now WHERE id = p_payment_id;
  RETURN jsonb_build_object('success', true, 'payment_id', p_payment_id, 'status', 'FAILED', 'booking_id', v_payment.booking_id, 'booking_status', v_booking.status);
END; $$;

REVOKE ALL ON FUNCTION public.mark_booking_payment_failed(UUID, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_booking_payment_failed(UUID, VARCHAR) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_review_for_booking(
  p_booking_id UUID,
  p_rating INTEGER,
  p_comment TEXT DEFAULT NULL
)
RETURNS public.reviews LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_student UUID := auth.uid(); v_booking public.bookings%ROWTYPE; v_review public.reviews%ROWTYPE; v_rating_average NUMERIC; v_rating_count INTEGER;
BEGIN
  IF v_student IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  PERFORM public.lock_student_profile(v_student); PERFORM public.assert_current_user_student();
  IF p_rating < 1 OR p_rating > 5 THEN RAISE EXCEPTION 'REVIEW_RATING_OUT_OF_RANGE' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_booking.student_id <> v_student THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  IF v_booking.instructor_id = v_student THEN RAISE EXCEPTION 'PROVIDER_CANNOT_REVIEW_SELF' USING ERRCODE = '42501'; END IF;
  IF v_booking.status::TEXT <> 'COMPLETED' THEN RAISE EXCEPTION 'REVIEW_REQUIRES_COMPLETED_BOOKING' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.reviews (booking_id, student_id, provider_id, instructor_id, rating_overall, comment, updated_at)
  VALUES (v_booking.id, v_booking.student_id, v_booking.provider_id, v_booking.instructor_id, p_rating, NULLIF(BTRIM(COALESCE(p_comment, '')), ''), NOW()) RETURNING * INTO v_review;
  SELECT COALESCE(ROUND(AVG(rating_overall)::NUMERIC, 2), 0.00), COUNT(*)::INTEGER INTO v_rating_average, v_rating_count FROM public.reviews WHERE provider_id = v_booking.provider_id;
  UPDATE public.providers SET rating_average = v_rating_average, rating_count = v_rating_count, updated_at = NOW() WHERE id = v_booking.provider_id;
  INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
  SELECT DISTINCT recipient_id, 'REVIEW_RECEIVED', 'Nova avaliação recebida', 'Um aluno avaliou uma aula concluída.', 'review', v_review.id
  FROM (SELECT v_booking.instructor_id AS recipient_id UNION ALL SELECT p.user_id FROM public.providers p WHERE p.id = v_booking.provider_id) recipients
  WHERE recipient_id IS NOT NULL AND recipient_id <> v_student;
  RETURN v_review;
END; $$;

REVOKE ALL ON FUNCTION public.create_review_for_booking(UUID, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_review_for_booking(UUID, INTEGER, TEXT) TO authenticated;
