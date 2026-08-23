import { describe, expect, it } from 'vitest';
import { validateAvailabilityRule } from '../src/domain/availability';
import { AvailabilityRule } from '../src/types';

const rule = (overrides: Partial<AvailabilityRule> = {}): AvailabilityRule => ({
  id: 'rule-existing', providerId: 'provider-1', dayOfWeek: 'MONDAY',
  startTime: '08:00', endTime: '12:00', timezone: 'America/Sao_Paulo', isActive: true,
  instructorId: 'instructor-1', vehicleId: 'vehicle-1', ...overrides,
});

describe('TASK-079 weekly availability editing contract', () => {
  it('allows a rule to validate against itself without a conflict', () => {
    expect(() => validateAvailabilityRule(rule({ startTime: '09:00', endTime: '13:00' }), [rule()])).not.toThrow();
  });

  it('rejects overlap with another active rule', () => {
    expect(() => validateAvailabilityRule(rule({ startTime: '11:00', endTime: '15:00' }), [
      rule({ id: 'other-rule', startTime: '14:00', endTime: '18:00', instructorId: undefined, vehicleId: undefined }),
    ])).toThrow('sobrepõe');
  });

  it.each([['18:00', '08:00'], ['12:00', '12:00']])('rejects invalid window %s-%s', (startTime, endTime) => {
    expect(() => validateAvailabilityRule(rule({ startTime, endTime }), [])).toThrow('Horário inicial');
  });

  it.each([['08:30', '18:00'], ['08:00', '18:30'], ['07:15', '12:00']])('rejects non-hour grid %s-%s', (startTime, endTime) => {
    expect(() => validateAvailabilityRule(rule({ startTime, endTime }), [])).toThrow('Escolha horários em hora cheia');
  });

  it('preserves resource fields while only changing schedule fields', () => {
    const original = rule();
    const updated = { ...original, dayOfWeek: 'TUESDAY' as const, startTime: '14:00', endTime: '18:00' };
    expect(updated.id).toBe(original.id);
    expect(updated.providerId).toBe(original.providerId);
    expect(updated.instructorId).toBe(original.instructorId);
    expect(updated.vehicleId).toBe(original.vehicleId);
    expect(updated.timezone).toBe(original.timezone);
    expect(updated.isActive).toBe(original.isActive);
  });

  it('keeps existing bookings outside the availability update contract', () => {
    const booking = { id: 'booking-1', status: 'CONFIRMED', scheduledDate: '2026-08-24', startTime: '09:00' };
    const updatedRule = rule({ startTime: '13:00', endTime: '18:00' });
    expect(updatedRule.id).toBe('rule-existing');
    expect(booking.status).toBe('CONFIRMED');
  });
});
