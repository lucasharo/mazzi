-- TASK-092: serialize schedule mutations and revalidate booking holds.

CREATE OR REPLACE FUNCTION public.provider_save_availability_exception(
  p_id UUID,
  p_provider_id UUID,
  p_instructor_id UUID,
  p_vehicle_id UUID,
  p_type VARCHAR,
  p_reason_category VARCHAR,
  p_reason VARCHAR,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  p_is_active BOOLEAN DEFAULT TRUE
) RETURNS SETOF public.availability_exceptions
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_existing public.availability_exceptions%ROWTYPE;
  v_saved public.availability_exceptions%ROWTYPE;
  v_provider_id UUID := p_provider_id;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_start_at IS NULL OR p_end_at IS NULL OR p_end_at <= p_start_at THEN RAISE EXCEPTION 'INVALID_AVAILABILITY_EXCEPTION_RANGE' USING ERRCODE = '22023'; END IF;
  IF p_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.availability_exceptions WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'AVAILABILITY_EXCEPTION_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
    IF v_existing.provider_id IS DISTINCT FROM p_provider_id THEN RAISE EXCEPTION 'PROVIDER_SCOPE_MISMATCH' USING ERRCODE = '42501'; END IF;
    v_provider_id := v_existing.provider_id;
  END IF;
  IF NOT public.can_manage_provider_schedule(v_provider_id) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('provider-schedule:' || v_provider_id::TEXT, 0));
  IF p_type = 'BLOCK' AND COALESCE(p_is_active, TRUE) THEN
    IF EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.provider_id = v_provider_id
        AND b.status IN ('CONFIRMED','IN_PROGRESS')
        AND b.scheduled_start_at < p_end_at AND p_start_at < b.scheduled_end_at
        AND (p_instructor_id IS NULL OR b.instructor_id = p_instructor_id)
        AND (p_vehicle_id IS NULL OR b.vehicle_id = p_vehicle_id)
    ) OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.provider_id = v_provider_id AND b.status = 'PENDING_PAYMENT'
        AND (b.hold_expires_at IS NULL OR b.hold_expires_at > NOW())
        AND b.scheduled_start_at < p_end_at AND p_start_at < b.scheduled_end_at
        AND (p_instructor_id IS NULL OR b.instructor_id = p_instructor_id)
        AND (p_vehicle_id IS NULL OR b.vehicle_id = p_vehicle_id)
    ) THEN
      RAISE EXCEPTION 'AVAILABILITY_BLOCK_BOOKING_CONFLICT' USING ERRCODE = '23P01';
    END IF;
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.availability_exceptions (provider_id,instructor_id,vehicle_id,type,reason_category,reason,start_at,end_at,is_active)
    VALUES (p_provider_id,p_instructor_id,p_vehicle_id,p_type,p_reason_category,p_reason,p_start_at,p_end_at,COALESCE(p_is_active,TRUE))
    RETURNING * INTO v_saved;
  ELSE
    UPDATE public.availability_exceptions SET instructor_id=p_instructor_id, vehicle_id=p_vehicle_id,
      type=p_type, reason_category=p_reason_category, reason=p_reason, start_at=p_start_at, end_at=p_end_at,
      is_active=COALESCE(p_is_active,TRUE), updated_at=NOW()
    WHERE id=p_id RETURNING * INTO v_saved;
  END IF;
  RETURN NEXT v_saved;
END;
$$;

CREATE OR REPLACE FUNCTION public.provider_set_availability_exception_active(p_id UUID, p_is_active BOOLEAN)
RETURNS SETOF public.availability_exceptions
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_exception public.availability_exceptions%ROWTYPE; v_saved public.availability_exceptions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_exception FROM public.availability_exceptions WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'AVAILABILITY_EXCEPTION_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.can_manage_provider_schedule(v_exception.provider_id) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('provider-schedule:' || v_exception.provider_id::TEXT, 0));
  IF p_is_active AND v_exception.type='BLOCK' AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.provider_id=v_exception.provider_id AND b.status IN ('CONFIRMED','IN_PROGRESS','PENDING_PAYMENT')
      AND (b.status <> 'PENDING_PAYMENT' OR b.hold_expires_at IS NULL OR b.hold_expires_at > NOW())
      AND b.scheduled_start_at < v_exception.end_at AND v_exception.start_at < b.scheduled_end_at
      AND (v_exception.instructor_id IS NULL OR b.instructor_id=v_exception.instructor_id)
      AND (v_exception.vehicle_id IS NULL OR b.vehicle_id=v_exception.vehicle_id)
  ) THEN RAISE EXCEPTION 'AVAILABILITY_BLOCK_BOOKING_CONFLICT' USING ERRCODE = '23P01'; END IF;
  UPDATE public.availability_exceptions SET is_active=p_is_active, updated_at=NOW() WHERE id=p_id RETURNING * INTO v_saved;
  RETURN NEXT v_saved;
END;
$$;

CREATE OR REPLACE FUNCTION public.provider_delete_availability_exception(p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_exception public.availability_exceptions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_exception FROM public.availability_exceptions WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'AVAILABILITY_EXCEPTION_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.can_manage_provider_schedule(v_exception.provider_id) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('provider-schedule:' || v_exception.provider_id::TEXT, 0));
  IF v_exception.end_at <= NOW() THEN RAISE EXCEPTION 'AVAILABILITY_EXCEPTION_HISTORY_PROTECTED' USING ERRCODE = 'P0001'; END IF;
  DELETE FROM public.availability_exceptions WHERE id=p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_booking_hold(
  p_quote_id UUID, p_student_id UUID, p_idempotency_key VARCHAR DEFAULT NULL, p_hold_duration_minutes INTEGER DEFAULT 10
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_student_id UUID := auth.uid(); v_quote RECORD; v_provider RECORD; v_vehicle RECORD; v_offering RECORD;
  v_existing_booking RECORD; v_booking_id UUID; v_payment_id UUID; v_now TIMESTAMPTZ := NOW();
  v_hold_expires_at TIMESTAMPTZ; v_snapshot JSONB;
BEGIN
  IF v_student_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_student_id IS DISTINCT FROM v_student_id THEN RAISE EXCEPTION 'STUDENT_ID_MISMATCH' USING ERRCODE='42501'; END IF;
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_booking FROM public.bookings WHERE idempotency_key=p_idempotency_key AND student_id=v_student_id;
    IF FOUND THEN
      IF v_existing_booking.quote_id=p_quote_id THEN
        SELECT id INTO v_payment_id FROM public.payments WHERE booking_id=v_existing_booking.id LIMIT 1;
        RETURN jsonb_build_object('success',true,'is_idempotent',true,'booking_id',v_existing_booking.id,'payment_id',v_payment_id,'status',v_existing_booking.status,'hold_expires_at',v_existing_booking.hold_expires_at);
      END IF;
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
  IF v_offering.category::TEXT <> 'B' THEN RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY: Only category B is supported for booking holds' USING ERRCODE='22023'; END IF;
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
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_schedule_lock_on_availability()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.provider_id IS DISTINCT FROM NEW.provider_id THEN RAISE EXCEPTION 'PROVIDER_SCOPE_IMMUTABLE' USING ERRCODE='22000'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('provider-schedule:' || COALESCE(NEW.provider_id,OLD.provider_id)::TEXT,0));
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
DROP TRIGGER IF EXISTS trg_availabilities_schedule_lock ON public.availabilities;
CREATE TRIGGER trg_availabilities_schedule_lock BEFORE INSERT OR UPDATE OR DELETE ON public.availabilities FOR EACH ROW EXECUTE FUNCTION public.enforce_schedule_lock_on_availability();

CREATE OR REPLACE FUNCTION public.enforce_booking_schedule_exceptions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('provider-schedule:' || NEW.provider_id::TEXT,0));
  IF NEW.instructor_id IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('instructor-schedule:' || NEW.instructor_id::TEXT,0)); END IF;
  IF NEW.status IN ('PENDING_PAYMENT','CONFIRMED','IN_PROGRESS') AND EXISTS (
    SELECT 1 FROM public.availability_exceptions e WHERE e.provider_id=NEW.provider_id AND e.type='BLOCK' AND e.is_active IS TRUE
      AND (e.instructor_id IS NULL OR e.instructor_id=NEW.instructor_id) AND (e.vehicle_id IS NULL OR e.vehicle_id=NEW.vehicle_id)
      AND NEW.scheduled_start_at < e.end_at AND e.start_at < NEW.scheduled_end_at
  ) THEN RAISE EXCEPTION 'SLOT_NO_LONGER_AVAILABLE' USING ERRCODE='23P01'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_booking_schedule_exceptions ON public.bookings;
CREATE TRIGGER trg_booking_schedule_exceptions BEFORE INSERT OR UPDATE OF provider_id,instructor_id,vehicle_id,scheduled_start_at,scheduled_end_at,status ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_schedule_exceptions();

REVOKE ALL ON FUNCTION public.provider_save_availability_exception(UUID,UUID,UUID,UUID,VARCHAR,VARCHAR,VARCHAR,TIMESTAMPTZ,TIMESTAMPTZ,BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.provider_set_availability_exception_active(UUID,BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.provider_delete_availability_exception(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_save_availability_exception(UUID,UUID,UUID,UUID,VARCHAR,VARCHAR,VARCHAR,TIMESTAMPTZ,TIMESTAMPTZ,BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.provider_set_availability_exception_active(UUID,BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.provider_delete_availability_exception(UUID) TO authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.availability_exceptions FROM authenticated;
GRANT SELECT ON TABLE public.availability_exceptions TO authenticated;
