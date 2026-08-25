import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20260825195444_harden_public_database_surface.sql',
  'utf8',
);
const dbService = readFileSync('src/lib/db-service.ts', 'utf8');
const adminApp = readFileSync('src/apps/admin/AdminApp.tsx', 'utf8');

describe('TASK-096A4R security hardening contracts', () => {
  it('hardens both historical public views without granting base-table access', () => {
    expect(migration).toContain('ALTER VIEW public.public_vehicles SET (security_invoker = true)');
    expect(migration).toContain('ALTER VIEW public.public_service_offerings SET (security_invoker = true)');
    expect(migration).toContain('REVOKE SELECT ON public.public_vehicles FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('REVOKE SELECT ON public.public_service_offerings FROM PUBLIC, anon, authenticated');
    expect(migration).not.toMatch(/GRANT SELECT ON (?:TABLE )?(?:public\.)?(?:vehicles|service_offerings|providers) TO anon/i);
    expect(migration).not.toContain('spatial_ref_sys');
  });

  it('keeps review RPCs authenticated-only while preserving their signatures', () => {
    expect(migration).toContain('REVOKE EXECUTE ON FUNCTION public.review_compliance_document(');
    expect(migration).toContain('public.compliance_status');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.review_compliance_document(');
    expect(migration).toContain('REVOKE EXECUTE ON FUNCTION public.review_vehicle(');
    expect(migration).toContain('public.vehicle_status');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.review_vehicle(');
    expect(migration).not.toMatch(/DROP FUNCTION|CREATE OR REPLACE FUNCTION|ALTER FUNCTION/i);
  });

  it('removes application-role execution from database trigger helpers only', () => {
    for (const name of [
      'enforce_booking_schedule_exceptions',
      'enforce_schedule_lock_on_availability',
      'validate_availability_resource_scope',
    ]) {
      expect(migration).toContain(`REVOKE EXECUTE ON FUNCTION public.${name}()`);
      expect(migration).toMatch(
        new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${name}\\(\\)[\\s\\S]*?FROM PUBLIC, anon, authenticated`),
      );
    }
  });

  it('uses Strategy A for the vehicle catalog: authenticated Admin caller only', () => {
    expect(dbService).toContain("sp.rpc('get_public_vehicle_catalog')");
    expect(adminApp).toContain('dbService.getVehicles()');
    expect(migration).toContain('REVOKE EXECUTE ON FUNCTION public.get_public_vehicle_catalog()');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.get_public_vehicle_catalog()');
    expect(migration).not.toContain('get_public_vehicle_catalog_v2');
  });

  it('does not change the intentional public Student RPC contract', () => {
    expect(migration).not.toMatch(/REVOKE EXECUTE ON FUNCTION public\.(search_providers_public|get_available_slots_public|get_provider_booking_context_public)/);
  });
});
