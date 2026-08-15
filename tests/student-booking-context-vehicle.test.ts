import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const studentAppSource = readFileSync(join(process.cwd(), 'src/apps/student/StudentApp.tsx'), 'utf8');

describe('Student booking context vehicle mapping', () => {
  it('preserves an ACTIVE vehicle status when mapping real booking context to Checkout', () => {
    expect(studentAppSource).toContain('dbService.getProviderBookingContextPublic(providerId)');
    expect(studentAppSource).toContain('dbVehicles.find((vehicle) => vehicle.id === ctx.vehicle_id)');
    expect(studentAppSource).toContain("status: ctx.vehicle_status || 'ACTIVE'");
  });

  it('keeps the MVP student home focused on Category B instead of hiding results behind Category A', () => {
    expect(studentAppSource).toContain("category: 'B'");
    expect(studentAppSource).toContain('Categoria A — em breve');
    expect(studentAppSource).toContain('disabled');
    expect(studentAppSource).not.toContain("handleUpdateSearch({ category: 'A' })");
    expect(studentAppSource).not.toContain('.slice(0, 2).map((prov) => (');
    expect(studentAppSource).toContain('.slice(0, 10).map((prov) => (');
  });
});
