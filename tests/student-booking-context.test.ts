// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  filterBookingContextsByInstructor,
  groupBookingContextsByInstructor,
  groupBookingContextsByVehicle,
  isBookingSlotCompatibleWithOffering,
  mergePagedProviderResults,
  uniqueBookingOfferingContexts,
} from '../src/apps/student/StudentApp';

describe('Student booking context instructor selection', () => {
  it('groups multiple offerings from one school by distinct instructor', () => {
    const contexts = groupBookingContextsByInstructor([
      { instructor_id: 'joao', offering_id: 'offering-a', instructor_name: 'João' },
      { instructor_id: 'joao', offering_id: 'offering-b', instructor_name: 'João' },
      { instructor_id: 'maria', offering_id: 'offering-c', instructor_name: 'Maria' },
    ]);

    expect(contexts).toHaveLength(2);
    expect(contexts.map((context) => context.instructor_id)).toEqual(['joao', 'maria']);
    expect(contexts.filter((context) => context.instructor_id === 'joao')).toHaveLength(1);
    expect(contexts.filter((context) => context.instructor_id === 'maria')).toHaveLength(1);
  });

  it('keeps one instructor with several offerings as one choice', () => {
    const contexts = groupBookingContextsByInstructor([
      { instructorId: 'joao', offering_id: 'offering-a' },
      { instructorId: 'joao', offering_id: 'offering-b' },
    ]);

    expect(contexts).toHaveLength(1);
    expect(contexts[0].offering_id).toBe('offering-a');
  });

  it('keeps multiple vehicles for the same instructor as separate choices', () => {
    const contexts = groupBookingContextsByVehicle([
      { instructor_id: 'fernanda', vehicle_id: 'honda-city', offering_id: 'offering-honda' },
      { instructor_id: 'fernanda', vehicle_id: 'vw-polo', offering_id: 'offering-polo' },
    ]);

    expect(contexts).toHaveLength(2);
    expect(contexts.map((context) => context.vehicle_id)).toEqual(['honda-city', 'vw-polo']);
  });

  it('does not duplicate one vehicle when it has multiple offerings', () => {
    const contexts = groupBookingContextsByVehicle([
      { instructor_id: 'fernanda', vehicle_id: 'honda-city', offering_id: 'offering-50' },
      { instructor_id: 'fernanda', vehicle_id: 'honda-city', offering_id: 'offering-60' },
    ]);

    expect(contexts).toHaveLength(1);
    expect(contexts[0].offering_id).toBe('offering-50');
  });

  it('preserves every offering, including distinct offerings on the same vehicle', () => {
    const contexts = uniqueBookingOfferingContexts([
      { instructor_id: 'joao', vehicle_id: 'honda-city', offering_id: 'offering-50', duration_minutes: 50 },
      { instructor_id: 'joao', vehicle_id: 'honda-city', offering_id: 'offering-60', duration_minutes: 60 },
      { instructor_id: 'joao', vehicle_id: 'vw-polo', offering_id: 'offering-50-polo', duration_minutes: 50 },
    ]);

    expect(contexts.map((context) => context.offering_id)).toEqual([
      'offering-50',
      'offering-60',
      'offering-50-polo',
    ]);
  });

  it('filters the original context collection after selecting an instructor', () => {
    const contexts = [
      { instructor_id: 'joao', offering_id: 'onix-manual' },
      { instructor_id: 'joao', offering_id: 'onix-automatic' },
      { instructor_id: 'maria', offering_id: 'polo-manual' },
    ];

    expect(filterBookingContextsByInstructor(contexts, 'joao').map((context) => context.offering_id))
      .toEqual(['onix-manual', 'onix-automatic']);
  });

  it('does not reuse a slot belonging to another offering', () => {
    expect(isBookingSlotCompatibleWithOffering({ offering_id: 'offering-a' }, 'offering-a')).toBe(true);
    expect(isBookingSlotCompatibleWithOffering({ offering_id: 'offering-a' }, 'offering-b')).toBe(false);
    expect(isBookingSlotCompatibleWithOffering({ offering_id: 'offering-a' }, 'offering-a')).toBe(true);
    expect(isBookingSlotCompatibleWithOffering(null, 'offering-a')).toBe(false);
  });

  it('loads more than ten map results, dedupes provider ids, and caps the map safely', () => {
    const results = Array.from({ length: 26 }, (_, index) => ({ providerId: `provider-${index}` } as any));
    const merged = mergePagedProviderResults(results.slice(0, 12), [results[11], ...results.slice(12)], 'map');
    expect(merged).toHaveLength(26);
    expect(new Set(merged.map((result) => result.providerId)).size).toBe(26);
  });

  it('caps map pagination at the explicit safety limit', () => {
    const results = Array.from({ length: 60 }, (_, index) => ({ providerId: `provider-${index}` } as any));
    expect(mergePagedProviderResults([], results, 'map')).toHaveLength(50);
    expect(mergePagedProviderResults([], results, 'list')).toHaveLength(60);
  });
});
