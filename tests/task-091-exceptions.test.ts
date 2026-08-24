import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateEmergencyBlockableSlots } from '../src/domain/emergency-block';

const root = process.cwd();
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260824010806_task_091_exception_active_and_override_parity.sql'), 'utf8');
const date = '2026-08-26';
const now = new Date('2026-08-20T12:00:00-03:00');
const rule = { isActive: true, dayOfWeekNumber: 3, startTime: '08:00', endTime: '18:00' };

describe('TASK-091 exception active state and override parity', () => {
  it('ignores inactive BLOCK exceptions and inactive AVAILABLE_OVERRIDE exceptions', () => {
    const slots = generateEmergencyBlockableSlots({
      date, now, rules: [rule],
      exceptions: [
        { type: 'BLOCK', isActive: false, startAt: `${date}T08:00:00-03:00`, endAt: `${date}T10:00:00-03:00` },
        { type: 'AVAILABLE_OVERRIDE', isActive: false, startAt: `${date}T18:00:00-03:00`, endAt: `${date}T20:00:00-03:00` },
      ],
    });
    expect(slots.map((slot) => slot.startTime)).toContain('08:00');
    expect(slots.map((slot) => slot.startTime)).not.toContain('18:00');
  });

  it('adds active override hours, keeps only full-hour starts, and deduplicates with recurring rules', () => {
    const slots = generateEmergencyBlockableSlots({
      date, now, rules: [rule],
      exceptions: [
        { type: 'AVAILABLE_OVERRIDE', isActive: true, startAt: `${date}T08:30:00-03:00`, endAt: `${date}T12:30:00-03:00` },
      ],
    });
    expect(slots.map((slot) => slot.startTime)).toEqual(['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00']);
    expect(slots.filter((slot) => slot.startTime === '09:00')).toHaveLength(1);
  });

  it('lets active BLOCK exceptions win over recurring and override availability', () => {
    const slots = generateEmergencyBlockableSlots({
      date, now, rules: [],
      exceptions: [
        { type: 'AVAILABLE_OVERRIDE', isActive: true, startAt: `${date}T08:00:00-03:00`, endAt: `${date}T11:00:00-03:00` },
        { type: 'BLOCK', isActive: true, startAt: `${date}T09:00:00-03:00`, endAt: `${date}T10:00:00-03:00` },
      ],
    });
    expect(slots.map((slot) => slot.startTime)).toEqual(['08:00', '10:00']);
  });

  it('applies scoped exceptions only to the matching provider and instructor', () => {
    const slots = generateEmergencyBlockableSlots({
      date, now, rules: [rule], providerId: 'provider-a', instructorId: 'instructor-a',
      exceptions: [{ type: 'BLOCK', isActive: true, providerId: 'provider-b', instructorId: 'instructor-b', startAt: `${date}T08:00:00-03:00`, endAt: `${date}T09:00:00-03:00` }],
    });
    expect(slots.map((slot) => slot.startTime)).toContain('08:00');
  });

  it('hardens both LIVE availability engines against inactive exceptions and non-hour starts', () => {
    expect(migration).toContain("x.type = 'BLOCK' AND x.is_active IS TRUE");
    expect(migration).toContain("x.type = 'AVAILABLE_OVERRIDE' AND x.is_active IS TRUE");
    expect(migration).toContain("e.type = 'AVAILABLE_OVERRIDE' AND e.is_active IS TRUE");
    expect(migration).toContain("EXTRACT(MINUTE FROM local_start) <> 0");
    expect(migration).toContain("INTERVAL '1 hour'");
    expect(migration).toContain('UNION');
  });
});
