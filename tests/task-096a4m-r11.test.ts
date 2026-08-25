import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260825172601_enforce_provider_offering_lifecycle_consistency.sql'),
  'utf8',
);

describe('TASK-096A4M-R11 offering lifecycle invariant', () => {
  it('deactivates active offerings when a provider leaves ACTIVE', () => {
    expect(sql).toContain("OLD.status = 'ACTIVE' AND NEW.status <> 'ACTIVE'");
    expect(sql).toContain("status = 'INACTIVE'");
    expect(sql).toContain('is_active = FALSE');
    expect(sql).toContain('updated_at = NOW()');
  });

  it('does not reactivate offerings when a provider returns to ACTIVE', () => {
    expect(sql).not.toContain("NEW.status = 'ACTIVE'");
    expect(sql).toContain('AFTER UPDATE OF status ON public.providers');
  });

  it('backfills only offerings owned by non-active providers', () => {
    expect(sql).toContain("p.status <> 'ACTIVE'");
    expect(sql).toContain("o.status = 'ACTIVE' OR o.is_active IS TRUE");
    expect(sql).toContain('FROM public.providers p');
  });
});
