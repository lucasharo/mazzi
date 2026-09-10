import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const studentModal = readFileSync(
  resolve(process.cwd(), 'src/apps/student/components/BookingDetailsModal.tsx'),
  'utf8',
);
const providerModal = readFileSync(
  resolve(process.cwd(), 'src/apps/provider/components/ProviderBookingDetailsModal.tsx'),
  'utf8',
);

describe('refund amount in booking details', () => {
  it('shows the persisted refund amount in both detail views', () => {
    for (const source of [studentModal, providerModal]) {
      expect(source).toContain("label: 'Valor do reembolso'");
      expect(source).toContain('booking.refundAmountInCents');
      expect(source).toContain('formatCentsToBRL(booking.refundAmountInCents)');
    }
  });
});
