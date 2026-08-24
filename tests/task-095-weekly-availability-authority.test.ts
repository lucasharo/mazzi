import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260824130725_task_095_weekly_availability_authority_and_privacy.sql'), 'utf8');
const dbService = fs.readFileSync(path.join(root, 'src/lib/db-service.ts'), 'utf8');

describe('TASK-095 weekly availability authority and privacy', () => {
  it('routes weekly availability mutations through RPCs', () => {
    expect(dbService).toContain("sp.rpc('provider_save_availability_rule'");
    expect(dbService).toContain("sp.rpc('provider_delete_availability_rule'");
    expect(dbService).not.toMatch(/from\('availabilities'\)\s*\.insert/);
    expect(dbService).not.toMatch(/from\('availabilities'\)\s*\.update/);
    expect(dbService).not.toMatch(/from\('availabilities'\)\s*\.delete/);
  });

  it('keeps scope, full-hour, lock, privacy and RPC ACL contracts server-side', () => {
    expect(migration).toContain('validate_availability_resource_scope');
    expect(migration).toContain('AVAILABILITY_VEHICLE_SCOPE_INVALID');
    expect(migration).toContain('AVAILABILITY_INSTRUCTOR_SCOPE_INVALID');
    expect(migration).toContain('AVAILABILITY_FULL_HOUR_REQUIRED');
    expect(migration).toContain('AVAILABILITY_TIME_RANGE_INVALID');
    expect(migration).toContain('AVAILABILITY_RULE_DUPLICATE');
    expect(migration).toContain("hashtextextended('provider-schedule:'");
    expect(migration).toContain('TO authenticated');
    expect(migration).toContain('REVOKE SELECT, INSERT, UPDATE, DELETE ON public.availabilities FROM anon');
    expect(migration).toContain('REVOKE INSERT, UPDATE, DELETE ON public.availabilities FROM authenticated');
    expect(migration).toContain('provider-schedule:');
  });
});
