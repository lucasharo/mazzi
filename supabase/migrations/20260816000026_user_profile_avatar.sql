create or replace function public.update_my_profile(p_name text, p_phone text, p_avatar_url text default null)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or nullif(btrim(p_name), '') is null then raise exception 'PROFILE_NAME_REQUIRED' using errcode='22023'; end if;
  update public.users set name=btrim(p_name), phone=nullif(btrim(p_phone), ''), avatar_url=nullif(btrim(p_avatar_url), ''), updated_at=now() where id=auth.uid() and deleted_at is null;
  if not found then raise exception 'PROFILE_NOT_FOUND' using errcode='P0002'; end if;
end;
$$;
revoke all on function public.update_my_profile(text,text,text) from public, anon;
grant execute on function public.update_my_profile(text,text,text) to authenticated;
