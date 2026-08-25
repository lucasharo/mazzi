import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = (name: string) =>
  readFileSync(resolve(process.cwd(), 'supabase/migrations', name), 'utf8');

describe('TASK-096A4M-R10B contracts', () => {
  it('rebuilds both enums with the canonical review state', () => {
    const sql = migration('20260825143810_remove_legacy_review_enum_values_v2.sql');
    expect(sql).toContain("'IN_REVIEW'");
    expect(sql).toContain("DROP TYPE public.compliance_status");
    expect(sql).toContain("DROP TYPE public.vehicle_status");
    expect(sql).not.toMatch(/DROP\s+TYPE[^;]+CASCADE/i);
  });

  it('centralizes eligibility and protects provider activation transitions', () => {
    const sql = migration('20260825143844_activate_eligible_instructor_providers_v2.sql');
    expect(sql).toContain('is_provider_activation_eligible');
    expect(sql).toContain("status IN ('DRAFT'::public.provider_status,'PENDING_REVIEW'::public.provider_status)");
    expect(sql).toContain("status='ACTIVE'::public.provider_status");
    expect(sql).toContain('promote_eligible_instructor_provider');
    expect(sql).toContain("p.status IN ('DRAFT'::public.provider_status,'PENDING_REVIEW'::public.provider_status)");
    expect(sql).not.toContain("p.status IN ('BLOCKED'");
    expect(sql).not.toContain("p.status IN ('SUSPENDED'");
    expect(sql).not.toContain("p.status IN ('REJECTED'");
  });
});

describe('TASK-096A4M-R10C universal activation contract', () => {
  it('evaluates USER_GLOBAL approvals for every matching instructor provider', () => {
    const sql = migration('20260825145519_fix_instructor_auto_activation_scope.sql');
    expect(sql).toContain("NEW.scope = 'USER_GLOBAL'::public.compliance_document_scope");
    expect(sql).toContain('p.user_id = NEW.user_id');
    expect(sql).toContain('FOR UPDATE');
    expect(sql).toContain('is_provider_activation_eligible(v_candidate.id)');
  });

  it('keeps PROVIDER approvals scoped to the submitted provider', () => {
    const sql = migration('20260825145519_fix_instructor_auto_activation_scope.sql');
    expect(sql).toContain("NEW.scope = 'PROVIDER'::public.compliance_document_scope");
    expect(sql).toContain('p.id = NEW.provider_id');
    expect(sql).toContain("p.type = 'INSTRUCTOR'::public.provider_type");
  });

  it('records the actual previous lifecycle status and is idempotent', () => {
    const sql = migration('20260825145519_fix_instructor_auto_activation_scope.sql');
    expect(sql).toContain("jsonb_build_object('status', v_candidate.status)");
    expect(sql).toContain("jsonb_build_object('status', 'ACTIVE')");
    expect(sql).toContain("status IN ('DRAFT'::public.provider_status, 'PENDING_REVIEW'::public.provider_status)");
    expect(sql).not.toContain("status IN ('BLOCKED'");
    expect(sql).not.toContain("status IN ('SUSPENDED'");
    expect(sql).not.toContain("status IN ('REJECTED'");
  });
});
