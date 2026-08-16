-- ============================================================================
-- MAZZI — Sprint 15 Hotfix: bind booking holds to authenticated students
-- ============================================================================
-- This migration intentionally preserves the existing RPC signature so the
-- frontend contract does not break. p_student_id is kept only as a consistency
-- check; auth.uid() is the source of truth for identity.

create or replace function public.create_booking_hold(
  p_quote_id uuid,
  p_student_id uuid,
  p_idempotency_key varchar default null,
  p_hold_duration_minutes int default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_student_id uuid := auth.uid();
  v_quote record;
  v_provider record;
  v_vehicle record;
  v_offering record;
  v_existing_booking record;
  v_booking_id uuid;
  v_payment_id uuid;
  v_now timestamptz := now();
  v_hold_expires_at timestamptz;
  v_snapshot jsonb;
begin
  if v_student_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_student_id is distinct from v_student_id then
    raise exception 'STUDENT_ID_MISMATCH' using errcode = '42501';
  end if;

  -- 1. Idempotency check bound to the authenticated user, not to a client-supplied identity.
  if p_idempotency_key is not null then
    select *
      into v_existing_booking
      from public.bookings
     where idempotency_key = p_idempotency_key
       and student_id = v_student_id;

    if found then
      if v_existing_booking.quote_id = p_quote_id then
        select id
          into v_payment_id
          from public.payments
         where booking_id = v_existing_booking.id
         limit 1;

        return jsonb_build_object(
          'success', true,
          'is_idempotent', true,
          'booking_id', v_existing_booking.id,
          'payment_id', v_payment_id,
          'status', v_existing_booking.status,
          'hold_expires_at', v_existing_booking.hold_expires_at
        );
      end if;

      raise exception 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST' using errcode = '23505';
    end if;
  end if;

  -- 2. Housekeeping: expire stale PENDING_PAYMENT holds before evaluating availability.
  update public.bookings
     set status = 'EXPIRED',
         expired_at = v_now,
         updated_at = v_now
   where status = 'PENDING_PAYMENT'
     and hold_expires_at <= v_now;

  -- 3. Load and lock quote. The quote must belong to auth.uid().
  select *
    into v_quote
    from public.quotes
   where id = p_quote_id
   for update;

  if not found then
    raise exception 'QUOTE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_quote.student_id is distinct from v_student_id then
    raise exception 'CROSS_STUDENT_QUOTE_ACCESS_DENIED' using errcode = '42501';
  end if;

  if v_quote.status != 'ACTIVE' then
    if v_quote.status = 'CONSUMED' then
      raise exception 'QUOTE_ALREADY_CONSUMED' using errcode = '22000';
    end if;

    raise exception 'QUOTE_NOT_ACTIVE' using errcode = '22000';
  end if;

  if v_quote.expires_at <= v_now then
    update public.quotes
       set status = 'EXPIRED'
     where id = p_quote_id;

    raise exception 'QUOTE_EXPIRED' using errcode = '22000';
  end if;

  -- 4. Revalidate provider, vehicle and offering operational eligibility.
  select *
    into v_provider
    from public.providers
   where id = v_quote.provider_id;

  if not found or v_provider.status != 'ACTIVE' then
    raise exception 'PROVIDER_NOT_ACTIVE' using errcode = '22000';
  end if;

  select *
    into v_vehicle
    from public.vehicles
   where id = v_quote.vehicle_id;

  if not found or v_vehicle.status != 'ACTIVE' then
    raise exception 'VEHICLE_NOT_ACTIVE' using errcode = '22000';
  end if;

  select *
    into v_offering
    from public.service_offerings
   where id = v_quote.offering_id;

  if not found or v_offering.is_active != true then
    raise exception 'OFFERING_NOT_ACTIVE' using errcode = '22000';
  end if;

  -- 5. Calculate hold expiration.
  v_hold_expires_at := v_now + (p_hold_duration_minutes || ' minutes')::interval;

  -- 6. Construct immutable historical snapshot.
  v_snapshot := jsonb_build_object(
    'providerId', v_provider.id,
    'providerName', v_provider.trade_name,
    'providerType', v_provider.type,
    'instructorId', v_quote.instructor_id,
    'instructorName', 'Instrutor ' || v_quote.instructor_id,
    'vehicleId', v_vehicle.id,
    'vehicleName', v_vehicle.brand || ' ' || v_vehicle.model,
    'vehicleBrand', v_vehicle.brand,
    'vehicleModel', v_vehicle.model,
    'category', v_offering.category,
    'transmission', v_vehicle.transmission,
    'durationMinutes', v_offering.duration_minutes,
    'priceInCents', v_quote.price_in_cents,
    'platformFeeInCents', v_quote.platform_fee_in_cents,
    'totalInCents', v_quote.total_in_cents,
    'meetingPoint', coalesce(v_provider.neighborhood, v_provider.city)
  );

  -- 7. Insert booking. student_id is always auth.uid().
  v_booking_id := gen_random_uuid();

  insert into public.bookings (
    id,
    student_id,
    provider_id,
    instructor_id,
    vehicle_id,
    offering_id,
    quote_id,
    status,
    scheduled_start_at,
    scheduled_end_at,
    hold_expires_at,
    idempotency_key,
    price_in_cents,
    platform_fee_in_cents,
    total_in_cents,
    snapshot_data,
    created_at,
    updated_at
  ) values (
    v_booking_id,
    v_student_id,
    v_quote.provider_id,
    v_quote.instructor_id,
    v_quote.vehicle_id,
    v_quote.offering_id,
    p_quote_id,
    'PENDING_PAYMENT',
    v_quote.scheduled_start_at,
    v_quote.scheduled_end_at,
    v_hold_expires_at,
    p_idempotency_key,
    v_quote.price_in_cents,
    v_quote.platform_fee_in_cents,
    v_quote.total_in_cents,
    v_snapshot,
    v_now,
    v_now
  );

  -- 8. Mark quote as consumed.
  update public.quotes
     set status = 'CONSUMED',
         consumed_at = v_now
   where id = p_quote_id;

  -- 9. Insert corresponding pending payment row.
  v_payment_id := gen_random_uuid();

  insert into public.payments (
    id,
    booking_id,
    method,
    status,
    amount_in_cents,
    idempotency_key,
    gateway_provider,
    created_at,
    updated_at
  ) values (
    v_payment_id,
    v_booking_id,
    'PIX',
    'PENDING',
    v_quote.total_in_cents,
    'pay_hold_' || v_booking_id,
    'supabase_gateway',
    v_now,
    v_now
  );

  -- 10. Audit log. actor_id is always auth.uid().
  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    new_value,
    ip_address,
    user_agent,
    severity,
    created_at
  ) values (
    v_student_id,
    'BOOKING_CREATE_HOLD',
    'BOOKINGS',
    v_booking_id,
    jsonb_build_object('booking_id', v_booking_id, 'payment_id', v_payment_id, 'quote_id', p_quote_id),
    '127.0.0.1',
    'PostgreSQL Trigger (SECURITY DEFINER)',
    'INFO',
    v_now
  );

  return jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'payment_id', v_payment_id,
    'status', 'PENDING_PAYMENT',
    'hold_expires_at', v_hold_expires_at
  );
exception
  when exclusion_violation then
    raise exception 'SLOT_NO_LONGER_AVAILABLE' using errcode = '23P01';
end;
$$;

revoke all on function public.create_booking_hold(uuid, uuid, varchar, int) from public;
revoke all on function public.create_booking_hold(uuid, uuid, varchar, int) from anon;
revoke all on function public.create_booking_hold(uuid, uuid, varchar, int) from authenticated;
grant execute on function public.create_booking_hold(uuid, uuid, varchar, int) to authenticated, service_role;
