import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createServiceOffering, OfferingDomainError } from '../src/domain/vehicles-offerings';
import type { ServiceOffering, Vehicle } from '../src/types';

const migration = fs.readFileSync(
  path.join(__dirname, '../supabase/migrations/20260822002426_fix_school_offering_instructor_scope.sql'),
  'utf8',
);
const hardeningMigration = fs.readFileSync(
  path.join(__dirname, '../supabase/migrations/20260822003353_harden_school_offering_insert_context.sql'),
  'utf8',
);
const grantMigration = fs.readFileSync(
  path.join(__dirname, '../supabase/migrations/20260822003439_grant_offering_context_check.sql'),
  'utf8',
);
const readMigration = fs.readFileSync(
  path.join(__dirname, '../supabase/migrations/20260822003618_allow_provider_offering_reads.sql'),
  'utf8',
);
const securityMigrations = [migration, hardeningMigration, grantMigration, readMigration].join('\n');

const vehicle: Vehicle = {
  id: 'vehicle-onix',
  providerId: 'school-paulista',
  brand: 'Chevrolet',
  model: 'Onix Plus',
  year: 2024,
  licensePlate: 'MZZ1J09',
  licensePlateMasked: 'MZZ1J09',
  category: 'B',
  vehicleType: 'CAR',
  transmission: 'AUTOMATIC',
  status: 'ACTIVE',
  color: 'Branco',
  photos: [],
  createdAt: '2026-08-21T00:00:00.000Z',
  updatedAt: '2026-08-21T00:00:00.000Z',
};

const create = (instructorId: string, existingOfferings: ServiceOffering[] = []) => createServiceOffering({
  providerId: 'school-paulista',
  instructorId,
  vehicle,
  category: 'B',
  durationMinutes: 50,
  priceInCents: 9500,
  existingOfferings,
});

describe('school offerings scoped by instructor', () => {
  it('allows Carlos and Fernanda to share vehicle/category/duration', () => {
    const carlosOffering = create('instructor-carlos');
    const fernandaOffering = create('instructor-fernanda', [carlosOffering]);

    expect(carlosOffering.instructorId).toBe('instructor-carlos');
    expect(fernandaOffering.instructorId).toBe('instructor-fernanda');
  });

  it('blocks only an exact active duplicate for the same instructor', () => {
    const carlosOffering = create('instructor-carlos');

    expect(() => create('instructor-carlos', [carlosOffering])).toThrowError(OfferingDomainError);
    expect(() => create('instructor-fernanda', [carlosOffering])).not.toThrow();
  });

  it('requires an instructor and keeps the autonomous identity explicit', () => {
    expect(() => createServiceOffering({
      providerId: 'school-paulista',
      instructorId: '',
      vehicle,
      category: 'B',
      durationMinutes: 50,
      priceInCents: 9500,
    })).toThrowError(/Instrutor da oferta é obrigatório/i);

    const autonomous = createServiceOffering({
      providerId: 'autonomous-provider',
      instructorId: 'autonomous-user',
      vehicle: { ...vehicle, providerId: 'autonomous-provider' },
      category: 'B',
      durationMinutes: 50,
      priceInCents: 9500,
    });
    expect(autonomous.instructorId).toBe('autonomous-user');
  });

  it('enforces school membership context server-side', () => {
    expect(securityMigrations).toContain("p.type = 'DRIVING_SCHOOL'::public.provider_type");
    expect(securityMigrations).toContain("dss.membership_status = 'ACTIVE'::public.school_membership_status");
    expect(securityMigrations).toContain('dss.is_active IS TRUE');
    expect(securityMigrations).toContain("dss.role = 'INSTRUCTOR'::public.user_role");
    expect(securityMigrations).toContain("p.type = 'INSTRUCTOR'::public.provider_type");
    expect(securityMigrations).toContain('p_instructor_id = p.user_id');
    expect(securityMigrations).toContain('v.provider_id = p.id');
    expect(securityMigrations).toContain('SECURITY DEFINER');
    expect(grantMigration).toContain('GRANT EXECUTE ON FUNCTION public.can_manage_service_offering');
    expect(readMigration).toContain('CREATE POLICY offerings_owner_select');
    expect(securityMigrations).not.toContain("membership_status = 'PENDING_COMPLIANCE'");
    expect(securityMigrations).not.toContain("membership_status = 'SUSPENDED'");
    expect(securityMigrations).not.toContain("membership_status = 'ENDED'");
  });
});
