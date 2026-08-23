import { describe, expect, it } from 'vitest';
import { generateEmergencyBlockableSlots, isEmergencyBlockDurationAvailable } from '../src/domain/emergency-block';
import { renderToStaticMarkup } from 'react-dom/server';
import { DateTimeSlotPicker } from '../src/components/schedule/DateTimeSlotPicker';

const rules = [{ isActive: true, dayOfWeek: 'SATURDAY', startTime: '09:00', endTime: '13:00' }];
const base = { date: '2026-08-22', rules, exceptions: [], globalBlocks: [], now: new Date('2026-08-21T12:00:00-03:00') };

describe('TASK-080B emergency calendar domain flow', () => {
  it('excludes active holds, confirmed and in-progress bookings across providers', () => {
    const slots = generateEmergencyBlockableSlots({ ...base, bookings: [
      { providerId: 'other-provider', status: 'CONFIRMED', scheduledStartAt: '2026-08-22T09:00:00-03:00', scheduledEndAt: '2026-08-22T10:00:00-03:00' },
      { providerId: 'other-provider', status: 'IN_PROGRESS', scheduledStartAt: '2026-08-22T10:00:00-03:00', scheduledEndAt: '2026-08-22T11:00:00-03:00' },
      { providerId: 'other-provider', status: 'PENDING_PAYMENT', holdExpiresAt: '2026-08-22T12:00:00-03:00', scheduledStartAt: '2026-08-22T11:00:00-03:00', scheduledEndAt: '2026-08-22T12:00:00-03:00' },
    ] });
    expect(slots.map((slot) => slot.startTime)).not.toEqual(expect.arrayContaining(['09:00', '09:30', '10:00', '10:30', '11:00', '11:30']));
    expect(slots.some((slot) => slot.startTime === '12:00')).toBe(true);
  });

  it('allows expired, completed and cancelled bookings, but applies global blocks and exceptions', () => {
    const slots = generateEmergencyBlockableSlots({ ...base, bookings: [
      { status: 'PENDING_PAYMENT', holdExpiresAt: '2026-08-21T11:00:00-03:00', scheduledStartAt: '2026-08-22T09:00:00-03:00', scheduledEndAt: '2026-08-22T10:00:00-03:00' },
      { status: 'COMPLETED', scheduledStartAt: '2026-08-22T10:00:00-03:00', scheduledEndAt: '2026-08-22T11:00:00-03:00' },
      { status: 'CANCELLED_BY_PROVIDER', scheduledStartAt: '2026-08-22T11:00:00-03:00', scheduledEndAt: '2026-08-22T12:00:00-03:00' },
    ], globalBlocks: [{ start_at: '2026-08-22T12:00:00-03:00', end_at: '2026-08-22T13:00:00-03:00' }], exceptions: [{ type: 'BLOCK', startAt: '2026-08-22T09:30:00-03:00', endAt: '2026-08-22T10:30:00-03:00' }] });
    expect(slots.map((slot) => slot.startTime)).toEqual(['11:00']);
  });

  it('only enables durations whose complete hourly sequence is free', () => {
    const slots = generateEmergencyBlockableSlots(base);
    expect(isEmergencyBlockDurationAvailable('2026-08-22T09:00:00.000-03:00', 120, slots)).toBe(true);
    expect(isEmergencyBlockDurationAvailable('2026-08-22T12:00:00.000-03:00', 120, slots)).toBe(false);
  });

  it('uses one shared calendar picker component for the PRO flow', () => {
    const markup = renderToStaticMarkup(<DateTimeSlotPicker slotsByDate={{}} selectedDate="2026-08-22" selectedSlot={null} onDateChange={() => undefined} onSlotChange={() => undefined} />);
    expect(markup).toContain('Horários livres');
    expect(markup).toContain('Mês anterior');
  });
});
