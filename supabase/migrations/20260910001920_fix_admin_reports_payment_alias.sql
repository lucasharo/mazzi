-- Fix the payment report query after the first DEV smoke test.
create or replace function public.get_admin_reports(
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
    raise exception 'INVALID_REPORT_PERIOD' using errcode = '22023';
  end if;

  if p_date_to - p_date_from > interval '366 days' then
    raise exception 'REPORT_PERIOD_TOO_LARGE' using errcode = '22023';
  end if;

  with
  bookings_period as (
    select *
    from public.bookings
    where created_at >= p_date_from and created_at < p_date_to
  ),
  payments_period as (
    select *
    from public.payments
    where created_at >= p_date_from and created_at < p_date_to
  ),
  payouts_period as (
    select *
    from public.payouts
    where created_at >= p_date_from and created_at < p_date_to
  ),
  executive as (
    select public.get_admin_analytics_summary(p_date_from, p_date_to) as data
  ),
  bookings_report as (
    select jsonb_build_object(
      'summary', jsonb_build_object(
        'created', count(*),
        'confirmed', count(*) filter (where status::text = 'CONFIRMED'),
        'completed', count(*) filter (where status::text = 'COMPLETED'),
        'cancelled', count(*) filter (where status::text like 'CANCELLED%'),
        'expired', count(*) filter (where status::text = 'EXPIRED'),
        'instant_lesson', count(*) filter (where coalesce(snapshot_data->>'source', '') in ('AULA_AGORA', 'INSTANT'))
      ),
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object('label', status, 'count', total) order by total desc, status)
        from (
          select coalesce(status::text, 'UNKNOWN') as status, count(*) as total
          from bookings_period
          group by status::text
        ) grouped
      ), '[]'::jsonb)
    ) as data
    from bookings_period
  ),
  revenue_report as (
    select jsonb_build_object(
      'summary', jsonb_build_object(
        'gross_volume_cents', coalesce(sum(p.amount_in_cents), 0),
        'paid_volume_cents', coalesce(sum(p.amount_in_cents) filter (where p.status::text = 'PAID'), 0),
        'gateway_fee_cents', coalesce(sum(p.gateway_fee_in_cents), 0),
        'platform_fee_cents', coalesce((select sum(b.platform_fee_in_cents) from bookings_period b where exists (select 1 from payments_period paid_payment where paid_payment.booking_id = b.id and paid_payment.status::text = 'PAID')), 0),
        'payments_created', count(*),
        'payments_paid', count(*) filter (where p.status::text = 'PAID'),
        'payments_failed', count(*) filter (where p.status::text in ('FAILED', 'CANCELLED', 'EXPIRED'))
      ),
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object(
          'label', payment_status,
          'count', total,
          'amount_cents', amount_cents
        ) order by total desc, payment_status)
        from (
          select coalesce(p.status::text, 'UNKNOWN') as payment_status,
                 count(*) as total,
                 coalesce(sum(p.amount_in_cents), 0) as amount_cents
          from payments_period p
          group by p.status::text
        ) grouped
      ), '[]'::jsonb)
    ) as data
    from payments_period p
  ),
  payouts_report as (
    select jsonb_build_object(
      'summary', jsonb_build_object(
        'created', count(*),
        'amount_cents', coalesce(sum(amount_in_cents), 0),
        'pending_cents', coalesce(sum(amount_in_cents) filter (where status::text in ('PENDING', 'SCHEDULED')), 0),
        'paid_cents', coalesce(sum(amount_in_cents) filter (where status::text in ('PAID', 'RELEASED')), 0),
        'failed_count', count(*) filter (where status::text in ('FAILED', 'ERROR'))
      ),
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object('label', payout_status, 'count', total, 'amount_cents', amount_cents) order by total desc, payout_status)
        from (
          select coalesce(status::text, 'UNKNOWN') as payout_status,
                 count(*) as total,
                 coalesce(sum(amount_in_cents), 0) as amount_cents
          from payouts_period
          group by status::text
        ) grouped
      ), '[]'::jsonb)
    ) as data
    from payouts_period
  ),
  supply_report as (
    select jsonb_build_object(
      'summary', jsonb_build_object(
        'active_providers', (select count(*) from public.providers where status::text = 'ACTIVE'),
        'new_providers', (select count(*) from public.providers where created_at >= p_date_from and created_at < p_date_to),
        'active_vehicles', (select count(*) from public.vehicles where status::text = 'ACTIVE' and deleted_at is null),
        'new_vehicles', (select count(*) from public.vehicles where created_at >= p_date_from and created_at < p_date_to),
        'active_offerings', (select count(*) from public.service_offerings where status::text = 'ACTIVE' and is_active is true),
        'new_offerings', (select count(*) from public.service_offerings where created_at >= p_date_from and created_at < p_date_to)
      ),
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object('label', provider_type, 'count', total) order by total desc, provider_type)
        from (
          select coalesce(type::text, 'UNKNOWN') as provider_type, count(*) as total
          from public.providers
          where created_at >= p_date_from and created_at < p_date_to
          group by type::text
        ) grouped
      ), '[]'::jsonb)
    ) as data
  ),
  demand_report as (
    select jsonb_build_object(
      'summary', jsonb_build_object(
        'provider_searches', count(*) filter (where event_name = 'PROVIDER_SEARCH'),
        'profile_views', count(*) filter (where event_name = 'PROVIDER_PROFILE_VIEW'),
        'available_slots_views', count(*) filter (where event_name = 'AVAILABLE_SLOTS_VIEW'),
        'checkout_started', count(*) filter (where event_name = 'CHECKOUT_STARTED'),
        'searches_without_result', count(*) filter (
          where event_name = 'PROVIDER_SEARCH'
            and (properties->>'result_count' = '0' or properties->>'provider_count' = '0')
        )
      ),
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object('label', event_name, 'count', total) order by total desc, event_name)
        from (
          select event_name, count(*) as total
          from public.analytics_events
          where created_at >= p_date_from and created_at < p_date_to
          group by event_name
        ) grouped
      ), '[]'::jsonb)
    ) as data
    from public.analytics_events
    where created_at >= p_date_from and created_at < p_date_to
  ),
  users_report as (
    select jsonb_build_object(
      'summary', jsonb_build_object(
        'new_users', count(*) filter (where created_at >= p_date_from and created_at < p_date_to),
        'active_users', count(*) filter (where status::text = 'ACTIVE'),
        'students', count(*) filter (where role::text = 'STUDENT'),
        'instructors', count(*) filter (where role::text = 'INSTRUCTOR'),
        'school_admins', count(*) filter (where role::text = 'SCHOOL_ADMIN'),
        'blocked_or_inactive', count(*) filter (where status::text <> 'ACTIVE')
      ),
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object('label', user_role || ' / ' || user_status, 'count', total) order by total desc, user_role, user_status)
        from (
          select coalesce(role::text, 'UNKNOWN') as user_role,
                 coalesce(status::text, 'UNKNOWN') as user_status,
                 count(*) as total
          from public.users
          where created_at >= p_date_from and created_at < p_date_to
          group by role::text, status::text
        ) grouped
      ), '[]'::jsonb)
    ) as data
    from public.users
  ),
  compliance_report as (
    select jsonb_build_object(
      'summary', jsonb_build_object(
        'submitted', count(*) filter (where created_at >= p_date_from and created_at < p_date_to),
        'approved', count(*) filter (where status::text = 'APPROVED'),
        'pending', count(*) filter (where status::text in ('PENDING', 'IN_REVIEW')),
        'rejected', count(*) filter (where status::text in ('REJECTED', 'EXPIRED')),
        'expiring_in_30_days', count(*) filter (where expires_at >= p_date_from and expires_at < p_date_to + interval '30 days')
      ),
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object('label', document_status, 'count', total) order by total desc, document_status)
        from (
          select coalesce(status::text, 'UNKNOWN') as document_status, count(*) as total
          from public.compliance_documents
          where created_at >= p_date_from and created_at < p_date_to
          group by status::text
        ) grouped
      ), '[]'::jsonb)
    ) as data
    from public.compliance_documents
  ),
  cancellations_report as (
    select jsonb_build_object(
      'summary', jsonb_build_object(
        'cancelled_bookings', (select count(*) from bookings_period where status::text like 'CANCELLED%'),
        'student_cancelled', (select count(*) from bookings_period where status::text = 'CANCELLED_BY_STUDENT'),
        'provider_cancelled', (select count(*) from bookings_period where status::text = 'CANCELLED_BY_PROVIDER'),
        'disputes_opened', (select count(*) from public.booking_disputes where created_at >= p_date_from and created_at < p_date_to),
        'disputes_resolved', (select count(*) from public.booking_disputes where resolved_at >= p_date_from and resolved_at < p_date_to),
        'refunds_cents', (select coalesce(sum(amount_in_cents), 0) from public.refunds where created_at >= p_date_from and created_at < p_date_to)
      ),
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object('label', reason, 'count', total) order by total desc, reason)
        from (
          select coalesce(cancellation_reason, 'SEM_MOTIVO_INFORMADO') as reason, count(*) as total
          from bookings_period
          where status::text like 'CANCELLED%'
          group by cancellation_reason
        ) grouped
      ), '[]'::jsonb)
    ) as data
  ),
  communications_report as (
    select jsonb_build_object(
      'summary', jsonb_build_object(
        'notifications_created', (select count(*) from public.notifications where created_at >= p_date_from and created_at < p_date_to),
        'notifications_unread', (select count(*) from public.notifications where created_at >= p_date_from and created_at < p_date_to and is_read is false),
        'emails_created', (select count(*) from public.email_deliveries where created_at >= p_date_from and created_at < p_date_to),
        'emails_sent', (select count(*) from public.email_deliveries where created_at >= p_date_from and created_at < p_date_to and status = 'SENT'),
        'emails_failed', (select count(*) from public.email_deliveries where created_at >= p_date_from and created_at < p_date_to and status = 'FAILED')
      ),
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object('label', event_type || ' / ' || delivery_status, 'count', total) order by total desc, event_type, delivery_status)
        from (
          select coalesce(event_type, 'UNKNOWN') as event_type,
                 coalesce(status, 'UNKNOWN') as delivery_status,
                 count(*) as total
          from public.email_deliveries
          where created_at >= p_date_from and created_at < p_date_to
          group by event_type, status
        ) grouped
      ), '[]'::jsonb)
    ) as data
  )
  select jsonb_build_object(
    'period', jsonb_build_object(
      'from', p_date_from,
      'to', p_date_to,
      'timezone', 'America/Sao_Paulo'
    ),
    'generated_at', now(),
    'reports', jsonb_build_object(
      'executive', e.data,
      'bookings', br.data,
      'revenue', rr.data,
      'payouts', pr.data,
      'supply', sr.data,
      'demand', dr.data,
      'users', ur.data,
      'compliance', cr.data,
      'cancellations', can.data,
      'communications', cm.data
    )
  )
  into v_result
  from executive e, bookings_report br, revenue_report rr, payouts_report pr,
       supply_report sr, demand_report dr, users_report ur, compliance_report cr,
       cancellations_report can, communications_report cm;

  return v_result;
end;
$$;

revoke all on function public.get_admin_reports(timestamptz, timestamptz) from public;
revoke all on function public.get_admin_reports(timestamptz, timestamptz) from anon;
revoke all on function public.get_admin_reports(timestamptz, timestamptz) from authenticated;
grant execute on function public.get_admin_reports(timestamptz, timestamptz) to authenticated;

