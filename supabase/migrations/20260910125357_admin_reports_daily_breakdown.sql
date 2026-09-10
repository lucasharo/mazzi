-- TASK-095: daily operational report breakdown and payment outcome split.
create or replace function public.get_admin_report_daily(
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
  days as (
    select generate_series(
      (p_date_from at time zone 'America/Sao_Paulo')::date,
      ((p_date_to - interval '1 microsecond') at time zone 'America/Sao_Paulo')::date,
      interval '1 day'
    )::date as report_date
  ),
  bookings_daily as (
    select
      (b.created_at at time zone 'America/Sao_Paulo')::date as report_date,
      count(*)::bigint as bookings_created,
      count(*) filter (where b.status::text = 'COMPLETED')::bigint as bookings_completed,
      count(*) filter (where b.status::text like 'CANCELLED%')::bigint as bookings_cancelled,
      count(*) filter (where coalesce(b.snapshot_data->>'source', '') in ('AULA_AGORA', 'INSTANT'))::bigint as instant_bookings
    from public.bookings b
    where b.created_at >= p_date_from and b.created_at < p_date_to
    group by 1
  ),
  cancellations_daily as (
    select
      (b.created_at at time zone 'America/Sao_Paulo')::date as report_date,
      count(distinct b.id) filter (
        where b.status::text like 'CANCELLED%'
          and exists (
            select 1
            from public.payments paid_payment
            where paid_payment.booking_id = b.id
              and paid_payment.status::text = 'PAID'
          )
      )::bigint as cancellations_after_paid,
      coalesce(sum(r.amount_in_cents) filter (
        where r.id is not null
          and b.status::text like 'CANCELLED%'
          and exists (
            select 1
            from public.payments paid_payment
            where paid_payment.booking_id = b.id
              and paid_payment.status::text = 'PAID'
          )
      ), 0)::bigint as cancellation_refunds_cents
    from public.bookings b
    left join public.refunds r on r.booking_id = b.id
    where b.created_at >= p_date_from and b.created_at < p_date_to
    group by 1
  ),
  payment_abandonments_daily as (
    select
      (p.created_at at time zone 'America/Sao_Paulo')::date as report_date,
      count(*)::bigint as payment_abandonments,
      coalesce(sum(p.amount_in_cents), 0)::bigint as payment_abandonment_amount_cents
    from public.payments p
    where p.created_at >= p_date_from and p.created_at < p_date_to
      and p.status::text in ('FAILED', 'CANCELLED', 'EXPIRED')
      and not exists (
        select 1
        from public.payments paid_payment
        where paid_payment.booking_id = p.booking_id
          and paid_payment.status::text = 'PAID'
      )
    group by 1
  ),
  payments_daily as (
    select
      (p.created_at at time zone 'America/Sao_Paulo')::date as report_date,
      coalesce(sum(p.amount_in_cents), 0)::bigint as gross_volume_cents,
      coalesce(sum(p.amount_in_cents) filter (where p.status::text = 'PAID'), 0)::bigint as paid_volume_cents
    from public.payments p
    where p.created_at >= p_date_from and p.created_at < p_date_to
    group by 1
  ),
  refunds_daily as (
    select
      (r.created_at at time zone 'America/Sao_Paulo')::date as report_date,
      coalesce(sum(r.amount_in_cents), 0)::bigint as refunds_cents
    from public.refunds r
    where r.created_at >= p_date_from and r.created_at < p_date_to
    group by 1
  ),
  payouts_daily as (
    select
      (p.created_at at time zone 'America/Sao_Paulo')::date as report_date,
      coalesce(sum(p.amount_in_cents), 0)::bigint as payouts_cents
    from public.payouts p
    where p.created_at >= p_date_from and p.created_at < p_date_to
    group by 1
  ),
  supply_daily as (
    select
      d.report_date,
      coalesce(pr.providers_created, 0)::bigint as providers_created,
      coalesce(v.vehicles_created, 0)::bigint as vehicles_created,
      coalesce(o.offerings_created, 0)::bigint as offerings_created
    from days d
    left join (
      select (p.created_at at time zone 'America/Sao_Paulo')::date as report_date, count(*)::bigint as providers_created
      from public.providers p
      where p.created_at >= p_date_from and p.created_at < p_date_to
      group by 1
    ) pr using (report_date)
    left join (
      select (v.created_at at time zone 'America/Sao_Paulo')::date as report_date, count(*)::bigint as vehicles_created
      from public.vehicles v
      where v.created_at >= p_date_from and v.created_at < p_date_to
      group by 1
    ) v using (report_date)
    left join (
      select (o.created_at at time zone 'America/Sao_Paulo')::date as report_date, count(*)::bigint as offerings_created
      from public.service_offerings o
      where o.created_at >= p_date_from and o.created_at < p_date_to
      group by 1
    ) o using (report_date)
  ),
  demand_daily as (
    select
      (a.created_at at time zone 'America/Sao_Paulo')::date as report_date,
      count(*) filter (where a.event_name = 'PROVIDER_SEARCH')::bigint as provider_searches,
      count(*) filter (where a.event_name = 'PROVIDER_PROFILE_VIEW')::bigint as provider_profile_views,
      count(*) filter (where a.event_name = 'AVAILABLE_SLOTS_VIEW')::bigint as available_slots_views,
      count(*) filter (where a.event_name = 'CHECKOUT_STARTED')::bigint as checkout_started,
      count(*) filter (
        where a.event_name = 'PROVIDER_SEARCH'
          and (a.properties->>'result_count' = '0' or a.properties->>'provider_count' = '0')
      )::bigint as searches_without_result
    from public.analytics_events a
    where a.created_at >= p_date_from and a.created_at < p_date_to
    group by 1
  ),
  users_daily as (
    select
      (u.created_at at time zone 'America/Sao_Paulo')::date as report_date,
      count(*)::bigint as new_users,
      count(*) filter (where u.role::text = 'STUDENT')::bigint as students_created,
      count(*) filter (where u.role::text = 'INSTRUCTOR')::bigint as instructors_created,
      count(*) filter (where u.role::text = 'SCHOOL_ADMIN')::bigint as school_admins_created
    from public.users u
    where u.created_at >= p_date_from and u.created_at < p_date_to
    group by 1
  ),
  compliance_daily as (
    select
      (c.created_at at time zone 'America/Sao_Paulo')::date as report_date,
      count(*)::bigint as compliance_submitted,
      count(*) filter (where c.status::text = 'APPROVED')::bigint as compliance_approved,
      count(*) filter (where c.status::text in ('PENDING', 'IN_REVIEW'))::bigint as compliance_pending,
      count(*) filter (where c.status::text in ('REJECTED', 'EXPIRED'))::bigint as compliance_rejected
    from public.compliance_documents c
    where c.created_at >= p_date_from and c.created_at < p_date_to
    group by 1
  ),
  notifications_daily as (
    select
      (n.created_at at time zone 'America/Sao_Paulo')::date as report_date,
      count(*)::bigint as notifications_created,
      count(*) filter (where n.is_read is false)::bigint as notifications_unread
    from public.notifications n
    where n.created_at >= p_date_from and n.created_at < p_date_to
    group by 1
  ),
  cancellations_events_daily as (
    select
      d.report_date,
      coalesce(o.disputes_opened, 0)::bigint as disputes_opened,
      coalesce(r.disputes_resolved, 0)::bigint as disputes_resolved
    from days d
    left join (
      select (bd.created_at at time zone 'America/Sao_Paulo')::date as report_date, count(*)::bigint as disputes_opened
      from public.booking_disputes bd
      where bd.created_at >= p_date_from and bd.created_at < p_date_to
      group by 1
    ) o using (report_date)
    left join (
      select (bd.resolved_at at time zone 'America/Sao_Paulo')::date as report_date, count(*)::bigint as disputes_resolved
      from public.booking_disputes bd
      where bd.resolved_at >= p_date_from and bd.resolved_at < p_date_to
      group by 1
    ) r using (report_date)
  ),
  emails_daily as (
    select
      (e.created_at at time zone 'America/Sao_Paulo')::date as report_date,
      count(*)::bigint as emails_created,
      count(*) filter (where e.status = 'SENT')::bigint as emails_sent,
      count(*) filter (where e.status = 'FAILED')::bigint as emails_failed
    from public.email_deliveries e
    where e.created_at >= p_date_from and e.created_at < p_date_to
    group by 1
  ),
  daily_metrics as (
    select
      d.report_date,
      coalesce(b.bookings_created, 0)::bigint as bookings_created,
      coalesce(b.bookings_completed, 0)::bigint as bookings_completed,
      coalesce(b.bookings_cancelled, 0)::bigint as bookings_cancelled,
      coalesce(b.instant_bookings, 0)::bigint as instant_bookings,
      coalesce(c.cancellations_after_paid, 0)::bigint as cancellations_after_paid,
      coalesce(c.cancellation_refunds_cents, 0)::bigint as cancellation_refunds_cents,
      coalesce(a.payment_abandonments, 0)::bigint as payment_abandonments,
      coalesce(a.payment_abandonment_amount_cents, 0)::bigint as payment_abandonment_amount_cents,
      coalesce(p.gross_volume_cents, 0)::bigint as gross_volume_cents,
      coalesce(p.paid_volume_cents, 0)::bigint as paid_volume_cents,
      coalesce(r.refunds_cents, 0)::bigint as refunds_cents,
      coalesce(po.payouts_cents, 0)::bigint as payouts_cents,
      coalesce(s.providers_created, 0)::bigint as providers_created,
      coalesce(s.vehicles_created, 0)::bigint as vehicles_created,
      coalesce(s.offerings_created, 0)::bigint as offerings_created,
      coalesce(de.provider_searches, 0)::bigint as provider_searches,
      coalesce(de.provider_profile_views, 0)::bigint as provider_profile_views,
      coalesce(de.available_slots_views, 0)::bigint as available_slots_views,
      coalesce(de.checkout_started, 0)::bigint as checkout_started,
      coalesce(de.searches_without_result, 0)::bigint as searches_without_result,
      coalesce(u.new_users, 0)::bigint as new_users,
      coalesce(u.students_created, 0)::bigint as students_created,
      coalesce(u.instructors_created, 0)::bigint as instructors_created,
      coalesce(u.school_admins_created, 0)::bigint as school_admins_created,
      coalesce(cd.compliance_submitted, 0)::bigint as compliance_submitted,
      coalesce(cd.compliance_approved, 0)::bigint as compliance_approved,
      coalesce(cd.compliance_pending, 0)::bigint as compliance_pending,
      coalesce(cd.compliance_rejected, 0)::bigint as compliance_rejected,
      coalesce(ce.disputes_opened, 0)::bigint as disputes_opened,
      coalesce(ce.disputes_resolved, 0)::bigint as disputes_resolved,
      coalesce(n.notifications_created, 0)::bigint as notifications_created,
      coalesce(n.notifications_unread, 0)::bigint as notifications_unread,
      coalesce(e.emails_created, 0)::bigint as emails_created,
      coalesce(e.emails_sent, 0)::bigint as emails_sent,
      coalesce(e.emails_failed, 0)::bigint as emails_failed
    from days d
    left join bookings_daily b using (report_date)
    left join cancellations_daily c using (report_date)
    left join payment_abandonments_daily a using (report_date)
    left join payments_daily p using (report_date)
    left join refunds_daily r using (report_date)
    left join payouts_daily po using (report_date)
    left join supply_daily s using (report_date)
    left join demand_daily de using (report_date)
    left join users_daily u using (report_date)
    left join compliance_daily cd using (report_date)
    left join cancellations_events_daily ce using (report_date)
    left join notifications_daily n using (report_date)
    left join emails_daily e using (report_date)
  )
  select jsonb_build_object(
    'daily', coalesce((
      select jsonb_agg(to_jsonb(dm) order by dm.report_date)
      from daily_metrics dm
    ), '[]'::jsonb),
    'payment_outcomes', jsonb_build_object(
      'cancellations_after_paid', coalesce((select sum(dm.cancellations_after_paid) from daily_metrics dm), 0)::bigint,
      'cancellation_refunds_cents', coalesce((select sum(dm.cancellation_refunds_cents) from daily_metrics dm), 0)::bigint,
      'payment_abandonments', coalesce((select sum(dm.payment_abandonments) from daily_metrics dm), 0)::bigint,
      'payment_abandonment_amount_cents', coalesce((select sum(dm.payment_abandonment_amount_cents) from daily_metrics dm), 0)::bigint
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_admin_report_daily(timestamptz, timestamptz) from public;
revoke all on function public.get_admin_report_daily(timestamptz, timestamptz) from anon;
revoke all on function public.get_admin_report_daily(timestamptz, timestamptz) from authenticated;
grant execute on function public.get_admin_report_daily(timestamptz, timestamptz) to authenticated;
