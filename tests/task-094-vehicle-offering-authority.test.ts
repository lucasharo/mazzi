import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260824124740_task_094_vehicle_offering_lifecycle_authority.sql'),
  'utf8',
);
const dbService = fs.readFileSync(path.join(root, 'src/lib/db-service.ts'), 'utf8');
const providerApp = fs.readFileSync(path.join(root, 'src/apps/provider/ProviderApp.tsx'), 'utf8');

describe('TASK-094 vehicle and offering lifecycle authority', () => {
  it('uses RPCs for provider vehicle/offering mutations', () => {
    expect(dbService).toContain("sp.rpc('provider_save_vehicle'");
    expect(dbService).toContain("sp.rpc('provider_deactivate_vehicle'");
    expect(dbService).toContain("sp.rpc('provider_save_service_offering'");
    expect(dbService).not.toMatch(/from\('vehicles'\)\s*\.insert/);
    expect(dbService).not.toMatch(/from\('vehicles'\)\s*\.update/);
    expect(dbService).not.toMatch(/from\('service_offerings'\)\s*\.insert/);
    expect(dbService).not.toMatch(/from\('service_offerings'\)\s*\.update/);
  });

  it('makes lifecycle authority and offering gates server-side', () => {
    expect(migration).toContain("'PENDING'");
    expect(migration).toContain('BLOCKED_VEHICLE_MUTATION_DENIED');
    expect(migration).toContain("status IN ('ACTIVE','INACTIVE') THEN 'UNDER_REVIEW'");
    expect(migration).toContain('OFFERING_PROVIDER_NOT_ACTIVE');
    expect(migration).toContain('OFFERING_VEHICLE_NOT_ACTIVE');
    expect(migration).toContain('OFFERING_INSTRUCTOR_NOT_ELIGIBLE');
    expect(migration).toContain('OFFERING_DURATION_MUST_BE_50');
    expect(migration).toContain('OFFERING_PRICE_INVALID');
    expect(migration).toContain('service_offerings_lifecycle_consistency_check');
    expect(migration).toContain('service_offerings_active_equivalence_idx');
    expect(providerApp).toContain('dbService.deactivateVehicle(vehicleId)');
  });
});
