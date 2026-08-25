import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const baseline = readFileSync(resolve(process.cwd(), 'supabase/baseline-candidate/mazzi_mvp_baseline_schema.sql'), 'utf8');
const referenceData = readFileSync(resolve(process.cwd(), 'supabase/baseline-candidate/mazzi_mvp_baseline_reference_data.sql'), 'utf8');
const termsMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260825151539_enforce_current_mazzi_terms_for_instructor_activation.sql'), 'utf8');
const lifecycleMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260825172601_enforce_provider_offering_lifecycle_consistency.sql'), 'utf8');

describe('TASK-096A4M-R12A canonical baseline candidate', () => {
  it('contains the server-authoritative terms contract', () => {
    expect(baseline).toContain('public.current_mazzi_terms_version()');
    expect(baseline).toContain("SELECT 'v1'::text");
    expect(baseline).toContain('TERMS_VERSION_NOT_CURRENT');
    expect(baseline).toContain("acceptance://mazzi-ethics/' || v_current_version");
    expect(baseline).toContain("GRANT EXECUTE ON FUNCTION public.provider_accept_mazzi_terms(uuid,text) TO authenticated");
  });

  it('contains the canonical terms requirement and activation gate', () => {
    expect(referenceData).toContain("'req_termo_conduta_mazzi'");
    expect(referenceData).toContain("'MAZZI_TERMS_ACCEPTANCE'");
    expect(referenceData).toContain("'PROVIDER'::public.compliance_document_scope");
    expect(referenceData).toContain("'2026-01-01'::timestamptz");
    expect(baseline).toContain('public.is_provider_activation_eligible(p_provider_id uuid)');
    expect(baseline).toContain("terms.storage_path='acceptance://mazzi-ethics/'||public.current_mazzi_terms_version()");
  });

  it('contains USER_GLOBAL and PROVIDER activation plus accurate audit status', () => {
    expect(baseline).toContain("NEW.scope='PROVIDER'");
    expect(baseline).toContain("NEW.scope='USER_GLOBAL'");
    expect(baseline).toContain('promote_eligible_instructor_provider_after_compliance');
    expect(baseline).toContain("jsonb_build_object('status',v_candidate.status)");
    expect(baseline).toContain("jsonb_build_object('status','ACTIVE')");
  });

  it('contains the offering lifecycle invariant and backend gate', () => {
    expect(baseline).toContain('public.deactivate_provider_offerings_on_lifecycle_change()');
    expect(baseline).toContain("OLD.status='ACTIVE' AND NEW.status<>'ACTIVE'");
    expect(baseline).toContain("status='INACTIVE',is_active=FALSE,updated_at=NOW()");
    expect(baseline).toContain('deactivate_provider_offerings_on_provider_lifecycle');
    expect(baseline).toContain('OFFERING_PROVIDER_NOT_ACTIVE');
    expect(baseline).not.toContain('NEW.status=\'ACTIVE\'');
  });

  it('retains the canonical R10D/R11 migration contract in the candidate', () => {
    expect(termsMigration).toContain('current_mazzi_terms_version');
    expect(termsMigration).toContain('provider_accept_mazzi_terms');
    expect(termsMigration).toContain('is_provider_activation_eligible');
    expect(baseline).toContain('current_mazzi_terms_version');
    expect(baseline).toContain('provider_accept_mazzi_terms');
    expect(baseline).toContain('is_provider_activation_eligible');

    expect(lifecycleMigration).toContain('deactivate_provider_offerings_on_lifecycle_change');
    expect(baseline).toContain('deactivate_provider_offerings_on_lifecycle_change');
    expect(baseline).toContain('OFFERING_PROVIDER_NOT_ACTIVE');
  });

  it('keeps canonical compliance and vehicle enum sets', () => {
    const complianceEnum = baseline.match(/CREATE TYPE "public"\."compliance_status" AS ENUM \([\s\S]*?\);/)?.[0] ?? '';
    const vehicleEnum = baseline.match(/CREATE TYPE "public"\."vehicle_status" AS ENUM \([\s\S]*?\);/)?.[0] ?? '';
    expect(complianceEnum).toMatch(/'PENDING',\s*'APPROVED',\s*'REJECTED',\s*'EXPIRED',\s*'IN_REVIEW'/s);
    expect(vehicleEnum).toMatch(/'DRAFT',\s*'PENDING',\s*'IN_REVIEW',\s*'ACTIVE',\s*'INACTIVE',\s*'EXPIRED',\s*'BLOCKED'/s);
    expect(complianceEnum).not.toMatch(/UNDER_REVIEW|DENIED|DECLINED/);
    expect(vehicleEnum).not.toMatch(/UNDER_REVIEW|DENIED|DECLINED/);
  });
});
