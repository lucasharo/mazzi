-- ============================================================================
-- MAZZI — Sprint 15: Security + QA Hardening
-- ============================================================================
-- This migration intentionally does not add product features.
-- It hardens known attack surfaces found by Supabase Security Advisor and
-- real policy audit while preserving existing MVP flows.

-- ---------------------------------------------------------------------------
-- 1. Harden legacy sanitized provider view.
-- ---------------------------------------------------------------------------
-- The runtime search flow uses search_providers_public/get_provider_booking_context_public.
-- This legacy view is not used by the app and must not bypass provider RLS.
-- Do not grant direct base-table SELECT on public.providers to anon/authenticated,
-- because providers contains private fields such as document_number/phone.
create or replace view public.providers_public_view
with (security_invoker = true)
as
select
  p.id,
  p.user_id,
  p.trade_name as display_name,
  p.avatar_url,
  p.type as provider_type,
  p.bio,
  p.rating_average,
  p.rating_count,
  p.neighborhood,
  p.city,
  p.state,
  p.service_radius_km,
  p.status,
  p.status = 'ACTIVE'::provider_status as is_verified,
  p.created_at
from public.providers p
where p.status = 'ACTIVE'::provider_status;

revoke all on public.providers_public_view from public;
revoke all on public.providers_public_view from anon;
revoke all on public.providers_public_view from authenticated;

-- ---------------------------------------------------------------------------
-- 2. Fix historical service_offerings tautological RLS policy.
-- ---------------------------------------------------------------------------
-- Old policy effectively compared the vehicle provider column to itself.
-- The consolidated "Providers can manage own service offerings" policy already
-- enforces provider ownership / school admin / platform admin with WITH CHECK.
drop policy if exists offerings_owner_insert on public.service_offerings;
drop policy if exists offerings_owner_update on public.service_offerings;
drop policy if exists "Providers can manage own service offerings" on public.service_offerings;

-- Keep explicit safe policies for clients that use direct service_offerings
-- mutations. These policies are narrower than the historical public policies.
create policy offerings_owner_insert
  on public.service_offerings
  for insert
  to authenticated
  with check (
    (select public.is_current_user_active())
    and (
      provider_id in (
        select p.id
        from public.providers p
        where p.user_id = (select auth.uid())
      )
      or (select public.is_school_admin(provider_id))
      or (select public.is_platform_admin())
    )
    and vehicle_id in (
      select v.id
      from public.vehicles v
      where v.provider_id = service_offerings.provider_id
        and v.deleted_at is null
    )
  );

create policy offerings_owner_update
  on public.service_offerings
  for update
  to authenticated
  using (
    (select public.is_current_user_active())
    and (
      provider_id in (
        select p.id
        from public.providers p
        where p.user_id = (select auth.uid())
      )
      or (select public.is_school_admin(provider_id))
      or (select public.is_platform_admin())
    )
  )
  with check (
    (select public.is_current_user_active())
    and (
      provider_id in (
        select p.id
        from public.providers p
        where p.user_id = (select auth.uid())
      )
      or (select public.is_school_admin(provider_id))
      or (select public.is_platform_admin())
    )
    and vehicle_id in (
      select v.id
      from public.vehicles v
      where v.provider_id = service_offerings.provider_id
        and v.deleted_at is null
    )
  );

grant insert, update on table public.service_offerings to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Harden vehicle mutation policies against unsafe auth.jwt role checks and
-- missing WITH CHECK.
-- ---------------------------------------------------------------------------
drop policy if exists vehicles_public_select on public.vehicles;
drop policy if exists vehicles_owner_select on public.vehicles;
drop policy if exists vehicles_owner_insert on public.vehicles;
drop policy if exists vehicles_owner_update on public.vehicles;

create policy vehicles_owner_select
  on public.vehicles
  for select
  to authenticated
  using (
    (select public.is_current_user_active())
    and (
      provider_id in (
        select p.id
        from public.providers p
        where p.user_id = (select auth.uid())
      )
      or (select public.is_school_admin(provider_id))
      or (select public.is_platform_admin())
    )
  );

create policy vehicles_owner_insert
  on public.vehicles
  for insert
  to authenticated
  with check (
    (select public.is_current_user_active())
    and (
      provider_id in (
        select p.id
        from public.providers p
        where p.user_id = (select auth.uid())
      )
      or (select public.is_school_admin(provider_id))
      or (select public.is_platform_admin())
    )
  );

create policy vehicles_owner_update
  on public.vehicles
  for update
  to authenticated
  using (
    (select public.is_current_user_active())
    and (
      provider_id in (
        select p.id
        from public.providers p
        where p.user_id = (select auth.uid())
      )
      or (select public.is_school_admin(provider_id))
      or (select public.is_platform_admin())
    )
  )
  with check (
    (select public.is_current_user_active())
    and (
      provider_id in (
        select p.id
        from public.providers p
        where p.user_id = (select auth.uid())
      )
      or (select public.is_school_admin(provider_id))
      or (select public.is_platform_admin())
    )
  );

grant insert, update on table public.vehicles to authenticated;
grant select on table public.vehicles to authenticated;
revoke select on table public.vehicles from anon;

create or replace function public.get_public_vehicle_catalog()
returns table (
  id uuid,
  provider_id uuid,
  brand varchar,
  model varchar,
  year integer,
  license_plate varchar,
  license_plate_masked varchar,
  category public.vehicle_category,
  vehicle_type public.vehicle_type,
  transmission public.vehicle_transmission,
  status public.vehicle_status,
  color varchar,
  photos text[],
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    v.id,
    v.provider_id,
    v.brand,
    v.model,
    v.year,
    case
      when public.is_platform_admin()
        or public.is_school_admin(v.provider_id)
        or exists (
          select 1
          from public.providers p
          where p.id = v.provider_id
            and p.user_id = auth.uid()
        )
      then v.license_plate
      else coalesce(v.license_plate_masked, '***-****')
    end as license_plate,
    coalesce(v.license_plate_masked, '***-****') as license_plate_masked,
    v.category,
    v.vehicle_type,
    v.transmission,
    v.status,
    v.color,
    v.photos,
    v.created_at,
    v.updated_at,
    v.deleted_at
  from public.vehicles v
  where
    (
      v.status = 'ACTIVE'::public.vehicle_status
      and v.deleted_at is null
    )
    or public.is_platform_admin()
    or public.is_school_admin(v.provider_id)
    or exists (
      select 1
      from public.providers p
      where p.id = v.provider_id
        and p.user_id = auth.uid()
    );
$$;

revoke all on function public.get_public_vehicle_catalog() from public;
grant execute on function public.get_public_vehicle_catalog() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Explicit deny policies for server-only/config tables.
-- ---------------------------------------------------------------------------
-- This documents intentional direct-client denial and removes "RLS enabled with
-- no policy" ambiguity without making these tables readable or writable.
do $$
declare
  t text;
begin
  foreach t in array array[
    'audit_logs',
    'refunds',
    'payouts',
    'platform_configurations',
    'cancellation_policies',
    'cancellation_policy_rules'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_no_direct_client_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_no_direct_client_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_no_direct_client_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_no_direct_client_delete', t);

    execute format('create policy %I on public.%I for select using (false)', t || '_no_direct_client_select', t);
    execute format('create policy %I on public.%I for insert with check (false)', t || '_no_direct_client_insert', t);
    execute format('create policy %I on public.%I for update using (false) with check (false)', t || '_no_direct_client_update', t);
    execute format('create policy %I on public.%I for delete using (false)', t || '_no_direct_client_delete', t);

    execute format('revoke all on table public.%I from public', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('revoke all on table public.%I from authenticated', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Trigger/internal function execute hardening.
-- ---------------------------------------------------------------------------
-- handle_new_auth_user must run only as an auth.users trigger.
revoke all on function public.handle_new_auth_user() from public;
revoke all on function public.handle_new_auth_user() from anon;
revoke all on function public.handle_new_auth_user() from authenticated;

-- Keep public RPCs intentional, but ensure search_path is not empty.
alter function public.get_provider_booking_context_public(uuid)
  set search_path = public, pg_temp;

-- Internal slot helper must remain non-callable through REST.
revoke all on function public.is_offering_slot_available(uuid, timestamptz) from public;
revoke all on function public.is_offering_slot_available(uuid, timestamptz) from anon;
revoke all on function public.is_offering_slot_available(uuid, timestamptz) from authenticated;

-- Preserve Sprint 13 trigger hardening idempotently.
revoke all on function public.create_booking_completion_notifications() from public;
revoke all on function public.create_booking_completion_notifications() from anon;
revoke all on function public.create_booking_completion_notifications() from authenticated;

-- ---------------------------------------------------------------------------
-- 6. Low-risk FK indexes highlighted by Performance Advisor and useful for
-- booking/quote/provider workspace paths.
-- ---------------------------------------------------------------------------
create index if not exists idx_bookings_offering_id on public.bookings (offering_id);
create index if not exists idx_bookings_quote_id on public.bookings (quote_id);
create index if not exists idx_quotes_offering_id on public.quotes (offering_id);
create index if not exists idx_quotes_provider_id on public.quotes (provider_id);
create index if not exists idx_quotes_instructor_id on public.quotes (instructor_id);
create index if not exists idx_quotes_vehicle_id on public.quotes (vehicle_id);
create index if not exists idx_service_offerings_instructor_id on public.service_offerings (instructor_id);
create index if not exists idx_compliance_documents_provider_id on public.compliance_documents (provider_id);
create index if not exists idx_driving_school_staff_user_id on public.driving_school_staff (user_id);
