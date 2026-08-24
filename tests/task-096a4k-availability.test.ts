import { describe, expect, it } from 'vitest';
import {
  generateAvailableSlots,
  normalizeWeeklyAvailabilityRuleForProvider,
} from '../src/domain/availability';
import type { AvailabilityRule, ServiceOffering, Vehicle } from '../src/types';

const providerId = 'provider-instructor';
const instructorId = providerId;
const baseRule: AvailabilityRule = {
  id: 'rule-1',
  providerId,
  instructorId,
  vehicleId: 'vehicle-legacy',
  dayOfWeek: 'MONDAY',
  dayOfWeekNumber: 1,
  startTime: '08:00',
  endTime: '10:00',
  timezone: 'America/Sao_Paulo',
  isActive: true,
};

const vehicles: Vehicle[] = [
  { id: 'vehicle-a', providerId, brand: 'Toyota', model: 'Yaris', year: 2024, licensePlate: 'AAA0001', category: 'B', vehicleType: 'CAR', transmission: 'AUTOMATIC', color: 'Prata', status: 'ACTIVE' },
  { id: 'vehicle-b', providerId, brand: 'Honda', model: 'City', year: 2026, licensePlate: 'BBB0002', category: 'B', vehicleType: 'CAR', transmission: 'AUTOMATIC', color: 'Branco', status: 'ACTIVE' },
  { id: 'vehicle-c', providerId, brand: 'BYD', model: 'Song', year: 2026, licensePlate: 'CCC0003', category: 'B', vehicleType: 'CAR', transmission: 'MANUAL', color: 'Preto', status: 'ACTIVE' },
] as Vehicle[];

const offerings: ServiceOffering[] = vehicles.map((vehicle, index) => ({
  id: `offering-${index}`,
  providerId,
  instructorId,
  vehicleId: vehicle.id,
  category: 'B',
  durationMinutes: 50,
  priceInCents: 9500,
  status: 'ACTIVE',
})) as ServiceOffering[];

const monday = '2026-08-24';
const provider = {
  id: providerId,
  userId: 'user-instructor',
  type: 'INSTRUCTOR' as const,
  name: 'Instrutor Autônomo',
  status: 'ACTIVE' as const,
} as any;

const generateForOffering = (offering: ServiceOffering, exceptions: any[] = [], existingBookings: any[] = []) =>
  generateAvailableSlots({
    offering,
    provider,
    vehicles,
    startDate: monday,
    endDate: monday,
    availabilityRules: [normalizeWeeklyAvailabilityRuleForProvider(baseRule, 'INSTRUCTOR')],
    exceptions,
    existingBookings,
    now: new Date('2026-08-23T12:00:00-03:00'),
  });

describe('TASK-096A4K autonomous instructor weekly availability', () => {
  it('clears a legacy vehicle scope for autonomous instructor rules', () => {
    expect(normalizeWeeklyAvailabilityRuleForProvider(baseRule, 'INSTRUCTOR').vehicleId).toBeUndefined();
  });

  it('preserves vehicle scope for driving-school rules', () => {
    expect(normalizeWeeklyAvailabilityRuleForProvider(baseRule, 'DRIVING_SCHOOL').vehicleId).toBe('vehicle-legacy');
  });

  it('generates slots for all active vehicles from one global instructor rule', () => {
    const slots = offerings.flatMap((offering) => generateForOffering(offering));
    expect(new Set(slots.map((slot) => slot.vehicleId))).toEqual(new Set(['vehicle-a', 'vehicle-b', 'vehicle-c']));
  });

  it('blocks every vehicle when the instructor is already booked', () => {
    const booking = {
        id: 'booking-1', providerId, instructorId, vehicleId: 'vehicle-a', offeringId: 'offering-0',
        scheduledDate: monday, startTime: '08:00', endTime: '10:00',
        status: 'CONFIRMED',
      } as any;
    const slots = offerings.flatMap((offering) => generateForOffering(offering, [], [booking]));

    expect(slots).toHaveLength(0);
  });

  it('keeps a vehicle-specific block limited to that vehicle', () => {
    const block = {
        id: 'exception-1', providerId, instructorId, vehicleId: 'vehicle-b', type: 'BLOCK', reasonCategory: 'MANUAL_BLOCK',
        reason: 'Manutenção', startAt: `${monday}T00:00:00-03:00`, endAt: '2026-08-25T00:00:00-03:00', isActive: true,
      } as any;
    const slots = offerings.flatMap((offering) => generateForOffering(offering, [block]));

    expect(new Set(slots.map((slot) => slot.vehicleId))).toEqual(new Set(['vehicle-a', 'vehicle-c']));
  });
});
