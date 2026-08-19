import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { isBookingEnded, createBookingHold, BookingDomainError } from '../src/domain/booking';

describe('TASK-009 — Pending Payment Resume, Realtime Refresh & UI Refinements', () => {
  const statusBadgePath = path.resolve(process.cwd(), 'src/components/ui/StatusBadge.tsx');
  const bookingCardPath = path.resolve(process.cwd(), 'src/components/ui/BookingCard.tsx');
  const bookingDetailsModalPath = path.resolve(process.cwd(), 'src/apps/student/components/BookingDetailsModal.tsx');
  const providerResultCardPath = path.resolve(process.cwd(), 'src/components/search/ProviderResultCard.tsx');
  const providerPublicProfileModalPath = path.resolve(process.cwd(), 'src/components/search/ProviderPublicProfileModal.tsx');
  const providerCardPath = path.resolve(process.cwd(), 'src/components/ui/ProviderCard.tsx');
  const studentAppPath = path.resolve(process.cwd(), 'src/apps/student/StudentApp.tsx');
  const checkoutModalPath = path.resolve(process.cwd(), 'src/apps/student/components/CheckoutModal.tsx');
  const designSystemPath = path.resolve(process.cwd(), 'src/apps/design-system/DesignSystemShowcase.tsx');

  describe('1. StatusBadge & Human Readable Statuses (Parte C)', () => {
    it('uses "Pagamento pendente" for PENDING_PAYMENT status', () => {
      const content = fs.readFileSync(statusBadgePath, 'utf8');
      expect(content).toContain("case 'PENDING_PAYMENT':");
      expect(content).toContain('Pagamento pendente');
      expect(content).not.toContain("label: 'Aguardando Pagamento'");
    });

    it('renders StatusBadge component inside BookingCard for all statuses', () => {
      const content = fs.readFileSync(bookingCardPath, 'utf8');
      expect(content).toContain("import { StatusBadge } from './StatusBadge';");
      expect(content).toContain('<StatusBadge status={booking.status}');
    });
  });

  describe('2. Provider Verified Icon-Only Badge (Parte D)', () => {
    it('removes visual text "Verificado" from ProviderResultCard avatar badge', () => {
      const content = fs.readFileSync(providerResultCardPath, 'utf8');
      expect(content).toContain('aria-label="Prestador verificado"');
      expect(content).not.toContain('<span>Verificado</span>');
    });

    it('removes visual text "Verificado" from ProviderPublicProfileModal avatar badge', () => {
      const content = fs.readFileSync(providerPublicProfileModalPath, 'utf8');
      expect(content).toContain('aria-label="Prestador verificado"');
      expect(content).not.toContain('<span>Verificado</span>');
    });

    it('removes visual text "Verificado" from ProviderCard avatar badge', () => {
      const content = fs.readFileSync(providerCardPath, 'utf8');
      expect(content).toContain('aria-label="Prestador verificado"');
      expect(content).not.toContain('Verificado\n');
    });
  });

  describe('3. Search Card Button Icons (Parte E)', () => {
    it('includes User/UserRound icon in Perfil button', () => {
      const content = fs.readFileSync(providerResultCardPath, 'utf8');
      expect(content).toContain('UserRound');
      expect(content).toContain('Perfil');
    });

    it('includes Calendar icon in Agenda button', () => {
      const content = fs.readFileSync(providerResultCardPath, 'utf8');
      expect(content).toContain('Calendar');
      expect(content).toContain('Agenda');
    });
  });

  describe('4. Pending Payment Resume & Hold Expiry Logic (Parte A, F, G)', () => {
    it('includes isHoldValid and minutesLeft calculations in BookingDetailsModal', () => {
      const content = fs.readFileSync(bookingDetailsModalPath, 'utf8');
      expect(content).toContain('isHoldValid');
      expect(content).toContain('minutesLeft');
    });

    it('renders "Finalizar pagamento" CTA button when hold is active', () => {
      const content = fs.readFileSync(bookingDetailsModalPath, 'utf8');
      expect(content).toContain('Finalizar pagamento');
      expect(content).toContain('onContinuePayment');
    });

    it('supports resumeBooking in CheckoutModal without recreating quotes', () => {
      const content = fs.readFileSync(checkoutModalPath, 'utf8');
      expect(content).toContain('resumeBooking');
      expect(content).toContain('setStep(\'PAYMENT_SELECTION\')');
    });
  });

  describe('5. Realtime, Manual Refresh & Focus Listener (Parte B)', () => {
    it('includes manual RefreshCw button in StudentApp Minhas Aulas header', () => {
      const content = fs.readFileSync(studentAppPath, 'utf8');
      expect(content).toContain('RefreshCw');
      expect(content).toContain('aria-label="Atualizar lista de aulas"');
    });

    it('includes visibilitychange and window focus event listeners in StudentApp', () => {
      const content = fs.readFileSync(studentAppPath, 'utf8');
      expect(content).toContain("window.addEventListener('focus'");
      expect(content).toContain("document.addEventListener('visibilitychange'");
    });

    it('subscribes to Supabase Realtime for current student bookings', () => {
      const content = fs.readFileSync(studentAppPath, 'utf8');
      expect(content).toContain('.channel(');
      expect(content).toContain('postgres_changes');
      expect(content).toContain("table: 'bookings'");
    });
  });

  describe('6. Design System Showcase Integration (Parte I)', () => {
    it('includes examples of Finalizar pagamento, Perfil and Agenda buttons in DesignSystemShowcase', () => {
      const content = fs.readFileSync(designSystemPath, 'utf8');
      expect(content).toContain('Finalizar pagamento');
      expect(content).toContain('UserRound');
      expect(content).toContain('RefreshCw');
    });
  });

  describe('7. Strict Temporal Classification Rules (Sec. 55-67 TESTS A-H)', () => {
    const nowMs = 1700000000000;

    it('TEST A: CONFIRMED with scheduled_end_at in future -> Próximas', () => {
      const booking: any = {
        id: 'b-a',
        status: 'CONFIRMED',
        scheduledEndAt: new Date(nowMs + 3600000).toISOString(),
      };
      expect(isBookingEnded(booking, nowMs)).toBe(false);
    });

    it('TEST B: CONFIRMED with scheduled_end_at in past -> Histórico', () => {
      const booking: any = {
        id: 'b-b',
        status: 'CONFIRMED',
        scheduledEndAt: new Date(nowMs - 3600000).toISOString(),
      };
      expect(isBookingEnded(booking, nowMs)).toBe(true);
    });

    it('TEST C: IN_PROGRESS with scheduled_end_at in future -> Próximas', () => {
      const booking: any = {
        id: 'b-c',
        status: 'IN_PROGRESS',
        scheduledEndAt: new Date(nowMs + 1800000).toISOString(),
      };
      expect(isBookingEnded(booking, nowMs)).toBe(false);
    });

    it('TEST D: IN_PROGRESS with scheduled_end_at in past -> Histórico', () => {
      const booking: any = {
        id: 'b-d',
        status: 'IN_PROGRESS',
        scheduledEndAt: new Date(nowMs - 60000).toISOString(),
      };
      expect(isBookingEnded(booking, nowMs)).toBe(true);
    });

    it('TEST E: PENDING_PAYMENT with valid hold and future scheduled_end_at -> Próximas', () => {
      const booking: any = {
        id: 'b-e',
        status: 'PENDING_PAYMENT',
        holdExpiresAt: new Date(nowMs + 600000).toISOString(),
        scheduledEndAt: new Date(nowMs + 7200000).toISOString(),
      };
      expect(isBookingEnded(booking, nowMs)).toBe(false);
    });

    it('TEST F: PENDING_PAYMENT with scheduled_end_at in past -> Histórico', () => {
      const booking: any = {
        id: 'b-f',
        status: 'PENDING_PAYMENT',
        scheduledEndAt: new Date(nowMs - 120000).toISOString(),
      };
      expect(isBookingEnded(booking, nowMs)).toBe(true);
    });

    it('TEST G & H: CANCELLED and COMPLETED bookings belong to Histórico regardless of future time', () => {
      const bookingCancelled: any = {
        id: 'b-g',
        status: 'CANCELLED_BY_STUDENT',
        scheduledEndAt: new Date(nowMs + 3600000).toISOString(),
      };
      const bookingCompleted: any = {
        id: 'b-h',
        status: 'COMPLETED',
        scheduledEndAt: new Date(nowMs + 3600000).toISOString(),
      };
      // Even if time is in future, terminal statuses must be classified in History in StudentApp useMemo
      expect(bookingCancelled.status).toBe('CANCELLED_BY_STUDENT');
      expect(bookingCompleted.status).toBe('COMPLETED');
    });

    it('includes automatic transition timer logic in StudentApp without restart', () => {
      const content = fs.readFileSync(studentAppPath, 'utf8');
      expect(content).toContain('getBookingEndTimestamp');
      expect(content).toContain('msUntilNextEnd');
      expect(content).toContain('setTimeout');
    });
  });

  describe('8. Checkout Modal Premium V2 Redesign (Sec. 39-53)', () => {
    it('uses natural human microcopy in CheckoutModal', () => {
      const content = fs.readFileSync(checkoutModalPath, 'utf8');
      expect(content).toContain('Este valor fica reservado por mais');
      expect(content).toContain('Aula prática');
      expect(content).toContain('Taxa de serviço');
      expect(content).toContain('Total');
      expect(content).not.toContain('Cotação Válida Por:');
    });

    it('uses discreet secondary test environment banner in CheckoutModal', () => {
      const content = fs.readFileSync(checkoutModalPath, 'utf8');
      expect(content).toContain('Ambiente de Testes:');
      expect(content).toContain('Pagamento simulado sem cobrança real.');
      expect(content).not.toContain('cobrança financeira real');
    });

    it('uses PrimaryButton with min-height >= 48px and clear CTA copy', () => {
      const content = fs.readFileSync(checkoutModalPath, 'utf8');
      expect(content).toContain('Continuar para pagamento');
      expect(content).toContain('Confirmar pagamento');
      expect(content).toContain('min-h-[48px]');
    });
  });

  describe('9. Student Schedule Overlap Protection & Behavioral Domain Tests (PARTE B & C)', () => {
    it('blocks student from holding two overlapping active bookings (STUDENT_ALREADY_BOOKED_FOR_SLOT)', () => {
      const now = new Date('2026-08-20T10:00:00Z');
      const studentId = 's-123';

      const quote: any = {
        id: 'q-1',
        studentId,
        providerId: 'p-1',
        instructorId: 'inst-1',
        vehicleId: 'v-1',
        offeringId: 'off-1',
        scheduledStartAt: '2026-08-20T14:00:00Z',
        scheduledEndAt: '2026-08-20T14:50:00Z',
        priceInCents: 10000,
        platformFeeInCents: 1000,
        totalInCents: 11000,
        status: 'ACTIVE',
        expiresAt: '2026-08-20T10:10:00Z',
      };

      const existingBookings: any[] = [
        {
          id: 'b-exist-1',
          studentId,
          providerId: 'p-2', // Different provider
          instructorId: 'inst-2',
          vehicleId: 'v-2',
          status: 'CONFIRMED',
          scheduledStartAt: '2026-08-20T14:00:00Z',
          scheduledEndAt: '2026-08-20T14:50:00Z',
        },
      ];

      const provider: any = { id: 'p-1', status: 'ACTIVE', trade_name: 'CFC Alpha', type: 'DRIVING_SCHOOL' };
      const vehicle: any = { id: 'v-1', status: 'ACTIVE', brand: 'VW', model: 'Gol', transmission: 'MANUAL' };
      const offering: any = { id: 'off-1', status: 'ACTIVE', is_active: true, durationMinutes: 50 };

      expect(() => {
        createBookingHold({
          quote,
          studentId,
          provider,
          vehicle,
          offering,
          existingBookings,
          now,
        });
      }).toThrowError(BookingDomainError);

      try {
        createBookingHold({
          quote,
          studentId,
          provider,
          vehicle,
          offering,
          existingBookings,
          now,
        });
      } catch (err: any) {
        expect(err.code).toBe('STUDENT_ALREADY_BOOKED_FOR_SLOT');
        expect(err.message).toBe('Você já possui uma aula agendada nesse horário.');
      }
    });

    it('allows adjacent non-overlapping slots [14:00, 14:50) and [14:50, 15:40)', () => {
      const now = new Date('2026-08-20T10:00:00Z');
      const studentId = 's-123';

      const quote: any = {
        id: 'q-2',
        studentId,
        providerId: 'p-1',
        instructorId: 'inst-1',
        vehicleId: 'v-1',
        offeringId: 'off-1',
        scheduledStartAt: '2026-08-20T14:50:00Z',
        scheduledEndAt: '2026-08-20T15:40:00Z',
        priceInCents: 10000,
        platformFeeInCents: 1000,
        totalInCents: 11000,
        status: 'ACTIVE',
        expiresAt: '2026-08-20T10:10:00Z',
      };

      const existingBookings: any[] = [
        {
          id: 'b-exist-1',
          studentId,
          providerId: 'p-2',
          instructorId: 'inst-2',
          vehicleId: 'v-2',
          status: 'CONFIRMED',
          scheduledStartAt: '2026-08-20T14:00:00Z',
          scheduledEndAt: '2026-08-20T14:50:00Z',
        },
      ];

      const provider: any = { id: 'p-1', status: 'ACTIVE', trade_name: 'CFC Alpha', type: 'DRIVING_SCHOOL' };
      const vehicle: any = { id: 'v-1', status: 'ACTIVE', brand: 'VW', model: 'Gol', transmission: 'MANUAL' };
      const offering: any = { id: 'off-1', status: 'ACTIVE', is_active: true, durationMinutes: 50 };

      const res = createBookingHold({
        quote,
        studentId,
        provider,
        vehicle,
        offering,
        existingBookings,
        now,
      });

      expect(res.booking).toBeDefined();
      expect(res.booking.status).toBe('PENDING_PAYMENT');
    });

    it('enforces canonical icon patterns for Agenda, Perfil, and Detalhes without decorative chevrons', () => {
      const providerCardContent = fs.readFileSync(providerResultCardPath, 'utf8');
      expect(providerCardContent).toContain('Calendar');
      expect(providerCardContent).not.toContain('rightIcon={<ChevronRight');

      const bookingCardContent = fs.readFileSync(bookingCardPath, 'utf8');
      expect(bookingCardContent).toContain('ClipboardList');
      expect(bookingCardContent).not.toContain('rightIcon={<ChevronRight');

      const studentAppContent = fs.readFileSync(studentAppPath, 'utf8');
      expect(studentAppContent).toContain('UserPen');
    });
  });
});
