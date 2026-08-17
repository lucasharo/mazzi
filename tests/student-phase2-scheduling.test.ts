import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const profile = readFileSync(join(root, 'src/components/search/ProviderPublicProfileModal.tsx'), 'utf8');
const student = readFileSync(join(root, 'src/apps/student/StudentApp.tsx'), 'utf8');
const slots = readFileSync(join(root, 'src/apps/student/components/SlotSelectorModal.tsx'), 'utf8');
const checkout = readFileSync(join(root, 'src/apps/student/components/CheckoutModal.tsx'), 'utf8');

describe('Student new template phase 2 scheduling contracts', () => {
  it('uses public profile data with real avatar, rating, location and offering fields', () => {
    expect(profile).toContain('result.avatarUrl');
    expect(profile).toContain('Novo na MAZZI');
    expect(profile).toContain('result.neighborhood');
    expect(profile).toContain('result.city');
    expect(profile).toContain("offering.category === 'B'");
    expect(profile).toContain('offering.vehicleTitle');
    expect(profile).toContain('offering.durationMinutes');
    expect(profile).not.toContain(', SP');
  });

  it('keeps the CFC picker on public booking context and removes the orphan slot prop', () => {
    expect(student).toContain('getProviderBookingContextPublic(providerId)');
    expect(student).toContain('ctx.instructor_name');
    expect(student).toContain('vehicleFromBookingContext(ctx)');
    expect(slots).not.toContain('existingBookings');
  });

  it('keeps slot authority in the public RPC and requires a real selected slot for checkout', () => {
    expect(slots).toContain("get_available_slots_public");
    expect(slots).toContain('INITIAL_WINDOW_DAYS = 30');
    expect(slots).toContain('LOAD_MORE_DAYS = 30');
    expect(slots).toContain('MAX_HORIZON_DAYS = 90');
    expect(checkout).toContain('if (!scheduledStartAt || !scheduledDate || !startTime || !endTime)');
    expect(student).toContain('selectedSlot && checkoutProvider && checkoutVehicle && checkoutOffering');
    expect(student).not.toContain("'2026-09-01'");
    expect(student).not.toContain("|| '10:00'");
    expect(student).not.toContain("|| '10:50'");
  });
});
