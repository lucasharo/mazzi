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
    expect(studentModal).toContain('Reembolso ao aluno');
    expect(studentModal).toContain('getBookingRefundAmountInCents(booking)');
    expect(studentModal).not.toContain("label: 'Taxa de Serviço MAZZI'");
    expect(providerModal).toContain("label: 'Reembolso ao aluno'");
    expect(providerModal).toContain('getBookingRefundAmountInCents(booking)');
  });
});
