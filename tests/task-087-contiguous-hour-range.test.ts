import { describe, expect, it } from 'vitest';
import {
  EmergencyBlockableSlot,
  isContiguousHourRange,
  normalizeContiguousHourRange,
  selectContiguousHourRange,
} from '../src/domain/emergency-block';
import fs from 'node:fs';
import path from 'node:path';

const slot = (start: string, end: string, date = '2026-08-24'): EmergencyBlockableSlot => ({
  date,
  startTime: start.slice(11, 16),
  endTime: end.slice(11, 16),
  startAt: start,
  endAt: end,
});

const slots = [
  slot('2026-08-24T09:00:00.000-03:00', '2026-08-24T10:00:00.000-03:00'),
  slot('2026-08-24T10:00:00.000-03:00', '2026-08-24T11:00:00.000-03:00'),
  slot('2026-08-24T11:00:00.000-03:00', '2026-08-24T12:00:00.000-03:00'),
];

describe('TASK-087 — contiguous quick-block hour selection', () => {
  it('selects one hour, expands across available hours, and never crosses a gap', () => {
    expect(selectContiguousHourRange({ availableSlots: slots, selectedSlots: [], clickedSlot: slots[0] })).toEqual([slots[0]]);
    expect(selectContiguousHourRange({ availableSlots: slots, selectedSlots: [slots[0]], clickedSlot: slots[2] })).toEqual(slots);

    const gapSlots = [slots[0], slots[2]];
    expect(selectContiguousHourRange({ availableSlots: gapSlots, selectedSlots: [slots[0]], clickedSlot: slots[2] })).toEqual([slots[2]]);
  });

  it('uses deterministic endpoint behavior instead of creating a discontinuous range', () => {
    expect(selectContiguousHourRange({ availableSlots: slots, selectedSlots: slots, clickedSlot: slots[1] })).toEqual(slots.slice(0, 2));
    expect(selectContiguousHourRange({ availableSlots: slots, selectedSlots: slots, clickedSlot: slots[0] })).toEqual([slots[0]]);
    expect(selectContiguousHourRange({ availableSlots: slots, selectedSlots: [slots[0]], clickedSlot: slots[0] })).toEqual([]);
  });

  it('supports non-full-hour grids and rejects mixed dates or gaps', () => {
    const halfPast = [
      slot('2026-08-24T08:30:00.000-03:00', '2026-08-24T09:30:00.000-03:00'),
      slot('2026-08-24T09:30:00.000-03:00', '2026-08-24T10:30:00.000-03:00'),
      slot('2026-08-24T10:30:00.000-03:00', '2026-08-24T11:30:00.000-03:00'),
    ];
    const quarterPast = [
      slot('2026-08-24T07:15:00.000-03:00', '2026-08-24T08:15:00.000-03:00'),
      slot('2026-08-24T08:15:00.000-03:00', '2026-08-24T09:15:00.000-03:00'),
    ];
    expect(selectContiguousHourRange({ availableSlots: halfPast, selectedSlots: [halfPast[0]], clickedSlot: halfPast[2] })).toEqual(halfPast);
    expect(selectContiguousHourRange({ availableSlots: quarterPast, selectedSlots: [quarterPast[0]], clickedSlot: quarterPast[1] })).toEqual(quarterPast);
    expect(isContiguousHourRange([slots[0], slots[2]])).toBe(false);
    expect(isContiguousHourRange([slots[0], { ...slots[1], date: '2026-08-25' }])).toBe(false);
    expect(normalizeContiguousHourRange([slots[2], slots[0], slots[1]])).toEqual(slots);
  });

  it('keeps the save guard and friendly error in ProviderScheduleTab', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/apps/provider/components/ProviderScheduleTab.tsx'), 'utf8');
    expect(source).toContain('normalizeContiguousHourRange(emergencySelectedSlots)');
    expect(source).toContain('Selecione horários consecutivos para criar o bloqueio.');
    expect(source).toContain('normalizedSlots[0].startAt');
    expect(source).toContain('normalizedSlots[normalizedSlots.length - 1].endAt');
  });
});
