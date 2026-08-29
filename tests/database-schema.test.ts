import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * CLASSIFICAÇÃO DOS TESTES:
 * - SCHEMA TEST (Validação estática de DDL, tipos, constraints e regras relacionais do PostgreSQL 16)
 * - UNIT TEST (Lógica de validação em TypeScript de conversão de centavos e idempotência)
 * 
 * NOTA DE TRANSPARÊNCIA TÉCNICA:
 * Estes testes validam os arquivos de migração DDL e SQL estaticamente.
 * Em ambiente de CI/CD sem container PostgreSQL ativo, testes de concorrência com locks GiST
 * e políticas ativas são categorizados como STATIC_RLS_VALIDATION / SCHEMA TEST.
 * REAL_RLS_INTEGRATION permanece classificado como RLS_DATABASE_TEST_PENDING até a execução contra contêiner live.
 */
describe('Database Schema & Migration Compliance (Supabase / PostgreSQL 16 + PostGIS)', () => {
  const migration01Path = path.resolve(__dirname, '../supabase/migrations/20260814000001_initial_schema.sql');
  const migration02Path = path.resolve(__dirname, '../supabase/migrations/20260814000002_auth_rbac.sql');
  const migration03Path = path.resolve(__dirname, '../supabase/migrations/20260814000003_auth_security_hardening.sql');
  const migration04Path = path.resolve(__dirname, '../supabase/migrations/20260814000004_providers_compliance.sql');
  const migration05Path = path.resolve(__dirname, '../supabase/migrations/20260814000005_compliance_regulatory_hardening.sql');
  const migration13Path = path.resolve(__dirname, '../supabase/migrations/20260815000013_chat_reviews_notifications.sql');
  const migration14Path = path.resolve(__dirname, '../supabase/migrations/20260815000014_sprint14_analytics.sql');
  const migration15Path = path.resolve(__dirname, '../supabase/migrations/20260815000015_sprint15_security_hardening.sql');
  const migration16Path = path.resolve(__dirname, '../supabase/migrations/20260815000016_sprint15_booking_identity_concurrency_hotfix.sql');
  const seedPath = path.resolve(__dirname, '../supabase/seed.sql');

  it('[SCHEMA TEST] verifies that initial schema migration file exists and is populated', () => {
    expect(fs.existsSync(migration01Path)).toBe(true);
    const sql = fs.readFileSync(migration01Path, 'utf8');
    expect(sql.length).toBeGreaterThan(1000);
  });

  it('[SCHEMA TEST] ensures PostGIS and btree_gist extensions are enabled (and native gen_random_uuid used)', () => {
    const sql = fs.readFileSync(migration01Path, 'utf8');
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS "postgis"');
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS "btree_gist"');
    expect(sql).not.toContain('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  });

  it('[SCHEMA TEST] ensures all financial attributes use integer cents (no float/double)', () => {
    const sql = fs.readFileSync(migration01Path, 'utf8');
    expect(sql).toContain('price_in_cents INTEGER NOT NULL CHECK (price_in_cents > 0)');
    expect(sql).toContain('platform_fee_in_cents INTEGER NOT NULL CHECK (platform_fee_in_cents >= 0)');
    expect(sql).toContain('total_in_cents INTEGER NOT NULL CHECK (total_in_cents > 0)');
    expect(sql).toContain('amount_in_cents INTEGER NOT NULL');

    expect(sql).not.toContain('price_in_cents FLOAT');
    expect(sql).not.toContain('amount_in_cents FLOAT');
    expect(sql).not.toContain('total_in_cents DOUBLE');
  });

  it('[SCHEMA TEST] verifies exclusion constraints for anti-double-booking on PostgreSQL', () => {
    const sql = fs.readFileSync(migration01Path, 'utf8');
    expect(sql).toContain('exclude_instructor_overlapping_bookings');
    expect(sql).toContain('exclude_vehicle_overlapping_bookings');
    expect(sql).toContain('EXCLUDE USING gist');
    expect(sql).toContain("WHERE (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'))");
  });

  it('[SCHEMA TEST] verifies GEOGRAPHY(Point, 4326) and spatial GiST index on provider locations', () => {
    const sql = fs.readFileSync(migration01Path, 'utf8');
    expect(sql).toContain('location GEOGRAPHY(Point, 4326)');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_providers_location_gist ON providers USING GIST (location)');
  });

  it('[SCHEMA TEST] verifies idempotency key uniqueness on payment operations', () => {
    const sql = fs.readFileSync(migration01Path, 'utf8');
    expect(sql).toContain('idempotency_key VARCHAR(255) NOT NULL UNIQUE');
  });

  it('[SCHEMA TEST] verifies Row Level Security (RLS) is enabled on all tables', () => {
    const sql = fs.readFileSync(migration01Path, 'utf8');
    expect(sql).toContain('ALTER TABLE users ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE bookings ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE payments ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE compliance_documents ENABLE ROW LEVEL SECURITY');
  });

  it('[SCHEMA TEST] verifies SPRINT 03 RBAC tables in migration 02', () => {
    expect(fs.existsSync(migration02Path)).toBe(true);
    const sql02 = fs.readFileSync(migration02Path, 'utf8');
    expect(sql02).toContain('CREATE TABLE IF NOT EXISTS user_roles');
    expect(sql02).toContain('CREATE TABLE IF NOT EXISTS role_permissions');
    expect(sql02).toContain('CREATE TABLE IF NOT EXISTS user_custom_permissions');
    expect(sql02).toContain('ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY');
  });

  it('[SCHEMA TEST] verifies SPRINT 03 Security Hardening in migration 03 (Helper functions & non-recursive RLS)', () => {
    expect(fs.existsSync(migration03Path)).toBe(true);
    const sql03 = fs.readFileSync(migration03Path, 'utf8');
    expect(sql03).toContain('is_current_user_active()');
    expect(sql03).toContain('is_school_member(target_school_id UUID)');
    expect(sql03).toContain('is_school_admin(target_school_id UUID)');
    expect(sql03).toContain('is_platform_admin()');
    expect(sql03).toContain('handle_new_auth_user()');
    expect(sql03).toContain('providers_public_view');
    expect(sql03).toContain('SET search_path = public, pg_temp');
  });

  it('[SCHEMA TEST] verifies SPRINT 04 Providers & Compliance in migration 04 (Requirements catalog & hardened RLS)', () => {
    expect(fs.existsSync(migration04Path)).toBe(true);
    const sql04 = fs.readFileSync(migration04Path, 'utf8');
    expect(sql04).toContain('compliance_requirements');
    expect(sql04).toContain('is_provider_owner(target_provider_id UUID)');
    expect(sql04).toContain('is_compliance_reviewer()');
    expect(sql04).toContain('Providers can create initial draft profile');
    expect(sql04).toContain('Providers can read own compliance documents');
    expect(sql04).toContain('Admins can review compliance documents');
    expect(sql04).toContain('SET search_path = public, pg_temp');
  });

  it('[SCHEMA TEST] verifies SPRINT 04 Regulatory Hardening & Storage in migration 05', () => {
    expect(fs.existsSync(migration05Path)).toBe(true);
    const sql05 = fs.readFileSync(migration05Path, 'utf8');
    expect(sql05).toContain('source_type');
    expect(sql05).toContain('source_reference');
    expect(sql05).toContain('last_validated_at');
    expect(sql05).toContain('provider-compliance-docs');
    expect(sql05).toContain('Providers can upload own compliance documents to storage');
    expect(sql05).toContain('Providers and reviewers can read compliance documents from storage');
  });

  it('[SCHEMA TEST] verifies SPRINT 13 secure chat, reviews, notifications and RLS', () => {
    expect(fs.existsSync(migration13Path)).toBe(true);
    const sql13 = fs.readFileSync(migration13Path, 'utf8');

    expect(sql13).toContain('CREATE TABLE IF NOT EXISTS public.notifications');
    expect(sql13).toContain('ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES public.providers');
    expect(sql13).toContain('ON CONFLICT (booking_id)');
    expect(sql13).toContain('CREATE OR REPLACE FUNCTION public.get_or_create_conversation_for_booking');
    expect(sql13).toContain('CREATE OR REPLACE FUNCTION public.send_message');
    expect(sql13).toContain('sender_id, content');
    expect(sql13).toContain('CREATE OR REPLACE FUNCTION public.create_review_for_booking');
    expect(sql13).toContain("v_booking.status::TEXT <> 'COMPLETED'");
    expect(sql13).toContain('CREATE UNIQUE INDEX idx_notifications_unique_lesson_events');
    expect(sql13).toContain("'BOOKING_CONFIRMED'");
    expect(sql13).toContain("'BOOKING_CANCELLED'");
    expect(sql13).toContain("NEW.status::TEXT = 'CONFIRMED'");
    expect(sql13).toContain("NEW.status::TEXT IN ('CANCELLED_BY_STUDENT', 'CANCELLED_BY_PROVIDER')");

    expect(sql13).toContain('ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY');
    expect(sql13).toContain('ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY');
    expect(sql13).toContain('ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY');
    expect(sql13).toContain('ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY');

    expect(sql13).toContain('CREATE POLICY conversations_select_participants');
    expect(sql13).toContain('CREATE POLICY messages_select_participants');
    expect(sql13).toContain('CREATE POLICY reviews_select_authorized');
    expect(sql13).toContain('CREATE POLICY notifications_select_own');
    expect(sql13).toContain('CREATE POLICY notifications_update_read_own');

    expect(sql13).toContain('REVOKE ALL ON TABLE public.notifications FROM PUBLIC, anon, authenticated');
    expect(sql13).toContain('GRANT SELECT ON TABLE public.notifications TO authenticated');
    expect(sql13).not.toContain('GRANT INSERT ON TABLE public.notifications TO authenticated');
    expect(sql13).toContain('REVOKE ALL ON FUNCTION public.create_booking_completion_notifications() FROM PUBLIC');
    expect(sql13).toContain('REVOKE ALL ON FUNCTION public.create_booking_completion_notifications() FROM anon');
    expect(sql13).toContain('REVOKE ALL ON FUNCTION public.create_booking_completion_notifications() FROM authenticated');
    expect(sql13).toContain('SECURITY DEFINER');
    expect(sql13).toContain('SET search_path = public, pg_temp');
  });

  it('[SCHEMA TEST] verifies SPRINT 14 secure marketplace analytics RPCs and no direct client writes', () => {
    expect(fs.existsSync(migration14Path)).toBe(true);
    const sql14 = fs.readFileSync(migration14Path, 'utf8');

    expect(sql14).toContain('alter table public.analytics_events enable row level security');
    expect(sql14).toContain('create policy "analytics_events_no_direct_client_select"');
    expect(sql14).toContain('create policy "analytics_events_no_direct_client_insert"');
    expect(sql14).toContain('with check (false)');
    expect(sql14).toContain('revoke all on table public.analytics_events from anon');
    expect(sql14).toContain('revoke all on table public.analytics_events from authenticated');
    expect(sql14).not.toContain('grant insert on table public.analytics_events to authenticated');

    expect(sql14).toContain('create or replace function public.track_analytics_event');
    expect(sql14).toContain('PROVIDER_SEARCH');
    expect(sql14).toContain('PROVIDER_PROFILE_VIEW');
    expect(sql14).toContain('AVAILABLE_SLOTS_VIEW');
    expect(sql14).toContain('CHECKOUT_STARTED');
    expect(sql14).toContain('ANALYTICS_PROPERTIES_CONTAIN_SENSITIVE_KEY');
    expect(sql14).toContain('license_plate');
    expect(sql14).toContain('latitude');
    expect(sql14).toContain('longitude');
    expect(sql14).toContain('review_comment');
    expect(sql14).toContain('payment_token');

    expect(sql14).toContain('create or replace function public.get_admin_analytics_summary');
    expect(sql14).toContain('public.is_platform_admin()');
    expect(sql14).toContain('create or replace function public.get_provider_analytics_summary');
    expect(sql14).toContain('authorized_providers as');
    expect(sql14).toContain('public.is_school_member(p.id)');
    expect(sql14).toContain('Ambiente DEV — pagamentos simulados');

    expect(sql14).toContain('revoke all on function public.track_analytics_event(text, jsonb) from anon');
    expect(sql14).toContain('grant execute on function public.track_analytics_event(text, jsonb) to authenticated');
    expect(sql14).toContain('revoke all on function public.get_admin_analytics_summary(timestamptz, timestamptz) from anon');
    expect(sql14).toContain('grant execute on function public.get_admin_analytics_summary(timestamptz, timestamptz) to authenticated');
    expect(sql14).toContain('revoke all on function public.get_provider_analytics_summary(timestamptz, timestamptz) from anon');
    expect(sql14).toContain('grant execute on function public.get_provider_analytics_summary(timestamptz, timestamptz) to authenticated');
  });

  it('[SCHEMA TEST] verifies SPRINT 15 security hardening migration', () => {
    expect(fs.existsSync(migration15Path)).toBe(true);
    const sql15 = fs.readFileSync(migration15Path, 'utf8');

    expect(sql15).toContain('with (security_invoker = true)');
    expect(sql15).toContain('revoke all on public.providers_public_view from public');
    expect(sql15).toContain('revoke all on public.providers_public_view from anon');
    expect(sql15).toContain('revoke all on public.providers_public_view from authenticated');

    expect(sql15).toContain('drop policy if exists offerings_owner_insert on public.service_offerings');
    expect(sql15).toContain('create policy offerings_owner_insert');
    expect(sql15).toContain('with check (');
    expect(sql15).toContain('v.provider_id = service_offerings.provider_id');
    expect(sql15).not.toContain('v.provider_id = v.provider_id');

    expect(sql15).toContain('drop policy if exists vehicles_public_select on public.vehicles');
    expect(sql15).toContain('create policy vehicles_owner_select');
    expect(sql15).toContain('create policy vehicles_owner_insert');
    expect(sql15).toContain('create policy vehicles_owner_update');
    expect(sql15).toContain('with check (');
    expect(sql15).toContain('revoke select on table public.vehicles from anon');

    expect(sql15).toContain('create or replace function public.get_public_vehicle_catalog()');
    expect(sql15).toContain('license_plate_masked');
    expect(sql15).toContain("coalesce(v.license_plate_masked, '***-****')");
    expect(sql15).toContain('security definer');
    expect(sql15).toContain('set search_path = public, pg_temp');

    expect(sql15).toContain('audit_logs');
    expect(sql15).toContain('refunds');
    expect(sql15).toContain('payouts');
    expect(sql15).toContain('platform_configurations');
    expect(sql15).toContain('cancellation_policies');
    expect(sql15).toContain('cancellation_policy_rules');
    expect(sql15).toContain('using (false)');
    expect(sql15).toContain('with check (false)');

    expect(sql15).toContain('revoke all on function public.handle_new_auth_user() from public');
    expect(sql15).toContain('revoke all on function public.handle_new_auth_user() from anon');
    expect(sql15).toContain('revoke all on function public.handle_new_auth_user() from authenticated');
    expect(sql15).toContain('alter function public.get_provider_booking_context_public(uuid)');
    expect(sql15).toContain('revoke all on function public.is_offering_slot_available(uuid, timestamptz) from authenticated');

    expect(sql15).toContain('create index if not exists idx_bookings_offering_id');
    expect(sql15).toContain('create index if not exists idx_quotes_provider_id');
    expect(sql15).toContain('create index if not exists idx_compliance_documents_provider_id');
  });

  it('[SCHEMA TEST] verifies SPRINT 15 hotfix binds booking holds to auth.uid()', () => {
    expect(fs.existsSync(migration16Path)).toBe(true);
    const sql16 = fs.readFileSync(migration16Path, 'utf8');

    expect(sql16).toContain('create or replace function public.create_booking_hold');
    expect(sql16).toContain('v_student_id uuid := auth.uid()');
    expect(sql16).toContain("raise exception 'AUTH_REQUIRED'");
    expect(sql16).toContain("raise exception 'STUDENT_ID_MISMATCH'");
    expect(sql16).toContain('p_student_id is distinct from v_student_id');
    expect(sql16).toContain('v_quote.student_id is distinct from v_student_id');
    expect(sql16).toContain('student_id = v_student_id');
    expect(sql16).toContain('v_student_id,');
    expect(sql16).toContain("raise exception 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'");
    expect(sql16).toContain("raise exception 'SLOT_NO_LONGER_AVAILABLE'");
    expect(sql16).toContain('revoke all on function public.create_booking_hold(uuid, uuid, varchar, int) from anon');
    expect(sql16).toContain('grant execute on function public.create_booking_hold(uuid, uuid, varchar, int) to authenticated, service_role');
    expect(sql16).not.toContain('WHERE idempotency_key = p_idempotency_key AND student_id = p_student_id');
  });

  it('[STATIC SCHEMA CONTRACT] verifies Migration 46 update_provider_profile RPC security invariants & schema compatibility', () => {
    const migration46Path = path.join(process.cwd(), 'supabase/migrations/20260818000046_update_provider_profile_rpc.sql');
    expect(fs.existsSync(migration46Path)).toBe(true);
    const sql46 = fs.readFileSync(migration46Path, 'utf8');

    expect(sql46).toContain('CREATE OR REPLACE FUNCTION public.update_provider_profile');
    expect(sql46).toContain('SECURITY DEFINER');
    expect(sql46).toContain('SET search_path = public, pg_temp');
    expect(sql46).toContain('auth.uid()');
    expect(sql46).toContain('public.is_provider_owner');
    expect(sql46).toContain('public.is_school_admin');
    expect(sql46).toContain('trade_name =');
    expect(sql46).not.toMatch(/\bname\s*=/);
    expect(sql46).not.toMatch(/\blegal_name\s*=/);
    expect(sql46).not.toContain("'OWNER'");
    expect(sql46).not.toContain('status =');
    expect(sql46).not.toContain('document_number =');
    expect(sql46).not.toContain('type =');
    expect(sql46).not.toContain('user_id =');
    expect(sql46).not.toContain('rating_average =');
    expect(sql46).not.toContain('rating_count =');
    expect(sql46).toContain('PROVIDER_NAME_INVALID');
    expect(sql46).toContain('PROVIDER_CITY_INVALID');
    expect(sql46).toContain('PROVIDER_STATE_INVALID');
    expect(sql46).toContain('PROVIDER_CONTACT_INVALID');
    expect(sql46).toContain('SERVICE_RADIUS_INVALID');
    expect(sql46).toContain('REVOKE ALL ON FUNCTION public.update_provider_profile');
    expect(sql46).toContain('GRANT EXECUTE ON FUNCTION public.update_provider_profile');
  });

  it('[STATIC SCHEMA CONTRACT] verifies Migration 47 fix_provider_availability_rls policies, driving_school_staff GRANT & RBAC overrides', () => {
    const migration47Path = path.join(process.cwd(), 'supabase/migrations/20260818000047_fix_provider_availability_rls.sql');
    expect(fs.existsSync(migration47Path)).toBe(true);
    const sql47 = fs.readFileSync(migration47Path, 'utf8');

    expect(sql47).toContain('GRANT SELECT ON TABLE public.driving_school_staff TO authenticated');
    expect(sql47).toContain('REVOKE ALL ON TABLE public.driving_school_staff FROM anon');
    expect(sql47).toContain('CREATE OR REPLACE FUNCTION public.current_user_has_permission');
    expect(sql47).toContain('CREATE OR REPLACE FUNCTION public.can_manage_provider_schedule');
    expect(sql47).toContain('public.is_current_user_active()');
    expect(sql47).toContain('user_custom_permissions');
    expect(sql47).toContain('role_permissions');
    expect(sql47).toContain('school.schedule.manage');
    expect(sql47).toContain('provider.schedule.manage_own');
    expect(sql47).toContain('driving_school_staff');
    expect(sql47).toContain("p.type = 'DRIVING_SCHOOL'");
    expect(sql47).toContain('p.user_id = auth.uid()');
    expect(sql47).not.toContain('is_provider_owner(');
    expect(sql47).not.toContain('public.is_school_member(target_provider_id)');
    expect(sql47).not.toContain('DISABLE ROW LEVEL SECURITY');
    expect(sql47).toContain('CREATE POLICY "availabilities_owner_insert" ON public.availabilities');
    expect(sql47).toContain('CREATE POLICY "exceptions_owner_insert" ON public.availability_exceptions');
    expect(sql47).toContain('public.can_manage_provider_schedule(provider_id)');
    expect(sql47).not.toContain("auth.jwt() ->> 'role'");
    expect(sql47).toContain('WITH CHECK (public.can_manage_provider_schedule(provider_id))');
    expect(sql47).toContain('USING (public.can_manage_provider_schedule(provider_id))');
  });

  it('[STATIC SCHEMA CONTRACT] verifies Migration 48 remediate_student_overlapping_bookings safe transactional remediation', () => {
    const migration48Path = path.join(process.cwd(), 'supabase/migrations/20260818000048_remediate_student_overlapping_bookings.sql');
    expect(fs.existsSync(migration48Path)).toBe(true);
    const sql48 = fs.readFileSync(migration48Path, 'utf8');

    expect(sql48).toContain('f3e4d43a-dbf2-4e76-8f22-217d655741f8');
    expect(sql48).toContain('78d44619-5f7f-46f4-b1b2-5cad8b85501a');
    expect(sql48).toContain('REMEDIATION_PRECONDITION_FAILED');
    expect(sql48).toContain('FOR UPDATE');
    expect(sql48).toContain('v_hist_kept_rec.slot_range && v_hist_dup_rec.slot_range');
    expect(sql48).toContain('v_fut_kept_rec.slot_range && v_fut_dup_rec.slot_range');
    expect(sql48).toContain('v_live_overlap_count <> 2');
    expect(sql48).toContain('Refund idempotency key collision for');
    expect(sql48).toContain("cancelled_by = 'SYSTEM'");
    expect(sql48).toContain("cancellation_reason = 'SYSTEM_DOUBLE_BOOKING_OVERLAP'");
    expect(sql48).toContain('refund_amount_in_cents = v_hist_paid_amount');
    expect(sql48).toContain('refund_amount_in_cents = 0');
    expect(sql48).toContain('CANCELLED_BY_PROVIDER');
    expect(sql48).toContain('REFUNDED');
    expect(sql48).toContain('SYSTEM_DOUBLE_BOOKING_OVERLAP_REMEDIATION');
    expect(sql48).toContain('SYSTEM_DOUBLE_BOOKING_REMEDIATION');
    expect(sql48).toContain('REMEDIATION_POSTCONDITION_FAILED');
    expect(sql48).toContain('v_post_overlap_count <> 0');
  });

  it('[STATIC SCHEMA CONTRACT] verifies Migration 49 prevent_student_booking_overlap exclusion constraint & create_booking_hold error mapping', () => {
    const migration49Path = path.join(process.cwd(), 'supabase/migrations/20260818000049_prevent_student_booking_overlap.sql');
    expect(fs.existsSync(migration49Path)).toBe(true);
    const sql49 = fs.readFileSync(migration49Path, 'utf8');

    expect(sql49).toContain('exclude_student_overlapping_bookings');
    expect(sql49).toContain('student_id WITH =');
    expect(sql49).toContain('slot_range WITH &&');
    expect(sql49).toContain('STUDENT_OVERLAP_EXISTING_DATA');
    expect(sql49).toContain("STUDENT_ALREADY_BOOKED_FOR_SLOT' USING ERRCODE = 'P0001'");
    expect(sql49).toContain('GET STACKED DIAGNOSTICS');
    expect(sql49).toContain('v_constraint_name = CONSTRAINT_NAME');
    expect(sql49).toContain('exclude_instructor_overlapping_bookings');
    expect(sql49).toContain('exclude_vehicle_overlapping_bookings');
    expect(sql49).toContain('SLOT_NO_LONGER_AVAILABLE');
    expect(sql49).toContain('RAISE;\n      END IF;');
  });

  it('[STATIC SCHEMA CONTRACT] verifies Migration 50 harden_public_search_category_b exact RPC signature & Category B enforcement', () => {
    const migration50Path = path.join(process.cwd(), 'supabase/migrations/20260818000050_harden_public_search_category_b.sql');
    expect(fs.existsSync(migration50Path)).toBe(true);
    const sql50 = fs.readFileSync(migration50Path, 'utf8');

    expect(sql50).toContain('search_providers_public');
    expect(sql50).toContain('p_radius_meters DOUBLE PRECISION DEFAULT 5000');
    expect(sql50).toContain('p_category TEXT DEFAULT NULL');
    expect(sql50).toContain('p_provider_type TEXT DEFAULT \'ALL\'');
    expect(sql50).toContain('p_transmission TEXT DEFAULT \'ALL\'');
    expect(sql50).toContain('p_min_rating DOUBLE PRECISION DEFAULT 0.0');
    expect(sql50).toContain('INVALID_PUBLIC_CATEGORY');
    expect(sql50).toContain("p_category IS NOT NULL AND p_category <> 'B'");
    expect(sql50).toContain("v_effective_category := 'B'");
    expect(sql50).toContain('o.category::TEXT = v_effective_category');
    expect(sql50).toContain('so_avail.category::TEXT = v_effective_category');
    expect(sql50).toContain('GRANT EXECUTE ON FUNCTION public.search_providers_public(\n  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT, DOUBLE PRECISION, INT, INT, INT, DATE\n)');
  });

  it('[STATIC SCHEMA CONTRACT] verifies Migration 51 harden_category_b_booking_funnel RPC funnel defenses & LIVE parity', () => {
    const migration51Path = path.join(process.cwd(), 'supabase/migrations/20260818000051_harden_category_b_booking_funnel.sql');
    expect(fs.existsSync(migration51Path)).toBe(true);
    const sql51 = fs.readFileSync(migration51Path, 'utf8');

    expect(sql51).toContain('get_provider_booking_context_public');
    expect(sql51).toContain('provider_name TEXT');
    expect(sql51).toContain("AND o.category::TEXT = 'B'");
    expect(sql51).toContain('get_available_slots_public');
    expect(sql51).toContain('slot_start_at TIMESTAMPTZ');
    expect(sql51).toContain('slot_end_at TIMESTAMPTZ');
    expect(sql51).toContain('timezone TEXT');
    expect(sql51).toContain("IF v_offering.category::TEXT <> 'B' THEN");
    expect(sql51).toContain('create_quote_from_offering');
    expect(sql51).toContain('TRIM(p_idempotency_key)');
    expect(sql51).toContain('ON CONFLICT (student_id, idempotency_key)');
    expect(sql51).toContain("INVALID_PUBLIC_CATEGORY: Only category B is supported for quotes");
    expect(sql51).toContain('create_booking_hold');
    expect(sql51).toContain("INVALID_PUBLIC_CATEGORY: Only category B is supported for booking holds");
  });

  it('[STATIC SCHEMA CONTRACT] verifies Migration 52 provider_lesson_lifecycle_rpcs signatures and defenses', () => {
    const migration52Path = path.join(process.cwd(), 'supabase/migrations/20260818000052_provider_lesson_lifecycle_rpcs.sql');
    expect(fs.existsSync(migration52Path)).toBe(true);
    const sql52 = fs.readFileSync(migration52Path, 'utf8');

    expect(sql52).toContain('completion_idempotency_key');
    expect(sql52).toContain('provider_check_in_booking');
    expect(sql52).toContain('checkin_instructor_at');
    expect(sql52).toContain('Novo check-in só é permitido para agendamentos confirmados (CONFIRMED)');
    expect(sql52).toContain('CHECKIN_WINDOW_NOT_OPEN');
    expect(sql52).toContain('CHECKIN_WINDOW_EXPIRED');

    expect(sql52).toContain('provider_start_lesson');
    expect(sql52).toContain("status = 'IN_PROGRESS'");
    expect(sql52).toContain('CHECKIN_REQUIRED');

    expect(sql52).toContain('provider_complete_lesson');
    expect(sql52).toContain("status = 'COMPLETED'");
    expect(sql52).toContain('completed_at');
    expect(sql52).toContain('lesson_finished_at');
    expect(sql52).toContain('COMPLETION_IDEMPOTENCY_KEY_REQUIRED');
    expect(sql52).toContain('IS DISTINCT FROM');
    expect(sql52).toContain('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST');
  });

  it('[STATIC SCHEMA CONTRACT] verifies Migration 53 secure booking category fallback signatures and RLS safety', () => {
    const migration53Path = path.join(process.cwd(), 'supabase/migrations/20260818000053_secure_booking_category_fallback.sql');
    expect(fs.existsSync(migration53Path)).toBe(true);
    const sql53 = fs.readFileSync(migration53Path, 'utf8');

    expect(sql53).toContain('get_my_booking_categories');
    expect(sql53).toContain('p_booking_ids UUID[]');
    expect(sql53).toContain('SECURITY DEFINER');
    expect(sql53).toContain('SET search_path = public, pg_temp');
    expect(sql53).toContain('is_booking_participant');
  });

  it('[STATIC SCHEMA CONTRACT] verifies Migration 54 instructor unified calendar, global blocks and cancellation guards', () => {
    const migration54Path = path.join(process.cwd(), 'supabase/migrations/20260818000054_instructor_unified_calendar_and_global_blocks.sql');
    expect(fs.existsSync(migration54Path)).toBe(true);
    const sql54 = fs.readFileSync(migration54Path, 'utf8');

    expect(sql54).toContain('CREATE TABLE IF NOT EXISTS public.instructor_global_blocks');
    expect(sql54).toContain('get_my_unified_instructor_bookings');
    expect(sql54).toContain('get_my_instructor_global_blocks');
    expect(sql54).toContain('save_instructor_global_block');
    expect(sql54).toContain('delete_instructor_global_block');
    expect(sql54).toContain('cancel_booking_v2');
    expect(sql54).toContain('v_provider_type');
    expect(sql54).toContain('UNAUTHORIZED_PROVIDER');
  });

  it('[STATIC SCHEMA CONTRACT] verifies Migration 55 regression fix for SQLSTATE 42702 ambiguity in get_my_instructor_global_blocks', () => {
    const migration55Path = path.join(process.cwd(), 'supabase/migrations/20260820000055_fix_global_blocks_list_rpc_ambiguity.sql');
    expect(fs.existsSync(migration55Path)).toBe(true);
    const sql55 = fs.readFileSync(migration55Path, 'utf8');

    expect(sql55).toContain('get_my_instructor_global_blocks');
    expect(sql55).toContain('FROM public.users AS u');
    expect(sql55).toContain('WHERE u.id = v_uid');
    expect(sql55).not.toMatch(/FROM\s+public\.users\s+WHERE\s+id\s*=\s*v_uid/i);
  });

  it('[SCHEMA TEST] verifies that development seed contains realistic non-production mock records', () => {
    expect(fs.existsSync(seedPath)).toBe(true);
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    expect(seedSql).toContain('aluno.demo@mazzi.com.br');
    expect(seedSql).toContain('carlos.instrutor@mazzi.com.br');
    expect(seedSql).toContain('ST_SetSRID(ST_MakePoint');
    expect(seedSql).toContain('Política Padrão de Desenvolvimento MAZZI');
  });

  it('[SCHEMA TEST] keeps active demo offerings eligible under the current compliance gate', () => {
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    expect(seedSql).toContain("scope,\n  document_type");
    expect(seedSql).toContain("'USER_GLOBAL'");
    expect(seedSql).toContain("'CREDENTIAL_DETRAN'");
    expect(seedSql).toContain("'CRIMINAL_BACKGROUND'");
    expect(seedSql).toContain("'replay://demo/carlos/cnh'");
    expect(seedSql).toContain("'replay://demo/marcos/cnh'");
    expect(seedSql).toContain('membership_status, is_active');
    expect(seedSql).toContain("'INSTRUCTOR', 'ACTIVE', TRUE");
    expect(seedSql).toContain("'APPROVED'");
  });
});
