import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260907185639_use_configured_quote_expiration.sql'),
  'utf8',
);

describe('configurable quote expiration contract', () => {
  it('uses quote_settings as the source of truth for the student quote deadline', () => {
    expect(migration).toContain("WHERE key = 'quote_settings'");
    expect(migration).toContain("value->>'expiration_minutes'");
    expect(migration).toContain('v_expires_at := v_now + make_interval(mins => v_ttl_minutes)');
    expect(migration).not.toContain("v_expires_at := v_now + interval '10 minutes'");
  });

  it('fails closed when the Admin setting is missing or invalid', () => {
    expect(migration).toContain("THEN (value->>'expiration_minutes')::integer");
    expect(migration).toContain("RAISE EXCEPTION 'PLATFORM_CONFIGURATION_INVALID: quoteExpirationMinutes não está configurado.'");
    expect(migration).not.toContain('COALESCE(v_ttl_minutes, 10)');
  });
});
