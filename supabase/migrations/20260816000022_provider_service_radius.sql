create or replace function public.set_provider_service_radius(
  p_provider_id uuid,
  p_radius_km integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or p_radius_km is null or p_radius_km < 1 or p_radius_km > 100 then
    raise exception 'SERVICE_RADIUS_INVALID' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.providers p
    where p.id = p_provider_id
      and (p.user_id = auth.uid() or exists (
        select 1 from public.driving_school_staff s
        where s.school_id = p.id and s.user_id = auth.uid()
          and s.is_active = true and s.role in ('OWNER', 'SCHOOL_ADMIN')
      ))
  ) then
    raise exception 'PROVIDER_PROFILE_ACCESS_DENIED' using errcode = '42501';
  end if;
  update public.providers set service_radius_km = p_radius_km, updated_at = now()
  where id = p_provider_id;
end;
$$;

revoke all on function public.set_provider_service_radius(uuid, integer) from public, anon;
grant execute on function public.set_provider_service_radius(uuid, integer) to authenticated;
