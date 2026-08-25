import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260825202942_performance_safe_p1_indexes_and_rls_initplans.sql'),
  'utf8',
);

const baseline = readFileSync(
  resolve(process.cwd(), 'supabase/baseline-candidate/mazzi_mvp_baseline_schema.sql'),
  'utf8',
);

describe('safe P1 performance hardening', () => {
  it('covers every unindexed foreign key reported before the migration', () => {
    const indexes = [
      ['idx_cancellation_policy_rules_policy_id', 'cancellation_policy_rules', 'policy_id'],
      ['idx_driving_school_staff_ended_by', 'driving_school_staff', 'ended_by'],
      ['idx_driving_school_staff_source_invitation_id', 'driving_school_staff', 'source_invitation_id'],
      ['idx_driving_school_staff_suspended_by', 'driving_school_staff', 'suspended_by'],
      ['idx_platform_configurations_updated_by', 'platform_configurations', 'updated_by'],
      ['idx_providers_approved_by', 'providers', 'approved_by'],
      ['idx_providers_rejected_by', 'providers', 'rejected_by'],
      ['idx_user_custom_permissions_granted_by', 'user_custom_permissions', 'granted_by'],
    ];

    for (const [index, table, column] of indexes) {
      expect(migration).toContain(`CREATE INDEX IF NOT EXISTS ${index}`);
      expect(migration).toContain(`ON public.${table} (${column})`);
      expect(baseline).toContain(`CREATE INDEX IF NOT EXISTS ${index}`);
    }
  });

  it('uses initplan-safe auth expressions without changing policy targets', () => {
    const policies = [
      'Providers can insert own compliance documents',
      'Providers can read own compliance documents',
      'Users can view own custom permissions',
      'Parties can read own payments',
      'Providers can create initial draft profile',
      'offerings_owner_select',
      'Authenticated users can create own student profile',
    ];

    for (const policy of policies) {
      expect(migration).toContain(`ALTER POLICY ${policy.includes(' ') ? `"${policy}"` : policy}`);
    }

    expect(migration).toContain('(select auth.uid())');
    expect(migration).toContain('(select auth.jwt())');
    expect(migration.match(/ALTER POLICY/g)).toHaveLength(policies.length);
    expect(migration).toContain('status = ANY');
    expect(migration).toContain('is_provider_owner(provider_id)');
    expect(migration).toContain('is_compliance_reviewer()');
    expect(migration).toContain('is_school_admin(provider_id)');
    expect(migration).toContain('is_platform_admin()');
    expect(migration).toContain("status = 'DRAFT'::public.provider_status");
    expect(migration).not.toContain('DROP POLICY');
    expect(migration).not.toContain('CREATE POLICY');
    expect(migration).not.toContain('GRANT ');
    expect(migration).not.toContain('REVOKE ');
  });
});
