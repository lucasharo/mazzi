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
    expect(sql13).toContain('UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_lesson_events');

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
    expect(sql13).toContain('SECURITY DEFINER');
    expect(sql13).toContain('SET search_path = public, pg_temp');
  });

  it('[SCHEMA TEST] verifies that development seed contains realistic non-production mock records', () => {
    expect(fs.existsSync(seedPath)).toBe(true);
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    expect(seedSql).toContain('aluno.demo@mazzi.com.br');
    expect(seedSql).toContain('carlos.instrutor@mazzi.com.br');
    expect(seedSql).toContain('ST_SetSRID(ST_MakePoint');
    expect(seedSql).toContain('Política Padrão de Desenvolvimento MAZZI');
  });
});
