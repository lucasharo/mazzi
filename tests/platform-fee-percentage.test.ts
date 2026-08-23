import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260823031751_fix_platform_fee_percentage.sql'),
  'utf8',
);

describe('Platform fee percentage contract', () => {
  it('loads the configured percentage and calculates cents from the offering price', () => {
    expect(migration).toContain("value->>'default_percentage'");
    expect(migration).toContain('v_platform_fee_cents := ROUND((v_offering.price_in_cents * v_platform_fee_percentage) / 100.0)::INT');
    expect(migration).not.toContain('v_platform_fee_cents INT          := 1000');
    expect(migration).not.toContain('v_platform_fee_cents INT := 1000');
  });

  it('keeps the quote total equal to lesson price plus the calculated fee', () => {
    expect(migration).toContain("'total_in_cents', v_existing_quote.total_in_cents");
    expect(migration).toContain('v_platform_fee_cents, v_offering.price_in_cents + v_platform_fee_cents');
  });
});
