import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const ensureReviewState = readFileSync(
  resolve(root, 'supabase/migrations/20260822023534_compliance_review_status.sql'),
  'utf8',
);
const firstPolicyUse = readFileSync(
  resolve(root, 'supabase/migrations/20260822023640_allow_compliance_review_insert.sql'),
  'utf8',
);

describe('TASK-096A4M-R13A historical enum order', () => {
  it('introduces the review label before the first historical policy use', () => {
    expect(ensureReviewState).toContain("ADD VALUE IF NOT EXISTS 'IN_REVIEW'");
    expect(firstPolicyUse).toContain("'IN_REVIEW'::public.compliance_status");
    expect(Number('20260822023534')).toBeLessThan(Number('20260822023640'));
  });
});
