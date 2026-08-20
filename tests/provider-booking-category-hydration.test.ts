import { describe, it, expect } from 'vitest';
import { mapBookingFromDb } from '../src/lib/db-service';
import { mapFriendlyErrorMessage } from '../src/lib/error-mapper';
import fs from 'fs';
import path from 'path';

describe('TASK-053 & TASK-053A — RLS-Safe Legacy Booking Category Recovery Tests', () => {
  const baseDbRow = {
    id: 'booking_cat_001',
    student_id: 'student_001',
    provider_id: 'provider_001',
    instructor_id: 'instructor_001',
    vehicle_id: 'vehicle_001',
    offering_id: 'offering_cat_b',
    status: 'CONFIRMED',
    scheduled_start_at: '2026-08-20T10:00:00Z',
    scheduled_end_at: '2026-08-20T10:50:00Z',
    price_in_cents: 10000,
    platform_fee_in_cents: 1000,
    total_in_cents: 11000,
    created_at: '2026-08-18T12:00:00Z',
    snapshot_data: {
      providerName: 'CFC Autoescola Teste',
      instructorName: 'Instrutor Carlos',
      vehicleName: 'Gol 1.0',
      meetingPoint: 'Ponto Central SP',
    },
  };

  it('CASO 1 — Modern snapshot: snapshot_data.category = "B" wins over offeringCategory = "A"', () => {
    const row = {
      ...baseDbRow,
      snapshot_data: {
        ...baseDbRow.snapshot_data,
        category: 'B',
      },
    };
    const b = mapBookingFromDb(row, 'A');
    expect(b.category).toBe('B');
  });

  it('CASO 2 — Legacy booking: missing snapshot.category recovers offeringCategory = "B"', () => {
    const row = {
      ...baseDbRow,
      snapshot_data: {
        ...baseDbRow.snapshot_data,
        // category missing
      },
    };
    const b = mapBookingFromDb(row, 'B');
    expect(b.category).toBe('B');
  });

  it('CASO 3 — Another valid category: missing snapshot.category recovers offeringCategory = "A" without hardcoding B', () => {
    const row = {
      ...baseDbRow,
      offering_id: 'offering_cat_a',
      snapshot_data: {
        ...baseDbRow.snapshot_data,
        // category missing
      },
    };
    const b = mapBookingFromDb(row, 'A');
    expect(b.category).toBe('A');
  });

  it('CASO 4 — Future direct row.category: row.category = "A" takes top priority over snapshot and offering', () => {
    const row = {
      ...baseDbRow,
      category: 'A',
      snapshot_data: {
        ...baseDbRow.snapshot_data,
        category: 'B',
      },
    };
    const b = mapBookingFromDb(row, 'B');
    expect(b.category).toBe('A');
  });

  it('CASO 5 — Sem nenhuma fonte: throws BOOKING_CATEGORY_MISSING fail-closed without defaulting to "B"', () => {
    const row = {
      ...baseDbRow,
      snapshot_data: {
        ...baseDbRow.snapshot_data,
        // category missing
      },
    };
    expect(() => mapBookingFromDb(row, undefined)).toThrowError(/BOOKING_CATEGORY_MISSING/);

    try {
      mapBookingFromDb(row, undefined);
    } catch (err: any) {
      const friendly = mapFriendlyErrorMessage(err, 'Erro ao carregar aula.');
      expect(friendly).toBe('Inconsistência nos dados do agendamento. Categoria não localizada.');
      expect(friendly).not.toContain('BOOKING_CATEGORY_MISSING');
    }
  });

  it('CASO 6 — Workspace lookup: multiple bookings and offerings map strictly by offering_id / booking_id', () => {
    const offeringCategoryMap = new Map<string, string>([
      ['offering_001', 'A'],
      ['offering_002', 'B'],
    ]);

    const row1 = {
      ...baseDbRow,
      id: 'b1',
      offering_id: 'offering_001',
      snapshot_data: { ...baseDbRow.snapshot_data },
    };
    const row2 = {
      ...baseDbRow,
      id: 'b2',
      offering_id: 'offering_002',
      snapshot_data: { ...baseDbRow.snapshot_data },
    };

    const b1 = mapBookingFromDb(row1, offeringCategoryMap.get(row1.offering_id));
    const b2 = mapBookingFromDb(row2, offeringCategoryMap.get(row2.offering_id));

    expect(b1.category).toBe('A');
    expect(b2.category).toBe('B');
  });

  it('CASO 7 — Lifecycle regression (TASK-052 + TASK-053): legacy booking with checkin_instructor_at maps category="B" AND instructorCheckedIn=true', () => {
    const legacyConfirmedWithCheckin = {
      ...baseDbRow,
      status: 'CONFIRMED',
      checkin_instructor_at: '2026-08-20T09:45:00Z',
      snapshot_data: {
        ...baseDbRow.snapshot_data,
        // category missing
      },
    };
    const b = mapBookingFromDb(legacyConfirmedWithCheckin, 'B');

    expect(b.category).toBe('B');
    expect(b.status).toBe('CONFIRMED');
    expect(b.instructorCheckedIn).toBe(true);
    expect(b.checkinInstructorAt).toBe('2026-08-20T09:45:00Z');
  });

  it('CASO 8 — Cancellation metadata integrity: category resolution preserves all cancellation fields', () => {
    const legacyCancelledRow = {
      ...baseDbRow,
      status: 'CANCELLED_BY_STUDENT',
      cancelled_at: '2026-08-19T14:00:00Z',
      cancelled_by: 'STUDENT',
      cancellation_reason: 'Imprevisto pessoal',
      refund_amount_in_cents: 11000,
      snapshot_data: {
        ...baseDbRow.snapshot_data,
        // category missing
      },
    };
    const b = mapBookingFromDb(legacyCancelledRow, 'B');

    expect(b.category).toBe('B');
    expect(b.status).toBe('CANCELLED_BY_STUDENT');
    expect(b.cancelledAt).toBe('2026-08-19T14:00:00Z');
    expect(b.cancelledBy).toBe('STUDENT');
    expect(b.cancellationReason).toBe('Imprevisto pessoal');
    expect(b.refundAmountInCents).toBe(11000);
  });

  it('CASO 9 — Contract constraint: Booking.category is a defined string and never undefined', () => {
    const b = mapBookingFromDb(baseDbRow, 'B');
    expect(typeof b.category).toBe('string');
    expect(b.category).toBe('B');
  });

  it('CASO N — Structural assertion: db-service.ts contains NO direct client SELECT on service_offerings for category fallback in getBookings', () => {
    const dbServiceContent = fs.readFileSync(path.join(__dirname, '../src/lib/db-service.ts'), 'utf-8');
    
    // Ensure getBookings uses get_my_booking_categories RPC and NOT direct service_offerings SELECT
    const getBookingsBlock = dbServiceContent.substring(
      dbServiceContent.indexOf('async getBookings()'),
      dbServiceContent.indexOf('async createBookingHold(')
    );

    expect(getBookingsBlock).toContain("sp.rpc('get_my_booking_categories'");
    expect(getBookingsBlock).not.toContain(".from('service_offerings')");
    expect(getBookingsBlock).not.toContain(".from(\"service_offerings\")");
  });

  it('CASO M — Precedence Order Verification: row.category > snapshot.category > RPC fallback', () => {
    // 1. row.category wins
    const rowWithAll = {
      ...baseDbRow,
      category: 'A',
      snapshot_data: { ...baseDbRow.snapshot_data, category: 'B' },
    };
    expect(mapBookingFromDb(rowWithAll, 'B').category).toBe('A');

    // 2. snapshot.category wins over RPC fallback
    const rowWithSnapshotAndFallback = {
      ...baseDbRow,
      snapshot_data: { ...baseDbRow.snapshot_data, category: 'B' },
    };
    expect(mapBookingFromDb(rowWithSnapshotAndFallback, 'A').category).toBe('B');

    // 3. RPC fallback wins when row and snapshot are missing
    const rowLegacy = {
      ...baseDbRow,
      snapshot_data: { ...baseDbRow.snapshot_data },
    };
    expect(mapBookingFromDb(rowLegacy, 'A').category).toBe('A');
  });

  it('CASO G-K — Migration 53 DDL file validation: verifies RPC get_my_booking_categories security definitions', () => {
    const migrationFile = path.join(__dirname, '../supabase/migrations/20260818000053_secure_booking_category_fallback.sql');
    expect(fs.existsSync(migrationFile)).toBe(true);

    const migrationContent = fs.readFileSync(migrationFile, 'utf-8');
    expect(migrationContent).toContain('CREATE OR REPLACE FUNCTION public.get_my_booking_categories');
    expect(migrationContent).toContain('SECURITY DEFINER');
    expect(migrationContent).toContain("SET search_path = public, pg_temp");
    expect(migrationContent).toContain('public.is_booking_participant(b.id)');
    expect(migrationContent).toContain('REVOKE ALL ON FUNCTION public.get_my_booking_categories(UUID[]) FROM PUBLIC;');
    expect(migrationContent).toContain('GRANT EXECUTE ON FUNCTION public.get_my_booking_categories(UUID[]) TO authenticated, service_role;');
  });
});
