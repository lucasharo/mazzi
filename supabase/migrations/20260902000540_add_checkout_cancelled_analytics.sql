-- MAZZI — Track explicit checkout cancellations separately from checkout starts.

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
    'email', 'phone', 'cpf', 'cnpj', 'document', 'document_number',
    'renavam', 'license_plate', 'plate', 'chat', 'message', 'review_comment',
    'comment', 'jwt', 'token', 'payment_token', 'card', 'cvv', 'latitude',
    'longitude', 'lat', 'lng', 'ip', 'fingerprint', 'device_id',
    'student_name', 'provider_phone'
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
    'CHECKOUT_STARTED',
    'CHECKOUT_CANCELLED'
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

create or replace function public.get_admin_checkout_cancelled_count(
  p_date_from timestamptz,
  p_date_to timestamptz
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count bigint;
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

  select count(*)
    into v_count
    from public.analytics_events
   where event_name = 'CHECKOUT_CANCELLED'
     and created_at >= p_date_from
     and created_at < p_date_to;

  return v_count;
end;
$$;

revoke all on function public.track_analytics_event(text, jsonb) from public;
revoke all on function public.track_analytics_event(text, jsonb) from anon;
revoke all on function public.track_analytics_event(text, jsonb) from authenticated;
grant execute on function public.track_analytics_event(text, jsonb) to authenticated;

revoke all on function public.get_admin_checkout_cancelled_count(timestamptz, timestamptz) from public;
revoke all on function public.get_admin_checkout_cancelled_count(timestamptz, timestamptz) from anon;
revoke all on function public.get_admin_checkout_cancelled_count(timestamptz, timestamptz) from authenticated;
grant execute on function public.get_admin_checkout_cancelled_count(timestamptz, timestamptz) to authenticated;
