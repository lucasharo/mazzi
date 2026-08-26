import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildProviderAddressPayload } from '../src/domain/maps/provider-address-payload';

const root = process.cwd();
const appLogin = fs.readFileSync(path.join(root, 'src/components/auth/AppLogin.tsx'), 'utf8');
const migrationCard = fs.readFileSync(
  path.join(root, 'src/apps/student/components/StudentProMigrationCard.tsx'),
  'utf8',
);
const studentRoot = fs.readFileSync(path.join(root, 'src/entrypoints/student/StudentRoot.tsx'), 'utf8');
const providerApp = fs.readFileSync(path.join(root, 'src/apps/provider/ProviderApp.tsx'), 'utf8');
const providerProfile = fs.readFileSync(
  path.join(root, 'src/apps/provider/components/ProviderProfileTab.tsx'),
  'utf8',
);
const publicSearch = fs.readFileSync(path.join(root, 'src/__tests__/student-journey.test.ts'), 'utf8');

describe('PRO onboarding canonical address contract', () => {
  it('uses the shared address form and requires a confirmed Geoapify address', () => {
    expect(appLogin).toContain("from '../provider/ProviderAddressForm'");
    expect(appLogin).toContain('<ProviderAddressForm');
    expect(appLogin).toContain('resolveProviderAddress({');
    expect(appLogin).toContain("validation.mode === 'STANDARD_ADDRESS'");
    expect(appLogin).toContain('Confirme seu endereço profissional para continuar');
  });

  it('routes Student → PRO activation through the onboarding gate', () => {
    expect(migrationCard).toContain('beginInstructorOnboarding();');
    expect(migrationCard).not.toContain('await onboardInstructor();');
    expect(studentRoot).toContain('auth.isInstructorOnboarding');
    expect(appLogin).toContain("setScreen('instructor_onboarding')");
  });

  it('keeps profile editing and onboarding on the same payload mapper', () => {
    expect(appLogin).toContain('buildProviderAddressPayload(confirmedAddressValue)');
    expect(providerApp).toContain('buildProviderAddressPayload({');
    expect(providerProfile).toContain('<ProviderAddressForm');

    const value = {
      addressLine1: 'Rua Icaveta',
      houseNumber: '143',
      complement: 'Casa 2',
      postalCode: '04459-300',
      neighborhood: 'Pedreira',
      city: 'São Paulo',
      state: 'sp',
      address: {
        formatted: 'Rua Icaveta, 143, Pedreira, São Paulo - SP',
        street: 'Rua Icaveta',
        houseNumber: '143',
        postalCode: '04459-300',
        latitude: -23.695757,
        longitude: -46.672569,
        source: 'GEOAPIFY' as const,
      },
    };

    expect(buildProviderAddressPayload(value)).toEqual({
      neighborhood: 'Pedreira',
      city: 'São Paulo',
      state: 'SP',
      postalCode: '04459300',
      address: { ...value.address, postalCode: '04459300', complement: 'Casa 2' },
      latitude: -23.695757,
      longitude: -46.672569,
    });
  });

  it('keeps onboarding retry/idempotency behind the existing RPC and preserves public privacy', () => {
    expect(appLogin).toContain('await onboardInstructor({ keepOnboarding: true });');
    expect(appLogin).toContain('dbService.updateProviderProfile');
    expect(publicSearch).toContain('privateLatitude');
    expect(publicSearch).toContain('privateLongitude');
    expect(publicSearch).not.toContain('firstResult.address');
  });
});
