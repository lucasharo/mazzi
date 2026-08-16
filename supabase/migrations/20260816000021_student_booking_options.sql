-- Securely persist the student's selected meeting point without allowing the
-- client to overwrite provider/instructor/booking ownership fields.
create or replace function public.create_booking_hold_at_meeting_point(
  p_quote_id uuid,
  p_student_id uuid,
  p_idempotency_key varchar default null,
  p_meeting_point jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_booking_id uuid;
  v_point jsonb;
  v_quote record;
begin
  if auth.uid() is null or auth.uid() <> p_student_id then
    raise exception 'STUDENT_ACCESS_DENIED' using errcode = '42501';
  end if;
  if coalesce(p_meeting_point->>'type', '') = 'STUDENT_ADDRESS' then
    if nullif(btrim(p_meeting_point->>'address'), '') is null then
      raise exception 'STUDENT_ADDRESS_REQUIRED' using errcode = '22023';
    end if;
    v_point := jsonb_build_object('type', 'STUDENT_ADDRESS', 'label', btrim(p_meeting_point->>'address'));
  elsif coalesce(p_meeting_point->>'type', '') = 'PROVIDER_ADDRESS' then
    select q.provider_id, p.neighborhood, p.city into v_quote
    from public.quotes q join public.providers p on p.id = q.provider_id
    where q.id = p_quote_id and q.student_id = auth.uid();
    if not found then raise exception 'QUOTE_NOT_FOUND' using errcode = 'P0002'; end if;
    v_point := jsonb_build_object('type', 'PROVIDER_ADDRESS', 'label', concat_ws(', ', v_quote.neighborhood, v_quote.city));
  else
    raise exception 'MEETING_POINT_TYPE_INVALID' using errcode = '22023';
  end if;
  v_result := public.create_booking_hold(p_quote_id, p_student_id, p_idempotency_key, 10);
  v_booking_id := (v_result->>'booking_id')::uuid;
  update public.bookings set meeting_point = v_point where id = v_booking_id and student_id = auth.uid();
  return v_result;
end;
$$;

revoke all on function public.create_booking_hold_at_meeting_point(uuid, uuid, varchar, jsonb) from public, anon;
grant execute on function public.create_booking_hold_at_meeting_point(uuid, uuid, varchar, jsonb) to authenticated;
