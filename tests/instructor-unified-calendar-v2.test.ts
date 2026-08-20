import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('TASK-054A — Unified Instructor Calendar & Global Blocks Schema & Security Tests', () => {
  const mig52Path = path.join(__dirname, '../supabase/migrations/20260818000052_provider_lesson_lifecycle_rpcs.sql');
  const mig53Path = path.join(__dirname, '../supabase/migrations/20260818000053_secure_booking_category_fallback.sql');
  const mig54Path = path.join(__dirname, '../supabase/migrations/20260818000054_instructor_unified_calendar_and_global_blocks.sql');

  it('1. Migration 54 NÃO contém b.category', () => {
    const content = fs.readFileSync(mig54Path, 'utf-8');
    expect(content).not.toContain('b.category');
  });

  it('2. Migration 54 NÃO contém availability_exceptions.user_id', () => {
    const content = fs.readFileSync(mig54Path, 'utf-8');
    expect(content).not.toContain('availability_exceptions.user_id');
  });

  it('3. Migration 54 NÃO contém availability_exceptions.updated_at', () => {
    const content = fs.readFileSync(mig54Path, 'utf-8');
    expect(content).not.toContain('availability_exceptions.updated_at');
  });

  it('4. Migration 54 NÃO tenta INSERT em availability_exceptions sem provider_id', () => {
    const content = fs.readFileSync(mig54Path, 'utf-8');
    expect(content).not.toContain('INSERT INTO public.availability_exceptions');
  });

  it('5. Migration 54 get_my_unified_instructor_bookings NÃO possui fallback hardcoded para categoria B', () => {
    const content = fs.readFileSync(mig54Path, 'utf-8');
    const rpcDefinition = content.substring(
      content.indexOf('CREATE OR REPLACE FUNCTION public.get_my_unified_instructor_bookings'),
      content.indexOf('REVOKE ALL ON FUNCTION public.get_my_unified_instructor_bookings')
    );
    expect(rpcDefinition).not.toContain("'B'");
  });

  it('6 & 7. RETURNS TABLE em get_my_unified_instructor_bookings usa refund_amount_in_cents BIGINT e cancelled_by TEXT', () => {
    const content = fs.readFileSync(mig54Path, 'utf-8');
    expect(content).toContain('refund_amount_in_cents BIGINT');
    expect(content).toContain('cancelled_by TEXT');
  });

  it('8 & 9. Tabela dedicada instructor_global_blocks existe no DDL e NÃO possui provider_id', () => {
    const content = fs.readFileSync(mig54Path, 'utf-8');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS public.instructor_global_blocks');
    const tableDdl = content.substring(
      content.indexOf('CREATE TABLE IF NOT EXISTS public.instructor_global_blocks'),
      content.indexOf('CREATE INDEX IF NOT EXISTS idx_instructor_global_blocks_search')
    );
    expect(tableDdl).not.toContain('provider_id');
  });

  it('10 & 11. RPCs de bloqueio global utilizam auth.uid() obrigatoriamente', () => {
    const content = fs.readFileSync(mig54Path, 'utf-8');
    expect(content).toContain('CREATE OR REPLACE FUNCTION public.save_instructor_global_block');
    expect(content).toContain('CREATE OR REPLACE FUNCTION public.delete_instructor_global_block');
    expect(content).toContain('CREATE OR REPLACE FUNCTION public.get_my_instructor_global_blocks');
    expect(content).toContain('v_uid UUID := auth.uid()');
  });

  it('12 & 13. Acesso direto alteração em instructor_global_blocks é REVOGADO para authenticated/anon', () => {
    const content = fs.readFileSync(mig54Path, 'utf-8');
    expect(content).toContain('REVOKE INSERT, UPDATE, DELETE ON public.instructor_global_blocks FROM authenticated');
    expect(content).toContain('REVOKE ALL ON public.instructor_global_blocks FROM anon');
  });

  it('14. is_offering_slot_available avalia instructor_global_blocks ANTES de AVAILABLE_OVERRIDE', () => {
    const content = fs.readFileSync(mig54Path, 'utf-8');
    const slotRpc = content.substring(
      content.indexOf('CREATE OR REPLACE FUNCTION public.is_offering_slot_available'),
      content.indexOf('REVOKE ALL ON FUNCTION public.is_offering_slot_available')
    );
    const globalBlockPos = slotRpc.indexOf('instructor_global_blocks');
    const overridePos = slotRpc.indexOf('AVAILABLE_OVERRIDE');

    expect(globalBlockPos).toBeGreaterThan(0);
    expect(overridePos).toBeGreaterThan(0);
    expect(globalBlockPos).toBeLessThan(overridePos);
  });

  it('17. get_my_unified_instructor_bookings não aceita parâmetro de instructor_id arbitrário', () => {
    const content = fs.readFileSync(mig54Path, 'utf-8');
    expect(content).toContain('public.get_my_unified_instructor_bookings()');
  });

  it('23. EXCLUDE constraint de instrutor no schema 01 permanece sem provider_id', () => {
    const mig01Path = path.join(__dirname, '../supabase/migrations/20260814000001_initial_schema.sql');
    const content = fs.readFileSync(mig01Path, 'utf-8');
    const excludeBlock = content.substring(
      content.indexOf('exclude_instructor_overlapping_bookings'),
      content.indexOf('exclude_vehicle_overlapping_bookings')
    );
    expect(excludeBlock).toContain('instructor_id WITH =');
    expect(excludeBlock).toContain('slot_range WITH &&');
    expect(excludeBlock).not.toContain('provider_id WITH =');
  });

  it('24 & 25. Migration 52 e Migration 53 permanecem existentes', () => {
    expect(fs.existsSync(mig52Path)).toBe(true);
    expect(fs.existsSync(mig53Path)).toBe(true);
  });
});
