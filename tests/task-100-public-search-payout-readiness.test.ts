import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260904230000_require_complete_payout_setup_for_public_search.sql',
);

describe('[STATIC CONTRACT] public search requires complete payout setup', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');

  it('requires a completed Stripe Connect account before exposing an offering', () => {
    expect(sql).toContain('FROM public.provider_payment_accounts ppa');
    expect(sql).toContain("ppa.gateway = 'STRIPE'");
    expect(sql).toContain("ppa.status = 'ACTIVE'");
    expect(sql).toContain('ppa.charges_enabled IS TRUE');
    expect(sql).toContain('ppa.payouts_enabled IS TRUE');
    expect(sql).toContain("NULLIF(BTRIM(ppa.external_account_id), '') IS NOT NULL");
  });
});
