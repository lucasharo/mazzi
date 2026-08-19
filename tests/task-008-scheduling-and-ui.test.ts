import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('TASK-008 — RPC 405 Fix, Read-Only Scheduling & UX Refinement Tests', () => {

  describe('1. Migration 40 & Backend Contract Integrity', () => {
    const migrationPath = path.join(
      process.cwd(),
      'supabase',
      'migrations',
      '20260818000040_restore_slot_contract_and_readonly_availability.sql'
    );

    it('Migration 40 file exists', () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
    });

    it('is_offering_slot_available is marked STABLE SECURITY DEFINER with no DML UPDATE statements', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');

      // Find definition of is_offering_slot_available
      const isAvailMatch = sql.match(/CREATE OR REPLACE FUNCTION public\.is_offering_slot_available[\s\S]*?\$\$[\s\S]*?\$\$/);
      expect(isAvailMatch).not.toBeNull();
      const isAvailSql = isAvailMatch![0];

      expect(isAvailSql).toContain('STABLE SECURITY DEFINER');
      expect(isAvailSql).not.toContain('UPDATE public.bookings');
      expect(isAvailSql).not.toContain('INSERT INTO');
      expect(isAvailSql).not.toContain('DELETE FROM');
    });

    it('is_offering_slot_available contains full scheduling checks (DOW ISO, BLOCK, AVAILABLE_OVERRIDE, Slot interval alignment)', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      const isAvailMatch = sql.match(/CREATE OR REPLACE FUNCTION public\.is_offering_slot_available[\s\S]*?\$\$[\s\S]*?\$\$/);
      const isAvailSql = isAvailMatch![0];

      expect(isAvailSql).toContain("e.type = 'BLOCK'");
      expect(isAvailSql).toContain("e.type = 'AVAILABLE_OVERRIDE'");
      expect(isAvailSql).toContain('extract(isodow from v_local_start)');
      expect(isAvailSql).toContain('extract(minute from');
      expect(isAvailSql).toContain('hold_expires_at');
    });

    it('Write-path housekeeping UPDATE is present in create_quote_from_offering', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      const quoteMatch = sql.match(/CREATE OR REPLACE FUNCTION public\.create_quote_from_offering[\s\S]*?\$\$[\s\S]*?\$\$/);
      expect(quoteMatch).not.toBeNull();
      const quoteSql = quoteMatch![0];

      expect(quoteSql).toContain("UPDATE public.bookings");
      expect(quoteSql).toContain("status = 'EXPIRED'");
      expect(quoteSql).toContain("hold_expires_at <= v_now");
    });

    // ── TASK-008 HOTFIX: Critical regression tests ──────────────────────────

    it('[HOTFIX-AC02] create_quote_from_offering INSERT includes provider_id', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      const quoteMatch = sql.match(/CREATE OR REPLACE FUNCTION public\.create_quote_from_offering[\s\S]*?\$\$[\s\S]*?\$\$/);
      const quoteSql = quoteMatch![0];
      // Must be in the INSERT column list
      const insertBlock = quoteSql.match(/INSERT INTO public\.quotes\s*\([\s\S]*?\) VALUES/);
      expect(insertBlock).not.toBeNull();
      expect(insertBlock![0]).toContain('provider_id');
    });

    it('[HOTFIX-AC02] create_quote_from_offering INSERT includes instructor_id', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      const quoteMatch = sql.match(/CREATE OR REPLACE FUNCTION public\.create_quote_from_offering[\s\S]*?\$\$[\s\S]*?\$\$/);
      const quoteSql = quoteMatch![0];
      const insertBlock = quoteSql.match(/INSERT INTO public\.quotes\s*\([\s\S]*?\) VALUES/);
      expect(insertBlock).not.toBeNull();
      expect(insertBlock![0]).toContain('instructor_id');
    });

    it('[HOTFIX-AC02] create_quote_from_offering INSERT includes vehicle_id', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      const quoteMatch = sql.match(/CREATE OR REPLACE FUNCTION public\.create_quote_from_offering[\s\S]*?\$\$[\s\S]*?\$\$/);
      const quoteSql = quoteMatch![0];
      const insertBlock = quoteSql.match(/INSERT INTO public\.quotes\s*\([\s\S]*?\) VALUES/);
      expect(insertBlock).not.toBeNull();
      expect(insertBlock![0]).toContain('vehicle_id');
    });

    it('[HOTFIX-AC02] create_quote_from_offering VALUES includes v_offering.provider_id', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      const quoteMatch = sql.match(/CREATE OR REPLACE FUNCTION public\.create_quote_from_offering[\s\S]*?\$\$[\s\S]*?\$\$/);
      const quoteSql = quoteMatch![0];
      expect(quoteSql).toContain('v_offering.provider_id');
      expect(quoteSql).toContain('v_offering.instructor_id');
      expect(quoteSql).toContain('v_offering.vehicle_id');
    });

    it('[HOTFIX-AC04] create_quote_from_offering uses atomic ON CONFLICT idempotency (not TOCTOU)', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      const quoteMatch = sql.match(/CREATE OR REPLACE FUNCTION public\.create_quote_from_offering[\s\S]*?\$\$[\s\S]*?\$\$/);
      const quoteSql = quoteMatch![0];
      expect(quoteSql).toContain('ON CONFLICT (student_id, idempotency_key)');
      expect(quoteSql).toContain('WHERE idempotency_key IS NOT NULL');
      expect(quoteSql).toContain('DO NOTHING');
      expect(quoteSql).toContain('RETURNING * INTO v_existing_quote');
    });

    it('[HOTFIX-AC03] create_quote_from_offering JSON response contains all 14 contract fields', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      const quoteMatch = sql.match(/CREATE OR REPLACE FUNCTION public\.create_quote_from_offering[\s\S]*?\$\$[\s\S]*?\$\$/);
      const quoteSql = quoteMatch![0];

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

    it('[HOTFIX-AC05/AC06] create_quote_from_offering has QUOTE_IDEMPOTENCY_KEY_STALE and REUSED_WITH_DIFFERENT_REQUEST errors', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      const quoteMatch = sql.match(/CREATE OR REPLACE FUNCTION public\.create_quote_from_offering[\s\S]*?\$\$[\s\S]*?\$\$/);
      const quoteSql = quoteMatch![0];
      expect(quoteSql).toContain('QUOTE_IDEMPOTENCY_KEY_STALE');
      expect(quoteSql).toContain('QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST');
    });
  });

  describe('2. Floating Action Footer & UI Component Integrity', () => {
    it('FloatingActionFooter component exists and defaults to bg-transparent', () => {
      const footerPath = path.join(process.cwd(), 'src', 'components', 'ui', 'FloatingActionFooter.tsx');
      expect(fs.existsSync(footerPath)).toBe(true);
      const code = fs.readFileSync(footerPath, 'utf8');
      expect(code).toContain('bg-transparent');
    });

    it('FilterDrawer bottom action footer passes footerContent via Modal footer prop', () => {
      const drawerPath = path.join(process.cwd(), 'src', 'components', 'search', 'FilterDrawer.tsx');
      const code = fs.readFileSync(drawerPath, 'utf8');
      expect(code).toContain('footer={footerContent}');
    });

    it('SlotSelectorModal bottom action area passes footerContent via Modal footer prop', () => {
      const modalPath = path.join(process.cwd(), 'src', 'apps', 'student', 'components', 'SlotSelectorModal.tsx');
      const code = fs.readFileSync(modalPath, 'utf8');
      expect(code).toContain('footer={footerContent}');
    });
  });

  describe('3. Student & Provider Cancellation UX Integrity', () => {
    it('BookingDetailsModal uses side-by-side hierarchy with soft danger cancel trigger button', () => {
      const detailsPath = path.join(process.cwd(), 'src', 'apps', 'student', 'components', 'BookingDetailsModal.tsx');
      const code = fs.readFileSync(detailsPath, 'utf8');

      // Soft danger styling on trigger button
      expect(code).toContain('bg-rose-50');
      expect(code).toContain('text-rose-700');
      expect(code).toContain('Cancelar aula');

      // Side-by-side with primary destructive CTA
      expect(code).toContain('Confirmar cancelamento');
      expect(code).toContain('Manter aula');
    });

    it('ProviderApp cancellation modal uses vertical hierarchy with Voltar sem cancelar', () => {
      const providerPath = path.join(process.cwd(), 'src', 'apps', 'provider', 'ProviderApp.tsx');
      const code = fs.readFileSync(providerPath, 'utf8');

      expect(code).toContain('Confirmar cancelamento');
      expect(code).toContain('Voltar sem cancelar');
      expect(code).toContain('Cancelar agendamento');
    });
  });
});
