import { describe, expect, it } from 'vitest';
import { countAdditionalStudentFilters, formatStudentResultCount, STUDENT_NAV_ITEMS } from '../lib/student-search-ui';

describe('Student Experience Phase 2 search UI', () => {
  it('uses search as the only discovery destination', () => {
    expect(STUDENT_NAV_ITEMS).toEqual(['search', 'bookings', 'messages', 'profile']);
    expect(STUDENT_NAV_ITEMS).not.toContain('home');
  });

  it('counts only non-default filters', () => {
    expect(countAdditionalStudentFilters({ category: 'B', providerType: 'ALL', transmission: 'ALL', radiusMeters: 10000, sortBy: 'RECOMMENDED' })).toBe(0);
    expect(countAdditionalStudentFilters({ category: 'B', providerType: 'INSTRUCTOR', transmission: 'AUTOMATIC', radiusMeters: 5000, maxPriceInCents: 15000 })).toBe(4);
  });

  it('formats singular and plural result counts', () => {
    expect(formatStudentResultCount(1)).toBe('1 profissional encontrado');
    expect(formatStudentResultCount(8)).toBe('8 profissionais encontrados');
  });
});
