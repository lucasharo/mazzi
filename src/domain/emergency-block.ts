import { ACTIVE_CONFLICT_BOOKING_STATUSES } from './availability';

export interface EmergencyBlockableSlot {
  date: string;
  startTime: string;
  endTime: string;
  startAt: string;
  endAt: string;
}

const HOUR_MS = 60 * 60 * 1000;

export function sortEmergencySlots(slots: EmergencyBlockableSlot[]): EmergencyBlockableSlot[] {
  return [...slots].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

export function isContiguousHourRange(slots: EmergencyBlockableSlot[]): boolean {
  if (slots.length === 0) return false;
  const ordered = sortEmergencySlots(slots);
  const firstDate = ordered[0].date;
  return ordered.every((slot, index) => {
    if (slot.date !== firstDate) return false;
    const duration = new Date(slot.endAt).getTime() - new Date(slot.startAt).getTime();
    if (duration !== HOUR_MS) return false;
    if (index === 0) return true;
    const previous = ordered[index - 1];
    return new Date(slot.startAt).getTime() - new Date(previous.startAt).getTime() === HOUR_MS
      && previous.endAt === slot.startAt;
  });
}

export function normalizeContiguousHourRange(slots: EmergencyBlockableSlot[]): EmergencyBlockableSlot[] | null {
  const ordered = sortEmergencySlots(slots);
  return isContiguousHourRange(ordered) ? ordered : null;
}

export function selectContiguousHourRange({
  availableSlots,
  selectedSlots,
  clickedSlot,
}: {
  availableSlots: EmergencyBlockableSlot[];
  selectedSlots: EmergencyBlockableSlot[];
  clickedSlot: EmergencyBlockableSlot;
}): EmergencyBlockableSlot[] {
  const available = sortEmergencySlots(availableSlots);
  const clickedIndex = available.findIndex((slot) => slot.startAt === clickedSlot.startAt);
  if (clickedIndex < 0) return [clickedSlot];

  const selected = normalizeContiguousHourRange(selectedSlots);
  if (!selected) return [clickedSlot];
  if (selected.length === 1 && selected[0].startAt === clickedSlot.startAt) return [];

  const selectedIndex = selected.findIndex((slot) => slot.startAt === clickedSlot.startAt);
  if (selectedIndex >= 0) {
    const endpoint = Math.max(0, selectedIndex);
    return selected.slice(0, endpoint + 1);
  }

  const anchorIndex = available.findIndex((slot) => slot.startAt === selected[0].startAt);
  if (anchorIndex < 0) return [clickedSlot];
  const start = Math.min(anchorIndex, clickedIndex);
  const end = Math.max(anchorIndex, clickedIndex);
  const range = available.slice(start, end + 1);
  return isContiguousHourRange(range) ? range : [clickedSlot];
}

const dayNumber: Record<string, number> = { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 };
const toMinutes = (value: string) => { const [h, m] = value.split(':').map(Number); return h * 60 + m; };
const fmt = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;

export function generateEmergencyBlockableSlots({ date, rules, bookings, globalBlocks, exceptions, providerId, instructorId, vehicleId, now = new Date() }: {
  date: string;
  rules: any[];
  bookings?: any[];
  globalBlocks?: any[];
  exceptions?: any[];
  providerId?: string;
  instructorId?: string;
  vehicleId?: string;
  now?: Date;
}): EmergencyBlockableSlot[] {
  const weekday = new Date(`${date}T12:00:00-03:00`).getDay();
  const activeBookings = bookings || [];
  const activeGlobalBlocks = globalBlocks || [];
  const activeExceptions = (exceptions || []).filter((exception) => exception.isActive !== false && exception.is_active !== false);
  const scopedException = (exception: any) => (
    (!providerId || !exception.providerId || exception.providerId === providerId) &&
    (!instructorId || !exception.instructorId || exception.instructorId === instructorId) &&
    (!vehicleId || !exception.vehicleId || exception.vehicleId === vehicleId)
  );
  const matchingRules = rules.filter((rule) => rule.isActive && (rule.dayOfWeekNumber === weekday || dayNumber[rule.dayOfWeek] === weekday));
  const dayStart = new Date(`${date}T00:00:00.000-03:00`);
  const dayEnd = new Date(`${date}T24:00:00.000-03:00`);
  const overrideWindows = activeExceptions
    .filter((exception) => exception.type === 'AVAILABLE_OVERRIDE' && scopedException(exception))
    .map((exception) => ({
      start: new Date(Math.max(new Date(exception.startAt || exception.start_at).getTime(), dayStart.getTime())),
      end: new Date(Math.min(new Date(exception.endAt || exception.end_at).getTime(), dayEnd.getTime())),
    }))
    .filter((window) => window.start < window.end);
  const slots: EmergencyBlockableSlot[] = [];
  const windows = [
    ...matchingRules.map((rule) => ({ startMinute: Math.ceil(toMinutes(rule.startTime) / 60) * 60, endMinute: toMinutes(rule.endTime) })),
    ...overrideWindows.map((window) => ({
      startMinute: Math.max(0, Math.ceil((window.start.getTime() - dayStart.getTime()) / 60000 / 60) * 60),
      endMinute: Math.min(24 * 60, Math.floor((window.end.getTime() - dayStart.getTime()) / 60000)),
    })),
  ];
  const seenStarts = new Set<string>();
  for (const window of windows) {
    for (let minute = window.startMinute; minute + 60 <= window.endMinute; minute += 60) {
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
      const exceptionBlocked = activeExceptions.some((exception) => scopedException(exception) && exception.type === 'BLOCK' && overlaps(new Date(exception.startAt || exception.start_at), new Date(exception.endAt || exception.end_at)));
      if (!bookingConflict && !blocked && !exceptionBlocked && !seenStarts.has(startAt)) {
        seenStarts.add(startAt);
        slots.push({ date, startTime, endTime, startAt, endAt });
      }
    }
  }
  return slots;
}

export function isEmergencyBlockDurationAvailable(startAt: string, durationMinutes: number, slots: EmergencyBlockableSlot[]): boolean {
  const end = new Date(new Date(startAt).getTime() + durationMinutes * 60000);
  return durationMinutes >= 60 && durationMinutes % 60 === 0 && slots.some((slot) => slot.startAt === startAt) && slots.filter((slot) => new Date(slot.startAt) >= new Date(startAt) && new Date(slot.endAt) <= end).length === durationMinutes / 60;
}
