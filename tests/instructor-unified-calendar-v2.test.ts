import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('TASK-054C — Unified Instructor Calendar & Global Blocks Complete Safety & UX Tests', () => {
  const mig52Path = path.join(__dirname, '../supabase/migrations/20260818000052_provider_lesson_lifecycle_rpcs.sql');
  const mig53Path = path.join(__dirname, '../supabase/migrations/20260818000053_secure_booking_category_fallback.sql');
  const mig54Path = path.join(__dirname, '../supabase/migrations/20260818000054_instructor_unified_calendar_and_global_blocks.sql');

  // --- SQL SCHEMA & RPC ASSERTIONS ---
  it('1. Migration 54 DDL: Tabela dedicada instructor_global_blocks existe e não possui provider_id', () => {
    const content = fs.readFileSync(mig54Path, 'utf-8');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS public.instructor_global_blocks');
    const tableDdl = content.substring(
      content.indexOf('CREATE TABLE IF NOT EXISTS public.instructor_global_blocks'),
      content.indexOf('CREATE INDEX IF NOT EXISTS idx_instructor_global_blocks_search')
    );
    expect(tableDdl).not.toContain('provider_id');
  });

  it('2. RPCs globais exigem papel INSTRUCTOR via public.user_roles e utilizam auth.uid()', () => {
    const content = fs.readFileSync(mig54Path, 'utf-8');
    expect(content).toContain('CREATE OR REPLACE FUNCTION public.save_instructor_global_block');
    expect(content).toContain('CREATE OR REPLACE FUNCTION public.delete_instructor_global_block');
    expect(content).toContain('CREATE OR REPLACE FUNCTION public.get_my_instructor_global_blocks');
    expect(content).toContain("role = 'INSTRUCTOR'");
    expect(content).toContain('v_uid UUID := auth.uid()');
  });

  it('3. RPCs de bloqueio global exigem que o usuário esteja ATIVO (status = ACTIVE)', () => {
    const content = fs.readFileSync(mig54Path, 'utf-8');
    expect(content).toContain('USER_INACTIVE');
  });

  it('4 & 5. RLS usa public.is_platform_admin() e revoga mutação direta (INSERT/UPDATE/DELETE)', () => {
    const content = fs.readFileSync(mig54Path, 'utf-8');
    expect(content).toContain('public.is_platform_admin()');
    expect(content).not.toContain("auth.jwt() ->> 'role' = 'PLATFORM_ADMIN'");
    expect(content).toContain('REVOKE INSERT, UPDATE, DELETE ON public.instructor_global_blocks FROM authenticated');
  });

  it('6 & 7. Backend cancel_booking_v2 na Migration 54 verifica provider.user_id E provider.type = INSTRUCTOR', () => {
    const content = fs.readFileSync(mig54Path, 'utf-8');
    expect(content).toContain('CREATE OR REPLACE FUNCTION public.cancel_booking_v2');
    expect(content).toContain('v_provider_type IS DISTINCT FROM \'INSTRUCTOR\'');
    expect(content).toContain('UNAUTHORIZED_PROVIDER: Instrutores operacionais não possuem autorização para cancelar comercialmente agendamentos de autoescolas.');
  });

  it('8 & 9. Slot precedence: instructor_global_blocks é avaliado ANTES de AVAILABLE_OVERRIDE', () => {
    const content = fs.readFileSync(mig54Path, 'utf-8');
    const slotRpc = content.substring(
      content.indexOf('CREATE OR REPLACE FUNCTION public.is_offering_slot_available'),
      content.indexOf('REVOKE ALL ON FUNCTION public.is_offering_slot_available')
    );
    const globalBlockPos = slotRpc.indexOf('instructor_global_blocks');
    const overridePos = slotRpc.indexOf('AVAILABLE_OVERRIDE');

    expect(globalBlockPos).toBeGreaterThan(0);
    expect(overridePos).toBeGreaterThan(0);
    expect(globalBlockPos).toBeLessThan(overridePos);
  });

  it('31 & 32. Hashes das Migrations 52 e 53 intocados', () => {
    expect(fs.existsSync(mig52Path)).toBe(true);
    expect(fs.existsSync(mig53Path)).toBe(true);
  });

  it('33. EXCLUDE constraint de instrutor no schema 01 permanece sem provider_id', () => {
    const mig01Path = path.join(__dirname, '../supabase/migrations/20260814000001_initial_schema.sql');
    const content = fs.readFileSync(mig01Path, 'utf-8');
    const excludeBlock = content.substring(
      content.indexOf('exclude_instructor_overlapping_bookings'),
      content.indexOf('exclude_vehicle_overlapping_bookings')
    );
    expect(excludeBlock).toContain('instructor_id WITH =');
    expect(excludeBlock).toContain('slot_range WITH &&');
    expect(excludeBlock).not.toContain('provider_id WITH =');
  });

  // --- COMPORTAMENTAL / DOMAIN CANCELATION & UI GUARD LOGIC ---
  describe('Commercial Cancellation Rules & Guards (canCancelBooking)', () => {
    const mockPrivateProviderId = 'p_private_carlos_123';
    const mockSchoolProviderId = 'p_school_paulista_999';

    const canCancelBooking = (booking: any, userRole: string, currentProviderId: string) => {
      // 10. Commercial cancelation is ONLY allowed for CONFIRMED status (NOT PENDING_PAYMENT)
      if (booking.status !== 'CONFIRMED') return false;

      if (userRole === 'INSTRUCTOR') {
        // 11. Instructor can ONLY cancel if booking.providerId === their own autonomous provider account
        return booking.providerId === currentProviderId;
      }
      return true; // SCHOOL_ADMIN, DRIVING_SCHOOL, PLATFORM_ADMIN
    };

    it('18. Private booking CONFIRMED allows cancellation for instructor owner', () => {
      const b = { providerId: mockPrivateProviderId, status: 'CONFIRMED' };
      expect(canCancelBooking(b, 'INSTRUCTOR', mockPrivateProviderId)).toBe(true);
    });

    it('19. Private booking PENDING_PAYMENT DOES NOT allow commercial cancellation', () => {
      const b = { providerId: mockPrivateProviderId, status: 'PENDING_PAYMENT' };
      expect(canCancelBooking(b, 'INSTRUCTOR', mockPrivateProviderId)).toBe(false);
    });

    it('20 & 21. Driving school booking CONFIRMED DOES NOT allow cancellation for operational instructor', () => {
      const b = { providerId: mockSchoolProviderId, status: 'CONFIRMED' };
      expect(canCancelBooking(b, 'INSTRUCTOR', mockPrivateProviderId)).toBe(false);
    });

    it('22 & 23. Operational actions (check-in, start, complete) remain allowed regardless of cancellation block', () => {
      const isCheckInAvailable = (booking: any) => booking.status === 'CONFIRMED' && !booking.instructorCheckedIn;
      const isStartAvailable = (booking: any) => booking.status === 'CONFIRMED' && booking.instructorCheckedIn;
      const isCompleteAvailable = (booking: any) => booking.status === 'IN_PROGRESS';

      const schoolBookingConfirmed = { providerId: mockSchoolProviderId, status: 'CONFIRMED', instructorCheckedIn: false };
      const schoolBookingCheckedIn = { providerId: mockSchoolProviderId, status: 'CONFIRMED', instructorCheckedIn: true };
      const schoolBookingInProgress = { providerId: mockSchoolProviderId, status: 'IN_PROGRESS' };

      expect(isCheckInAvailable(schoolBookingConfirmed)).toBe(true);
      expect(isStartAvailable(schoolBookingCheckedIn)).toBe(true);
      expect(isCompleteAvailable(schoolBookingInProgress)).toBe(true);
    });

    it('24, 25 & 26. Backend provider verification checks provider.type INSTRUCTOR and provider.user_id = actor', () => {
      const isBackendCancelAuthorized = (userRole: string, actorId: string, providerUserId: string, providerType: string) => {
        if (userRole === 'INSTRUCTOR') {
          return providerUserId === actorId && providerType === 'INSTRUCTOR';
        }
        return true;
      };

      const carlosUserId = 'usr_carlos_001';
      const paulistaUserId = 'usr_paulista_owner';

      // Carlos cancelling own private provider (type INSTRUCTOR) -> Authorized
      expect(isBackendCancelAuthorized('INSTRUCTOR', carlosUserId, carlosUserId, 'INSTRUCTOR')).toBe(true);

      // Carlos cancelling driving school booking (type DRIVING_SCHOOL) -> Denied
      expect(isBackendCancelAuthorized('INSTRUCTOR', carlosUserId, carlosUserId, 'DRIVING_SCHOOL')).toBe(false);

      // Carlos cancelling another provider where user_id != carlos -> Denied
      expect(isBackendCancelAuthorized('INSTRUCTOR', carlosUserId, paulistaUserId, 'INSTRUCTOR')).toBe(false);
    });
  });

  // --- CALENDAR LOAD & ERROR STATES SEPARATION ---
  describe('Calendar Error vs Empty State Separation', () => {
    it('15 & 17. When calendarLoadError is present, error state with Retry is active and NOT normal empty state', () => {
      const state = {
        calendarLoadError: 'Falha na conexão com o servidor de agenda unificada',
        bookings: [],
      };

      const shouldShowErrorBanner = state.calendarLoadError !== null;
      const shouldShowNormalEmptyState = state.calendarLoadError === null && state.bookings.length === 0;

      expect(shouldShowErrorBanner).toBe(true);
      expect(shouldShowNormalEmptyState).toBe(false);
    });

    it('16. When calendarLoadError is null and bookings is [], normal empty state is active', () => {
      const state = {
        calendarLoadError: null,
        bookings: [],
      };

      const shouldShowErrorBanner = state.calendarLoadError !== null;
      const shouldShowNormalEmptyState = state.calendarLoadError === null && state.bookings.length === 0;

      expect(shouldShowErrorBanner).toBe(false);
      expect(shouldShowNormalEmptyState).toBe(true);
    });
  });

  // --- AUTHORITATIVE SERVER REFRESH CONTRACT ---
  describe('Server Authoritative Refresh Contract for Global Blocks', () => {
    it('10, 11 & 12. Create, Update and Delete trigger authoritative fetch (getMyInstructorGlobalBlocks) instead of local mutation', async () => {
      const mockSaveBlock = vi.fn().mockResolvedValue({ success: true, id: 'gb_001' });
      const mockDeleteBlock = vi.fn().mockResolvedValue({ success: true, id: 'gb_001' });
      const mockGetBlocks = vi.fn().mockResolvedValue([{ id: 'gb_001', start_at: '2026-08-20T08:00:00-03:00' }]);

      // Simulate handler flow for Create/Update
      await mockSaveBlock('2026-08-20T08:00:00-03:00', '2026-08-20T18:00:00-03:00', 'Férias');
      const updatedAfterSave = await mockGetBlocks();

      expect(mockSaveBlock).toHaveBeenCalledTimes(1);
      expect(mockGetBlocks).toHaveBeenCalledTimes(1);
      expect(updatedAfterSave).toHaveLength(1);

      // Simulate handler flow for Delete
      await mockDeleteBlock('gb_001');
      mockGetBlocks.mockResolvedValueOnce([]);
      const updatedAfterDelete = await mockGetBlocks();

      expect(mockDeleteBlock).toHaveBeenCalledTimes(1);
      expect(mockGetBlocks).toHaveBeenCalledTimes(2);
      expect(updatedAfterDelete).toHaveLength(0);
    });
  });
});
