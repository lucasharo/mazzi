import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260904210000_fix_school_schedule_authority_and_search_visibility.sql',
);

describe('[STATIC CONTRACT] school schedule authority and public search visibility', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');

  it('allows a school owner with the school schedule permission to manage its schedule', () => {
    expect(sql).toContain("p.type = 'DRIVING_SCHOOL'::public.provider_type");
    expect(sql).toContain("p.user_id = auth.uid()");
    expect(sql).toContain("public.current_user_has_permission('school.schedule.manage'::public.app_permission)");
    expect(sql).toContain("dss.membership_status = 'ACTIVE'::public.school_membership_status");
  });

  it('requires an active recurring availability rule before exposing an offering publicly', () => {
    expect(sql).toContain('FROM public.availabilities a');
    expect(sql).toContain('a.is_active IS TRUE');
    expect(sql).toContain('(a.instructor_id IS NULL OR a.instructor_id = o.instructor_id)');
    expect(sql).toContain('(a.vehicle_id IS NULL OR a.vehicle_id = o.vehicle_id)');
  });
});
