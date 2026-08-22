// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { groupBookingContextsByInstructor, groupBookingContextsByVehicle } from '../src/apps/student/StudentApp';

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
});
