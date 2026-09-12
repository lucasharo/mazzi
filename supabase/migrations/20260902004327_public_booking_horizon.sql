-- MAZZI — Expose only the public booking horizon to the student calendar.
-- The value is configuration data, not private administrative information.

create or replace function public.get_public_booking_horizon_days()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select greatest(
    1,
    least(
      365,
      coalesce(
        (
          select (value->>'max_booking_horizon_days')::integer
          from public.platform_configurations
          where key = 'scheduling_settings'
          limit 1
        ),
        30
      )
    )
  )::integer;
$$;

revoke all on function public.get_public_booking_horizon_days() from public;
revoke all on function public.get_public_booking_horizon_days() from anon;
revoke all on function public.get_public_booking_horizon_days() from authenticated;
grant execute on function public.get_public_booking_horizon_days() to anon, authenticated;
