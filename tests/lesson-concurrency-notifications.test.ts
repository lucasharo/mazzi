import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const bookingSchemaMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260815000009_quote_booking.sql'),
  'utf8',
);
const notificationRepairMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260908201428_restore_lesson_lifecycle_notifications.sql'),
  'utf8',
);

describe('aula em andamento e notificações operacionais', () => {
  it('impede atomicamente sobreposição por instrutor e veículo', () => {
    expect(bookingSchemaMigration).toContain('ADD CONSTRAINT exclude_instructor_overlapping_bookings');
    expect(bookingSchemaMigration).toContain('instructor_id WITH =');
    expect(bookingSchemaMigration).toContain('ADD CONSTRAINT exclude_vehicle_overlapping_bookings');
    expect(bookingSchemaMigration).toContain('vehicle_id WITH =');
    expect(bookingSchemaMigration).toContain('slot_range WITH &&');
    expect(bookingSchemaMigration).toContain("WHERE (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'))");
  });

  it('registra check-in, início e conclusão como notificações idempotentes', () => {
    expect(notificationRepairMigration).toContain("'STUDENT_CHECKIN'");
    expect(notificationRepairMigration).toContain("'PROVIDER_CHECKIN'");
    expect(notificationRepairMigration).toContain("'LESSON_STARTED'");
    expect(notificationRepairMigration).toContain("'LESSON_COMPLETED'");
    expect(notificationRepairMigration).toContain('notify_booking_participants');
  });

  it('preserva os disparos depois das RPCs de check-in e ciclo de aula serem sobrescritas', () => {
    expect(notificationRepairMigration.match(/PERFORM public\.notify_booking_participants\(/g)).toHaveLength(4);
    expect(notificationRepairMigration).toContain("'STUDENT_CHECKIN'");
    expect(notificationRepairMigration).toContain("'PROVIDER_CHECKIN'");
    expect(notificationRepairMigration).toContain("'LESSON_STARTED'");
    expect(notificationRepairMigration).toContain("'LESSON_COMPLETED'");
    expect(notificationRepairMigration).toContain('v_uid');
  });
});
