import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const studentAppSource = readFileSync(join(process.cwd(), 'src/apps/student/StudentApp.tsx'), 'utf8');

describe('Student bookings/search error isolation', () => {
  it('keeps searchError exclusive to the public search pipeline', () => {
    expect(studentAppSource).toContain("setSearchError(false);");
    expect(studentAppSource).toContain("setSearchError(true);");
    expect(studentAppSource).toContain('dbService.searchPublicProviderResults');
    expect(studentAppSource).not.toContain('setSearchError(true);\n      } finally');
  });

  it('gives bookings their own loading/error state and retry', () => {
    expect(studentAppSource).toContain('bookingsLoading');
    expect(studentAppSource).toContain('bookingsError');
    expect(studentAppSource).toContain('dbService.getBookings()');
    expect(studentAppSource).toContain('setBookingsRefreshKey((value) => value + 1)');
    expect(studentAppSource).toContain('Não foi possível carregar suas aulas.');
  });

  it('does not render booking/chat empty states while bookings are loading or failed', () => {
    expect(studentAppSource).toContain('!bookingsError && !bookingsLoading && bookingTab === \'upcoming\'');
    expect(studentAppSource).toContain('bookingsError ? <div role="alert"');
    expect(studentAppSource).toContain('Não foi possível carregar suas conversas.');
    expect(studentAppSource).toContain('Nenhuma conversa disponível');
  });
});
