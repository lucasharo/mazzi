import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const studentAppSource = readFileSync(join(process.cwd(), 'src/apps/student/StudentApp.tsx'), 'utf8');

describe('Student booking context vehicle mapping', () => {
  it('preserves an ACTIVE vehicle status when mapping real booking context to Checkout', () => {
    expect(studentAppSource).toContain('dbService.getProviderBookingContextPublic(providerId)');
    expect(studentAppSource).toContain('vehicleFromBookingContext(ctx)');
    expect(studentAppSource).toContain("status: ctx.vehicle_status || 'ACTIVE'");
  });

  it('uses Search as the single student discovery surface', () => {
    expect(studentAppSource).toContain("category: 'B'");
    expect(studentAppSource).toContain("useState<'search' | 'bookings' | 'messages' | 'profile'>('search')");
    expect(studentAppSource).toContain('aria-label="Navegação principal"');
    expect(studentAppSource).toContain("id: 'messages'");
    expect(studentAppSource).toContain('Abrir notificações');
    expect(studentAppSource).not.toContain("id: 'notifications'");
    expect(studentAppSource).not.toContain("id: 'home'");
    expect(studentAppSource).not.toContain('ProviderCard');
  });

  it('keeps discovery public and removes private catalog loads from StudentApp', () => {
    expect(studentAppSource).toContain('dbService.searchPublicProviderResults');
    expect(studentAppSource).toContain('dbService.getBookings()');
    expect(studentAppSource).toContain('getProviderBookingContextPublic(providerId)');
    expect(studentAppSource).not.toContain('dbService.getProviders()');
    expect(studentAppSource).not.toContain('dbService.getVehicles()');
    expect(studentAppSource).not.toContain('dbService.getOfferings()');
  });
});
