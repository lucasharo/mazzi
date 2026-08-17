import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const card = readFileSync(join(root, 'src/components/ui/BookingCard.tsx'), 'utf8');
const details = readFileSync(join(root, 'src/apps/student/components/BookingDetailsModal.tsx'), 'utf8');
const student = readFileSync(join(root, 'src/apps/student/StudentApp.tsx'), 'utf8');
const status = readFileSync(join(root, 'src/components/ui/StatusBadge.tsx'), 'utf8');

describe('Student new template phase 3 bookings contracts', () => {
  it('uses a student card variant without fake check-in and without raw values', () => {
    expect(card).toContain("variant?: 'default' | 'student'");
    expect(card).toContain("!isStudent && isUpcoming && onCheckIn");
    expect(card).toContain('formatMeetingPoint');
    expect(card).toContain('Automático');
    expect(card).not.toContain('String(booking.vehicleName');
    expect(student).toContain('variant="student"');
  });

  it('keeps real booking ordering and source boundaries', () => {
    expect(student).toContain('dbService.getBookings()');
    expect(student).toContain('bookingTimestamp(a) - bookingTimestamp(b)');
    expect(student).toContain('bookingTimestamp(b) - bookingTimestamp(a)');
    expect(student).not.toContain('getProviders()');
    expect(student).not.toContain('getVehicles()');
    expect(student).not.toContain('getOfferings()');
  });

  it('does not expose UUID or invent duration in details', () => {
    expect(details).not.toContain('Código da Reserva');
    expect(details).not.toContain('{booking.id}');
    expect(details).not.toContain('|| 50');
    expect(details).toContain('snapshot.totalInCents');
    expect(details).toContain('Automático');
    expect(details).toContain('O tempo de retenção deste horário expirou');
  });

  it('has human-readable labels for the student booking statuses', () => {
    for (const label of ['Confirmada', 'Aguardando Pagamento', 'Em Andamento', 'Concluída', 'Cancelada por você', 'Cancelada pelo prestador', 'Expirada', 'Falha no pagamento', 'Reembolsada']) {
      expect(status).toContain(label);
    }
  });
});
