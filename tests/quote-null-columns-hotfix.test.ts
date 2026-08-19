import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * TASK-008 HOTFIX — Quote NULL Columns Regression Tests
 * 
 * These tests validate the corrected migration 40 locally (no DB connection required).
 * They guard against regression of the provider_id/instructor_id/vehicle_id NULL bug.
 */

const MIGRATION_40_PATH = path.join(
  process.cwd(),
  'supabase', 'migrations',
  '20260818000040_restore_slot_contract_and_readonly_availability.sql'
);

const RPC_CANCELLATION_TEST_PATH = path.join(
  process.cwd(), 'tests', 'rpc-cancellation-v2-real.test.ts'
);

const APPLY_MIGRATION_SCRIPT_PATH = path.join(
  process.cwd(), 'scripts', 'apply-migration-40-and-validate.ts'
);

describe('TASK-008 HOTFIX — create_quote_from_offering NULL Columns Fix', () => {

  describe('[AC01/AC16] Migration 40 file integrity', () => {
    it('Migration 40 file exists on disk', () => {
      expect(fs.existsSync(MIGRATION_40_PATH)).toBe(true);
    });

    it('Migration 40 contains create_quote_from_offering function', () => {
      const sql = fs.readFileSync(MIGRATION_40_PATH, 'utf8');
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.create_quote_from_offering');
    });
  });

  describe('[AC02] INSERT must include all 3 NOT NULL FK columns', () => {
    it('INSERT INTO public.quotes column list contains provider_id', () => {
      const sql = fs.readFileSync(MIGRATION_40_PATH, 'utf8');
      const match = sql.match(/CREATE OR REPLACE FUNCTION public\.create_quote_from_offering[\s\S]*?\$\$[\s\S]*?\$\$/);
      expect(match).not.toBeNull();
      const insertMatch = match![0].match(/INSERT INTO public\.quotes\s*\([\s\S]*?\) VALUES/);
      expect(insertMatch).not.toBeNull();
      expect(insertMatch![0]).toContain('provider_id');
    });

    it('INSERT INTO public.quotes column list contains instructor_id', () => {
      const sql = fs.readFileSync(MIGRATION_40_PATH, 'utf8');
      const match = sql.match(/CREATE OR REPLACE FUNCTION public\.create_quote_from_offering[\s\S]*?\$\$[\s\S]*?\$\$/);
      const insertMatch = match![0].match(/INSERT INTO public\.quotes\s*\([\s\S]*?\) VALUES/);
      expect(insertMatch![0]).toContain('instructor_id');
    });

    it('INSERT INTO public.quotes column list contains vehicle_id', () => {
      const sql = fs.readFileSync(MIGRATION_40_PATH, 'utf8');
      const match = sql.match(/CREATE OR REPLACE FUNCTION public\.create_quote_from_offering[\s\S]*?\$\$[\s\S]*?\$\$/);
      const insertMatch = match![0].match(/INSERT INTO public\.quotes\s*\([\s\S]*?\) VALUES/);
      expect(insertMatch![0]).toContain('vehicle_id');
    });

    it('VALUES references v_offering.provider_id', () => {
      const sql = fs.readFileSync(MIGRATION_40_PATH, 'utf8');
      const match = sql.match(/CREATE OR REPLACE FUNCTION public\.create_quote_from_offering[\s\S]*?\$\$[\s\S]*?\$\$/);
      expect(match![0]).toContain('v_offering.provider_id');
      expect(match![0]).toContain('v_offering.instructor_id');
      expect(match![0]).toContain('v_offering.vehicle_id');
    });
  });

  describe('[AC04] Atomic idempotency — ON CONFLICT DO NOTHING', () => {
    it('Uses ON CONFLICT (student_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING', () => {
      const sql = fs.readFileSync(MIGRATION_40_PATH, 'utf8');
      const match = sql.match(/CREATE OR REPLACE FUNCTION public\.create_quote_from_offering[\s\S]*?\$\$[\s\S]*?\$\$/);
      const quoteSql = match![0];
      expect(quoteSql).toContain('ON CONFLICT (student_id, idempotency_key)');
      expect(quoteSql).toContain('WHERE idempotency_key IS NOT NULL');
      expect(quoteSql).toContain('DO NOTHING');
      expect(quoteSql).toContain('RETURNING * INTO v_existing_quote');
    });

    it('Has exactly one INSERT INTO public.quotes (no TOCTOU double-insert pattern)', () => {
      const sql = fs.readFileSync(MIGRATION_40_PATH, 'utf8');
      const match = sql.match(/CREATE OR REPLACE FUNCTION public\.create_quote_from_offering[\s\S]*?\$\$[\s\S]*?\$\$/);
      const count = (match![0].match(/INSERT INTO public\.quotes/g) || []).length;
      expect(count).toBe(1);
    });
  });

  describe('[AC03] JSON response — all 15 contract fields present', () => {
    it('All required fields appear in jsonb_build_object calls', () => {
      const sql = fs.readFileSync(MIGRATION_40_PATH, 'utf8');
      const match = sql.match(/CREATE OR REPLACE FUNCTION public\.create_quote_from_offering[\s\S]*?\$\$[\s\S]*?\$\$/);
      const quoteSql = match![0];

      const requiredFields = [
        "'success'", "'is_idempotent'", "'quote_id'",
        "'student_id'", "'provider_id'", "'instructor_id'", "'vehicle_id'",
        "'offering_id'", "'scheduled_start_at'", "'scheduled_end_at'",
        "'price_in_cents'", "'platform_fee_in_cents'", "'total_in_cents'",
        "'status'", "'expires_at'",
      ];

      for (const field of requiredFields) {
        expect(quoteSql).toContain(field);
      }
    });
  });

  describe('[AC05/AC06] Idempotency error codes', () => {
    it('Contains QUOTE_IDEMPOTENCY_KEY_STALE', () => {
      const sql = fs.readFileSync(MIGRATION_40_PATH, 'utf8');
      const match = sql.match(/CREATE OR REPLACE FUNCTION public\.create_quote_from_offering[\s\S]*?\$\$[\s\S]*?\$\$/);
      expect(match![0]).toContain('QUOTE_IDEMPOTENCY_KEY_STALE');
    });

    it('Contains QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST', () => {
      const sql = fs.readFileSync(MIGRATION_40_PATH, 'utf8');
      const match = sql.match(/CREATE OR REPLACE FUNCTION public\.create_quote_from_offering[\s\S]*?\$\$[\s\S]*?\$\$/);
      expect(match![0]).toContain('QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST');
    });
  });

  describe('[AC07] is_offering_slot_available — read-only STABLE', () => {
    it('Marked STABLE SECURITY DEFINER with no DML', () => {
      const sql = fs.readFileSync(MIGRATION_40_PATH, 'utf8');
      const match = sql.match(/CREATE OR REPLACE FUNCTION public\.is_offering_slot_available[\s\S]*?\$\$[\s\S]*?\$\$/);
      expect(match).not.toBeNull();
      const fnSql = match![0];
      expect(fnSql).toContain('STABLE SECURITY DEFINER');
      expect(fnSql).not.toContain('UPDATE public.bookings');
      expect(fnSql).not.toContain('INSERT INTO');
      expect(fnSql).not.toContain('DELETE FROM');
    });
  });

  describe('[AC08] get_available_slots_public — read-only STABLE', () => {
    it('Marked STABLE SECURITY DEFINER with no DML', () => {
      const sql = fs.readFileSync(MIGRATION_40_PATH, 'utf8');
      const match = sql.match(/CREATE OR REPLACE FUNCTION public\.get_available_slots_public[\s\S]*?\$\$[\s\S]*?\$\$/);
      expect(match).not.toBeNull();
      const fnSql = match![0];
      expect(fnSql).toContain('STABLE SECURITY DEFINER');
      expect(fnSql).not.toContain('UPDATE');
      expect(fnSql).not.toContain('DELETE');
    });
  });

  describe('[AC14] rpc-cancellation-v2-real.test.ts — DDL guard', () => {
    it('Test file has MAZZI_LIVE_DDL_TESTS guard', () => {
      const code = fs.readFileSync(RPC_CANCELLATION_TEST_PATH, 'utf8');
      expect(code).toContain('MAZZI_LIVE_DDL_TESTS');
      expect(code).toContain("process.env.MAZZI_LIVE_DDL_TESTS === 'true'");
    });
  });

  describe('[AC14] apply-migration-40-and-validate.ts — LIVE guard', () => {
    it('Script requires MAZZI_ALLOW_LIVE_MIGRATION=true', () => {
      const code = fs.readFileSync(APPLY_MIGRATION_SCRIPT_PATH, 'utf8');
      expect(code).toContain('MAZZI_ALLOW_LIVE_MIGRATION');
      expect(code).toContain('process.exit(1)');
    });
  });

  describe('[AC16] CheckoutModal idempotency key includes checkoutAttemptId', () => {
    it('Key format includes checkoutAttemptIdRef.current', () => {
      const checkoutPath = path.join(
        process.cwd(), 'src', 'apps', 'student', 'components', 'CheckoutModal.tsx'
      );
      const code = fs.readFileSync(checkoutPath, 'utf8');
      expect(code).toContain('checkoutAttemptIdRef.current');
      expect(code).toContain('idem_quote_');
    });
  });
});
