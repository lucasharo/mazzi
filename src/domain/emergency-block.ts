import { ACTIVE_CONFLICT_BOOKING_STATUSES } from './availability';

export interface EmergencyBlockableSlot {
  date: string;
  startTime: string;
  endTime: string;
  startAt: string;
  endAt: string;
}

const dayNumber: Record<string, number> = { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 };
const toMinutes = (value: string) => { const [h, m] = value.split(':').map(Number); return h * 60 + m; };
const fmt = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;

export function generateEmergencyBlockableSlots({ date, rules, bookings, globalBlocks, exceptions, now = new Date() }: {
  date: string;
  rules: any[];
  bookings?: any[];
  globalBlocks?: any[];
  exceptions?: any[];
  now?: Date;
}): EmergencyBlockableSlot[] {
  const weekday = new Date(`${date}T12:00:00-03:00`).getDay();
  const activeBookings = bookings || [];
  const activeGlobalBlocks = globalBlocks || [];
  const activeExceptions = exceptions || [];
  const matchingRules = rules.filter((rule) => rule.isActive && (rule.dayOfWeekNumber === weekday || dayNumber[rule.dayOfWeek] === weekday));
  const slots: EmergencyBlockableSlot[] = [];
  for (const rule of matchingRules) {
    for (let minute = toMinutes(rule.startTime); minute + 60 <= toMinutes(rule.endTime); minute += 60) {
      const startTime = fmt(minute); const endTime = fmt(minute + 60);
      const startAt = `${date}T${startTime}:00.000-03:00`; const endAt = `${date}T${endTime}:00.000-03:00`;
      const start = new Date(startAt); const end = new Date(endAt);
      if (end <= now) continue;
      const overlaps = (a: Date, b: Date) => start < b && a < end;
      const bookingConflict = activeBookings.some((booking) => {
        if (!ACTIVE_CONFLICT_BOOKING_STATUSES.includes(booking.status)) return false;
        if (booking.status === 'PENDING_PAYMENT' && booking.holdExpiresAt && new Date(booking.holdExpiresAt) <= now) return false;
        return overlaps(new Date(booking.scheduledStartAt), new Date(booking.scheduledEndAt));
      });
      const blocked = activeGlobalBlocks.some((block) => overlaps(new Date(block.start_at), new Date(block.end_at)));
      const exceptionBlocked = activeExceptions.some((exception) => exception.type === 'BLOCK' && overlaps(new Date(exception.startAt), new Date(exception.endAt)));
      if (!bookingConflict && !blocked && !exceptionBlocked) slots.push({ date, startTime, endTime, startAt, endAt });
    }
  }
  return slots;
}

export function isEmergencyBlockDurationAvailable(startAt: string, durationMinutes: number, slots: EmergencyBlockableSlot[]): boolean {
  const end = new Date(new Date(startAt).getTime() + durationMinutes * 60000);
  return durationMinutes >= 60 && durationMinutes % 60 === 0 && slots.some((slot) => slot.startAt === startAt) && slots.filter((slot) => new Date(slot.startAt) >= new Date(startAt) && new Date(slot.endAt) <= end).length === durationMinutes / 60;
}
