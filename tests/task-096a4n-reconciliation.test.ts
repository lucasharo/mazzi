import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const providerApp = readFileSync(resolve(process.cwd(), 'src/apps/provider/ProviderApp.tsx'), 'utf8');
const publicSearch = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260825040308_task_096a4n_public_search_instructor_avatar_fallback.sql'), 'utf8');
const studentToPro = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260825030830_task_096a4m_r_student_to_pro_profile_migration.sql'), 'utf8');

describe('TASK-096A4N — offering lifecycle and Student → PRO reconciliation', () => {
  it('wires non-active providers to prepare inactive offerings while preserving active-provider behavior', () => {
    expect(providerApp).toContain("initialStatus: currentProvider.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'");
    expect(providerApp).not.toContain('if (currentProvider.status !== \'ACTIVE\') {');
    expect(providerApp).toContain('Oferta cadastrada como inativa.');
    expect(providerApp).toContain('onToggleOfferingStatus');
  });

  it('keeps public Student search fail-closed to active providers, vehicles, instructors and offerings', () => {
    expect(publicSearch).toContain("WHERE o.is_active=TRUE AND o.status='ACTIVE'");
    expect(publicSearch).toContain("WHERE p.status='ACTIVE'");
    expect(publicSearch).toContain("v.status='ACTIVE'");
    expect(publicSearch).toContain("u.status='ACTIVE'");
    expect(publicSearch).toContain('public.is_provider_instructor_eligible');
  });

  it('preserves the authenticated Student → PRO migration contract without test identities', () => {
    expect(studentToPro).toContain('public.get_my_student_to_pro_migration_status()');
    expect(studentToPro).toContain('public.migrate_my_student_profile_to_instructor()');
    expect(studentToPro).toContain('IDENTITY_INCOMPLETE');
    expect(studentToPro).toContain('ACTIVE_STUDENT_BOOKING');
    expect(studentToPro).toContain('PENDING_STUDENT_PAYMENT');
    expect(studentToPro).toContain('STUDENT_DISPUTE_OPEN');
  });
});
