import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeComplianceStatus } from '../src/domain/compliance-status';

describe('canonical compliance document statuses', () => {
  it.each([
    ['PENDING', 'PENDING'],
    ['DRAFT', 'PENDING'],
    ['IN_REVIEW', 'IN_REVIEW'],
    ['APPROVED', 'APPROVED'],
    ['REJECTED', 'REJECTED'],
    ['EXPIRED', 'EXPIRED'],
  ])('normalizes status input %s to %s', (input, expected) => {
    expect(normalizeComplianceStatus(input)).toBe(expected);
  });

  it('does not change provider lifecycle status semantics', () => {
    expect(normalizeComplianceStatus('ACTIVE')).toBe('PENDING');
    expect(normalizeComplianceStatus('BLOCKED')).toBe('PENDING');
  });

  it('defines the canonical database contract without deleting history', () => {
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260825140113_task_096a4m_r8_canonical_compliance_status.sql'), 'utf8');
    expect(migration).toContain("'PENDING', 'IN_REVIEW', 'REJECTED', 'APPROVED'");
    expect(migration).not.toContain('DELETE FROM public.compliance_documents');
  });
});
