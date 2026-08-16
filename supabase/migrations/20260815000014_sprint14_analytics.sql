-- ============================================================================
-- MAZZI — Sprint 14: Secure Marketplace Analytics
-- ============================================================================
-- Goals:
-- - Keep business metrics authoritative: bookings/payments/providers/reviews/etc.
-- - Allow only a small set of product analytics events through a validated RPC.
-- - Prevent direct frontend writes to analytics_events.
-- - Avoid PII, chat/review content, payment secrets and precise location storage.

alter table public.analytics_events enable row level security;

revoke all on table public.analytics_events from public;
revoke all on table public.analytics_events from anon;
revoke all on table public.analytics_events from authenticated;

drop policy if exists "analytics_events_no_direct_client_select" on public.analytics_events;
drop policy if exists "analytics_events_no_direct_client_insert" on public.analytics_events;
drop policy if exists "analytics_events_no_direct_client_update" on public.analytics_events;
drop policy if exists "analytics_events_no_direct_client_delete" on public.analytics_events;

create policy "analytics_events_no_direct_client_select"
  on public.analytics_events
  for select
  using (false);

create policy "analytics_events_no_direct_client_insert"
  on public.analytics_events
  for insert
  with check (false);

create policy "analytics_events_no_direct_client_update"
  on public.analytics_events
  for update
  using (false)
  with check (false);

create policy "analytics_events_no_direct_client_delete"
  on public.analytics_events
  for delete
  using (false);

create index if not exists idx_analytics_events_event_created_at
  on public.analytics_events (event_name, created_at desc);

create index if not exists idx_analytics_events_actor_created_at
  on public.analytics_events (actor_id, created_at desc)
  where actor_id is not null;

create index if not exists idx_bookings_created_status_provider
  on public.bookings (created_at, status, provider_id);

create index if not exists idx_payments_created_status_booking
  on public.payments (created_at, status, booking_id);

create index if not exists idx_reviews_created_provider
  on public.reviews (created_at, provider_id);

create index if not exists idx_quotes_created_provider
  on public.quotes (created_at, provider_id);

create or replace function public.track_analytics_event(
  p_event_name text,
  p_properties jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_name text := upper(trim(coalesce(p_event_name, '')));
  v_properties jsonb := coalesce(p_properties, '{}'::jsonb);
  v_event_id uuid;
  v_forbidden_keys text[] := array[
    'email',
    'phone',
    'cpf',
    'cnpj',
    'document',
    'document_number',
    'renavam',
    'license_plate',
    'plate',
    'chat',
    'message',
    'review_comment',
    'comment',
    'jwt',
    'token',
    'payment_token',
    'card',
    'cvv',
    'latitude',
    'longitude',
    'lat',
    'lng',
    'ip',
    'fingerprint',
    'device_id',
    'student_name',
    'provider_phone'
  ];
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if not public.is_current_user_active() then
    raise exception 'USER_NOT_ACTIVE' using errcode = '42501';
  end if;

  if v_event_name not in (
    'PROVIDER_SEARCH',
    'PROVIDER_PROFILE_VIEW',
    'AVAILABLE_SLOTS_VIEW',
    'CHECKOUT_STARTED'
  ) then
    raise exception 'ANALYTICS_EVENT_NOT_ALLOWED' using errcode = '22023';
  end if;

  if jsonb_typeof(v_properties) <> 'object' then
    raise exception 'ANALYTICS_PROPERTIES_MUST_BE_OBJECT' using errcode = '22023';
  end if;

  if octet_length(v_properties::text) > 4096 then
    raise exception 'ANALYTICS_PROPERTIES_TOO_LARGE' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(v_properties) as keys(key)
    where lower(keys.key) = any(v_forbidden_keys)
  ) then
    raise exception 'ANALYTICS_PROPERTIES_CONTAIN_SENSITIVE_KEY' using errcode = '22023';
  end if;

  if v_properties::text ~* '"(email|phone|cpf|cnpj|document|document_number|renavam|license_plate|plate|chat|message|review_comment|comment|jwt|token|payment_token|card|cvv|latitude|longitude|lat|lng|ip|fingerprint|device_id|student_name|provider_phone)"[[:space:]]*:' then
    raise exception 'ANALYTICS_PROPERTIES_CONTAIN_SENSITIVE_KEY' using errcode = '22023';
  end if;

  insert into public.analytics_events (event_name, actor_id, properties)
  values (v_event_name, auth.uid(), v_properties)
  returning id into v_event_id;

  return v_event_id;
end;
$$;

create or replace function public.get_admin_analytics_summary(
  p_date_from timestamptz,
  p_date_to timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if not public.is_current_user_active() or not public.is_platform_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_date_from is null or p_date_to is null or p_date_to <= p_date_from then
    raise exception 'INVALID_ANALYTICS_PERIOD' using errcode = '22023';
  end if;

  with
  users_metrics as (
    select
      count(*) filter (where role::text = 'STUDENT' and status::text = 'ACTIVE') as active_students,
      count(*) filter (where role::text = 'INSTRUCTOR' and status::text = 'ACTIVE') as active_instructor_users,
      count(*) filter (where role::text = 'SCHOOL_ADMIN' and status::text = 'ACTIVE') as active_school_admin_users,
      count(*) filter (where status::text = 'ACTIVE') as active_users_total
    from public.users
  ),
  supply_metrics as (
    select
      count(*) filter (where status::text = 'ACTIVE') as active_providers,
      count(*) filter (where type::text = 'INSTRUCTOR' and status::text = 'ACTIVE') as active_individual_providers,
      count(*) filter (where type::text = 'DRIVING_SCHOOL' and status::text = 'ACTIVE') as active_driving_schools
    from public.providers
  ),
  vehicle_metrics as (
    select count(*) filter (where status::text = 'ACTIVE' and deleted_at is null) as active_vehicles
    from public.vehicles
  ),
  offering_metrics as (
    select count(*) filter (where status::text = 'ACTIVE' and is_active is true) as active_offerings
    from public.service_offerings
  ),
  booking_metrics as (
    select
      count(*) as bookings_created,
      count(*) filter (where status::text = 'CONFIRMED') as bookings_confirmed,
      count(*) filter (where status::text = 'COMPLETED') as bookings_completed,
      count(*) filter (where status::text in ('CANCELLED_BY_STUDENT', 'CANCELLED_BY_PROVIDER')) as bookings_cancelled,
      count(*) filter (where status::text in ('NO_SHOW_STUDENT', 'NO_SHOW_PROVIDER')) as bookings_no_show,
      count(*) filter (where status::text = 'EXPIRED') as bookings_expired
    from public.bookings
    where created_at >= p_date_from and created_at < p_date_to
  ),
  quote_metrics as (
    select count(*) as quotes_created
    from public.quotes
    where created_at >= p_date_from and created_at < p_date_to
  ),
  payment_metrics as (
    select
      count(*) as payments_created,
      count(*) filter (where p.status::text = 'PAID') as payments_paid,
      coalesce(sum(p.amount_in_cents) filter (where p.status::text = 'PAID'), 0)::bigint as paid_volume_cents,
      coalesce(sum(b.platform_fee_in_cents) filter (where p.status::text = 'PAID'), 0)::bigint as platform_fee_volume_cents
    from public.payments p
    left join public.bookings b on b.id = p.booking_id
    where p.created_at >= p_date_from and p.created_at < p_date_to
  ),
  refund_metrics as (
    select coalesce(sum(amount_in_cents), 0)::bigint as refund_volume_cents
    from public.refunds
    where created_at >= p_date_from and created_at < p_date_to
  ),
  payout_metrics as (
    select
      coalesce(sum(amount_in_cents) filter (where status::text in ('PENDING', 'SCHEDULED')), 0)::bigint as payout_pending_cents,
      coalesce(sum(amount_in_cents) filter (where status::text in ('PAID', 'RELEASED')), 0)::bigint as payout_paid_cents
    from public.payouts
    where created_at >= p_date_from and created_at < p_date_to
  ),
  review_metrics as (
    select
      count(*) as reviews_created,
      round(avg(rating_overall)::numeric, 2) as rating_average
    from public.reviews
    where created_at >= p_date_from and created_at < p_date_to
  ),
  engagement_metrics as (
    select
      count(*) filter (where event_name = 'PROVIDER_SEARCH') as provider_searches,
      count(*) filter (where event_name = 'PROVIDER_PROFILE_VIEW') as provider_profile_views,
      count(*) filter (where event_name = 'AVAILABLE_SLOTS_VIEW') as available_slots_views,
      count(*) filter (where event_name = 'CHECKOUT_STARTED') as checkout_started
    from public.analytics_events
    where created_at >= p_date_from and created_at < p_date_to
  )
  select jsonb_build_object(
    'period', jsonb_build_object(
      'from', p_date_from,
      'to', p_date_to,
      'timezone', 'America/Sao_Paulo'
    ),
    'users', jsonb_build_object(
      'active_students', u.active_students,
      'active_instructor_users', u.active_instructor_users,
      'active_school_admin_users', u.active_school_admin_users,
      'active_users_total', u.active_users_total
    ),
    'supply', jsonb_build_object(
      'active_providers', s.active_providers,
      'active_individual_providers', s.active_individual_providers,
      'active_driving_schools', s.active_driving_schools,
      'active_vehicles', v.active_vehicles,
      'active_offerings', o.active_offerings
    ),
    'bookings', jsonb_build_object(
      'created', b.bookings_created,
      'confirmed', b.bookings_confirmed,
      'completed', b.bookings_completed,
      'cancelled', b.bookings_cancelled,
      'no_show', b.bookings_no_show,
      'expired', b.bookings_expired
    ),
    'funnel', jsonb_build_object(
      'quotes_created', q.quotes_created,
      'bookings_created', b.bookings_created,
      'payments_created', pm.payments_created,
      'payments_paid', pm.payments_paid,
      'quote_to_booking_rate', case when q.quotes_created > 0 then round((b.bookings_created::numeric / q.quotes_created::numeric), 4) else null end,
      'booking_to_paid_rate', case when b.bookings_created > 0 then round((pm.payments_paid::numeric / b.bookings_created::numeric), 4) else null end
    ),
    'financial_dev', jsonb_build_object(
      'paid_volume_cents', pm.paid_volume_cents,
      'platform_fee_volume_cents', pm.platform_fee_volume_cents,
      'refund_volume_cents', rf.refund_volume_cents,
      'payout_pending_cents', po.payout_pending_cents,
      'payout_paid_cents', po.payout_paid_cents,
      'label', 'Ambiente DEV — pagamentos simulados'
    ),
    'quality', jsonb_build_object(
      'reviews_created', r.reviews_created,
      'rating_average', r.rating_average
    ),
    'engagement', jsonb_build_object(
      'provider_searches', e.provider_searches,
      'provider_profile_views', e.provider_profile_views,
      'available_slots_views', e.available_slots_views,
      'checkout_started', e.checkout_started
    )
  )
  into v_result
  from users_metrics u, supply_metrics s, vehicle_metrics v, offering_metrics o,
       booking_metrics b, quote_metrics q, payment_metrics pm, refund_metrics rf,
       payout_metrics po, review_metrics r, engagement_metrics e;

  return v_result;
end;
$$;

create or replace function public.get_provider_analytics_summary(
  p_date_from timestamptz,
  p_date_to timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if not public.is_current_user_active() then
    raise exception 'USER_NOT_ACTIVE' using errcode = '42501';
  end if;

  if p_date_from is null or p_date_to is null or p_date_to <= p_date_from then
    raise exception 'INVALID_ANALYTICS_PERIOD' using errcode = '22023';
  end if;

  with
  authorized_providers as (
    select distinct p.id
    from public.providers p
    where
      p.user_id = auth.uid()
      or public.is_school_member(p.id)
      or exists (
        select 1
        from public.driving_school_staff dss
        where dss.school_id = p.id
          and dss.user_id = auth.uid()
          and dss.is_active is true
      )
      or exists (
        select 1
        from public.bookings b
        where b.provider_id = p.id
          and b.instructor_id = auth.uid()
      )
  ),
  booking_metrics as (
    select
      count(*) as bookings_created,
      count(*) filter (where status::text = 'CONFIRMED') as bookings_confirmed,
      count(*) filter (where status::text = 'COMPLETED') as bookings_completed,
      count(*) filter (where status::text in ('CANCELLED_BY_STUDENT', 'CANCELLED_BY_PROVIDER')) as bookings_cancelled,
      count(*) filter (where status::text in ('NO_SHOW_STUDENT', 'NO_SHOW_PROVIDER')) as bookings_no_show,
      count(*) filter (where status::text = 'CONFIRMED' and scheduled_start_at >= now()) as upcoming_bookings
    from public.bookings
    where provider_id in (select id from authorized_providers)
      and created_at >= p_date_from
      and created_at < p_date_to
  ),
  payment_metrics as (
    select
      count(*) filter (where p.status::text = 'PAID') as payments_paid,
      coalesce(sum(p.amount_in_cents) filter (where p.status::text = 'PAID'), 0)::bigint as paid_volume_cents,
      coalesce(sum(b.platform_fee_in_cents) filter (where p.status::text = 'PAID'), 0)::bigint as platform_fee_volume_cents
    from public.payments p
    join public.bookings b on b.id = p.booking_id
    where b.provider_id in (select id from authorized_providers)
      and p.created_at >= p_date_from
      and p.created_at < p_date_to
  ),
  review_metrics as (
    select
      count(*) as reviews_count,
      round(avg(rating_overall)::numeric, 2) as rating_average
    from public.reviews
    where provider_id in (select id from authorized_providers)
  ),
  supply_metrics as (
    select
      (select count(*) from authorized_providers) as provider_contexts,
      count(distinct v.id) filter (where v.status::text = 'ACTIVE' and v.deleted_at is null) as active_vehicles,
      count(distinct so.id) filter (where so.status::text = 'ACTIVE' and so.is_active is true) as active_offerings
    from authorized_providers ap
    left join public.vehicles v on v.provider_id = ap.id
    left join public.service_offerings so on so.provider_id = ap.id
  )
  select jsonb_build_object(
    'period', jsonb_build_object(
      'from', p_date_from,
      'to', p_date_to,
      'timezone', 'America/Sao_Paulo'
    ),
    'provider_contexts', s.provider_contexts,
    'bookings', jsonb_build_object(
      'created', b.bookings_created,
      'confirmed', b.bookings_confirmed,
      'completed', b.bookings_completed,
      'cancelled', b.bookings_cancelled,
      'no_show', b.bookings_no_show,
      'upcoming', b.upcoming_bookings
    ),
    'financial_dev', jsonb_build_object(
      'payments_paid', pm.payments_paid,
      'paid_volume_cents', pm.paid_volume_cents,
      'platform_fee_volume_cents', pm.platform_fee_volume_cents,
      'label', 'Ambiente DEV — pagamentos simulados'
    ),
    'quality', jsonb_build_object(
      'reviews_count', r.reviews_count,
      'rating_average', r.rating_average
    ),
    'supply', jsonb_build_object(
      'active_vehicles', s.active_vehicles,
      'active_offerings', s.active_offerings
    )
  )
  into v_result
  from booking_metrics b, payment_metrics pm, review_metrics r, supply_metrics s;

  return v_result;
end;
$$;

revoke all on function public.track_analytics_event(text, jsonb) from public;
revoke all on function public.track_analytics_event(text, jsonb) from anon;
revoke all on function public.track_analytics_event(text, jsonb) from authenticated;
grant execute on function public.track_analytics_event(text, jsonb) to authenticated;

revoke all on function public.get_admin_analytics_summary(timestamptz, timestamptz) from public;
revoke all on function public.get_admin_analytics_summary(timestamptz, timestamptz) from anon;
revoke all on function public.get_admin_analytics_summary(timestamptz, timestamptz) from authenticated;
grant execute on function public.get_admin_analytics_summary(timestamptz, timestamptz) to authenticated;

revoke all on function public.get_provider_analytics_summary(timestamptz, timestamptz) from public;
revoke all on function public.get_provider_analytics_summary(timestamptz, timestamptz) from anon;
revoke all on function public.get_provider_analytics_summary(timestamptz, timestamptz) from authenticated;
grant execute on function public.get_provider_analytics_summary(timestamptz, timestamptz) to authenticated;
