import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const providerModal = fs.readFileSync(path.join(process.cwd(), 'src/apps/provider/components/ProviderBookingDetailsModal.tsx'), 'utf8');
const migration = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260910184043_zero_platform_fee_on_full_refund.sql'), 'utf8');

describe('Full refund fee policy', () => {
  it('shows zero MAZZI fee when the refund covers the total booking amount', () => {
    expect(providerModal).toContain('refundAmountInCents >= bookingTotalInCents');
    expect(providerModal).toContain('effectivePlatformFeeInCents');
  });

  it('persists zero platform retention for full refunds and keeps partial fees', () => {
    expect(migration).toContain('WHEN v_refund_amount >= v_booking.total_in_cents THEN 0');
    expect(migration).toContain('v_platform_fee');
    expect(migration).toContain('v_refund_amount');
  });
});
