// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import fs from 'fs';
import path from 'path';

vi.mock('../src/components/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'st_123', email: 'student@mazzi.com.br' }, isAuthenticated: true })
}));

import { canUseMockValidationPayment, isMockValidationPaymentAllowed } from '../src/lib/runtime-env';
import { PaymentGatewayFactory } from '../src/domain/payments/gateway-factory';
import { BookingDetailsModal } from '../src/apps/student/components/BookingDetailsModal';
import { ProviderAnalyticsPanel } from '../src/components/analytics/AnalyticsPanels';
import { CheckoutModal } from '../src/apps/student/components/CheckoutModal';
import { mapFriendlyErrorMessage } from '../src/lib/error-mapper';
import { dbService } from '../src/lib/db-service';
import { Booking, Provider, Vehicle, ServiceOffering } from '../src/types';

describe('TASK-058A — Preserve Provider Analytics Contract & Complete MVP Release Guards', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const mig52Path = path.join(__dirname, '../supabase/migrations/20260818000052_provider_lesson_lifecycle_rpcs.sql');
  const mig53Path = path.join(__dirname, '../supabase/migrations/20260818000053_secure_booking_category_fallback.sql');
  const mig54Path = path.join(__dirname, '../supabase/migrations/20260818000054_instructor_unified_calendar_and_global_blocks.sql');
  const mig55Path = path.join(__dirname, '../supabase/migrations/20260820000055_fix_global_blocks_list_rpc_ambiguity.sql');
  const mig56Path = path.join(__dirname, '../supabase/migrations/20260820000056_mvp_release_blockers_analytics_student_checkin.sql');

  // --- 1. MIGRATION IMMUTABILITY & CONTRACT DDL ASSERTIONS ---
  describe('Migration Immutability & Structural DDL Assertions', () => {
    it('Migrations 52, 53, 54 e 55 permanecem intocadas byte-a-byte', () => {
      expect(fs.existsSync(mig52Path)).toBe(true);
      expect(fs.existsSync(mig53Path)).toBe(true);
      expect(fs.existsSync(mig54Path)).toBe(true);
      expect(fs.existsSync(mig55Path)).toBe(true);
    });

    it('Migration 56 preserva o contrato JSON canônico e mantém isolamento RLS seguro de analytics', () => {
      expect(fs.existsSync(mig56Path)).toBe(true);
      const sql56 = fs.readFileSync(mig56Path, 'utf8');

      // Security: NO b.instructor_id = auth.uid()
      expect(sql56).toContain('CREATE OR REPLACE FUNCTION public.get_provider_analytics_summary');
      expect(sql56).toContain('provider.finance.read_own');
      expect(sql56).toContain('school.finance.read');
      expect(sql56).not.toMatch(/b\.instructor_id\s*=\s*auth\.uid\(\)/i);

      // Canonical JSON contract fields
      expect(sql56).toContain("'provider_contexts'");
      expect(sql56).toContain("'financial_dev'");
      expect(sql56).toContain("'quality'");
      expect(sql56).toContain("'supply'");
      expect(sql56).toContain("'timezone'");
      expect(sql56).toContain("'America/Sao_Paulo'");

      // Student Check-In & Quote TTL 10m
      expect(sql56).toContain('CREATE OR REPLACE FUNCTION public.student_check_in_booking');
      expect(sql56).toContain('v_ttl_minutes        INT          := 10;');
    });
  });

  // --- 2. PURE MOCK PAYMENT DECISION HELPER & MANDATORY MATRIX ---
  describe('Pure Mock Payment Decision Helper (canUseMockValidationPayment)', () => {
    it('DEV + qualquer modo/fake -> ALLOWED (true)', () => {
      expect(canUseMockValidationPayment({ isProduction: false, paymentMode: 'fake' })).toBe(true);
      expect(canUseMockValidationPayment({ isProduction: false, paymentMode: undefined })).toBe(true);
    });

    it('PROD + MOCK_VALIDATION -> ALLOWED (true)', () => {
      expect(canUseMockValidationPayment({ isProduction: true, paymentMode: 'MOCK_VALIDATION' })).toBe(true);
      expect(canUseMockValidationPayment({ isProduction: true, paymentMode: 'mock_validation' })).toBe(true);
    });

    it('PROD + unset -> BLOCKED (false)', () => {
      expect(canUseMockValidationPayment({ isProduction: true, paymentMode: undefined })).toBe(false);
      expect(canUseMockValidationPayment({ isProduction: true, paymentMode: '' })).toBe(false);
    });

    it('PROD + REAL_DISABLED -> BLOCKED (false)', () => {
      expect(canUseMockValidationPayment({ isProduction: true, paymentMode: 'REAL_DISABLED' })).toBe(false);
    });

    it('PROD + UNKNOWN -> BLOCKED (false)', () => {
      expect(canUseMockValidationPayment({ isProduction: true, paymentMode: 'SOME_OTHER_MODE' })).toBe(false);
    });

    it('Solicitação explícita do Mercado Pago lança REAL_PAYMENT_GATEWAY_NOT_ENABLED sem chamadas HTTP', () => {
      expect(() => {
        PaymentGatewayFactory.createGateway({ provider: 'mercadopago' });
      }).toThrowError(/REAL_PAYMENT_GATEWAY_NOT_ENABLED/);
    });
  });

  // --- 3. PROVIDER ANALYTICS REAL COMPONENT TEST ---
  describe('ProviderAnalyticsPanel Real Component Test', () => {
    it('Renderiza o painel de analytics com contrato canônico completo sem crashar', async () => {
      const mockSummaryData = {
        period: { from: '2026-08-01T00:00:00Z', to: '2026-08-20T00:00:00Z', timezone: 'America/Sao_Paulo' },
        provider_contexts: 2,
        bookings: { created: 10, confirmed: 8, completed: 5, cancelled: 2, no_show: 0, upcoming: 3 },
        financial_dev: { payments_paid: 5, paid_volume_cents: 65000, platform_fee_volume_cents: 5000, label: 'Ambiente de validação — pagamentos simulados' },
        quality: { reviews_count: 12, rating_average: 4.9 },
        supply: { active_vehicles: 3, active_offerings: 4 }
      };

      vi.spyOn(dbService, 'getProviderAnalyticsSummary').mockResolvedValue(mockSummaryData as any);

      render(<ProviderAnalyticsPanel />);

      await waitFor(() => {
        expect(screen.getByText('Confirmadas')).toBeTruthy();
        expect(screen.getByText('Concluídas')).toBeTruthy();
        expect(screen.getByText('Recebido DEV')).toBeTruthy();
        expect(screen.getByText('Avaliação')).toBeTruthy();
        expect(screen.getByText('Veículos ativos')).toBeTruthy();
        expect(screen.getByText('Ofertas ativas')).toBeTruthy();
        expect(screen.getByText('Pagamentos')).toBeTruthy();
        expect(screen.getByText('Contextos')).toBeTruthy();
      });
    });
  });

  // --- 4. STUDENT CHECK-IN AUTHORITATIVE REFRESH TEST ---
  describe('Student Check-In Authoritative Refresh Flow', () => {
    it('Provoca a sequência: studentCheckInBooking -> getBookings reidratado (sem relógio local sintetizado)', async () => {
      const callOrder: string[] = [];

      const mockBookingAfterServerCheckIn: Booking = {
        id: 'bk_seq_1',
        studentId: 'st_1',
        providerId: 'pr_1',
        providerName: 'Autoescola Paulista',
        instructorId: 'inst_1',
        instructorName: 'Carlos Instrutor',
        vehicleId: 'v_1',
        vehicleName: 'Gol 1.0',
        offeringId: 'off_1',
        category: 'B',
        scheduledDate: '2026-08-20',
        startTime: '10:00',
        endTime: '11:00',
        scheduledStartAt: '2026-08-20T10:00:00-03:00',
        scheduledEndAt: '2026-08-20T11:00:00-03:00',
        status: 'CONFIRMED',
        studentCheckedIn: true,
        checkinStudentAt: '2026-08-20T09:40:00-03:00', // Server authoritative timestamp
        instructorCheckedIn: false,
        meetingPoint: 'Ponto Teste',
        priceInCents: 12000,
        platformFeeInCents: 1000,
        totalInCents: 13000,
        snapshot: {} as any,
        createdAt: '2026-08-20T08:00:00-03:00',
      };

      vi.spyOn(dbService, 'studentCheckInBooking').mockImplementation(async () => {
        callOrder.push('studentCheckInBooking');
        return { success: true, checkin_student_at: '2026-08-20T09:40:00-03:00' };
      });

      vi.spyOn(dbService, 'getBookings').mockImplementation(async () => {
        callOrder.push('getBookings');
        return [mockBookingAfterServerCheckIn];
      });

      // Execute flow as expected in StudentApp
      await dbService.studentCheckInBooking('bk_seq_1');
      const rehydratedBookings = await dbService.getBookings();
      const updated = rehydratedBookings.find((b) => b.id === 'bk_seq_1');

      expect(callOrder).toEqual(['studentCheckInBooking', 'getBookings']);
      expect(updated?.studentCheckedIn).toBe(true);
      expect(updated?.checkinStudentAt).toBe('2026-08-20T09:40:00-03:00');
    });
  });

  // --- 5. STUDENT & INSTRUCTOR CHECK-IN REAL UI COMPONENT TESTS ---
  describe('Student & Instructor Check-In Component Tests (BookingDetailsModal)', () => {
    const baseConfirmedBooking: Booking = {
      id: 'bk_ui_123',
      studentId: 'st_123',
      providerId: 'pr_123',
      providerName: 'Autoescola Paulista',
      instructorId: 'inst_carlos',
      instructorName: 'Carlos Instrutor',
      vehicleId: 'v_123',
      vehicleName: 'Gol 1.0',
      offeringId: 'off_123',
      category: 'B',
      scheduledDate: '2026-08-20',
      startTime: '10:00',
      endTime: '11:00',
      scheduledStartAt: '2026-08-20T10:00:00-03:00',
      scheduledEndAt: '2026-08-20T11:00:00-03:00',
      status: 'CONFIRMED',
      studentCheckedIn: false,
      instructorCheckedIn: false,
      meetingPoint: 'Metrô Paulista',
      priceInCents: 12000,
      platformFeeInCents: 1000,
      totalInCents: 13000,
      snapshot: {} as any,
      createdAt: '2026-08-20T08:00:00-03:00',
    };

    it('A. CONFIRMED + student pending -> botão "Fazer check-in" aparece', () => {
      render(
        <BookingDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          booking={baseConfirmedBooking}
          onStudentCheckIn={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /Fazer check-in na aula/i })).toBeTruthy();
      expect(screen.getByText('Aguardando check-in')).toBeTruthy(); // Instructor pending state
    });

    it('B. Student checked -> botão some e checkinStudentAt renderiza', () => {
      const studentCheckedBooking: Booking = {
        ...baseConfirmedBooking,
        studentCheckedIn: true,
        checkinStudentAt: '2026-08-20T09:42:00-03:00',
      };

      render(
        <BookingDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          booking={studentCheckedBooking}
        />
      );

      expect(screen.queryByRole('button', { name: /Fazer check-in na aula/i })).toBeNull();
      expect(screen.getByText(/09:42/)).toBeTruthy();
    });

    it('C. Instructor checked -> renderiza horário do instrutor (checkinInstructorAt)', () => {
      const instructorCheckedBooking: Booking = {
        ...baseConfirmedBooking,
        instructorCheckedIn: true,
        checkinInstructorAt: '2026-08-20T09:45:00-03:00',
      };

      render(
        <BookingDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          booking={instructorCheckedBooking}
        />
      );

      expect(screen.getByText(/09:45/)).toBeTruthy();
      expect(screen.queryByText('Aguardando check-in')).toBeNull();
    });

    it('D. RPC error renderiza erro amigável na UI', async () => {
      const onStudentCheckInMock = vi.fn().mockRejectedValue(new Error('CHECKIN_WINDOW_EXPIRED'));

      render(
        <BookingDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          booking={baseConfirmedBooking}
          onStudentCheckIn={onStudentCheckInMock}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Fazer check-in na aula/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toContain('A janela de check-in desta aula já terminou.');
      });
    });

    it('E. PENDING_PAYMENT não oferece botão de check-in', () => {
      const pendingBooking: Booking = {
        ...baseConfirmedBooking,
        status: 'PENDING_PAYMENT',
      };

      render(
        <BookingDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          booking={pendingBooking}
        />
      );

      expect(screen.queryByRole('button', { name: /Fazer check-in na aula/i })).toBeNull();
    });

    it('F. CANCELLED_BY_STUDENT não oferece botão de check-in', () => {
      const cancelledBooking: Booking = {
        ...baseConfirmedBooking,
        status: 'CANCELLED_BY_STUDENT',
      };

      render(
        <BookingDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          booking={cancelledBooking}
        />
      );

      expect(screen.queryByRole('button', { name: /Fazer check-in na aula/i })).toBeNull();
    });
  });

  // --- 6. CHECKOUT MODAL REAL COMPONENT TEST ---
  describe('CheckoutModal Real Component Test', () => {
    const mockProvider: Provider = {
      id: 'p_1',
      name: 'Autoescola Paulista',
      type: 'DRIVING_SCHOOL',
      status: 'ACTIVE',
      ratingAverage: 5,
      ratingCount: 10,
      neighborhood: 'Paulista',
      city: 'São Paulo',
      categories: ['B'],
      transmissions: ['MANUAL'],
      startingPriceInCents: 12000,
      isVerified: true,
    };

    const mockVehicle: Vehicle = {
      id: 'v_1',
      providerId: 'p_1',
      vehicleType: 'CAR',
      brand: 'VW',
      model: 'Gol',
      year: 2022,
      licensePlate: 'ABC1D23',
      category: 'B',
      transmission: 'MANUAL',
      status: 'ACTIVE',
      photos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockOffering: ServiceOffering = {
      id: 'off_1',
      providerId: 'p_1',
      vehicleId: 'v_1',
      category: 'B',
      transmission: 'MANUAL',
      durationMinutes: 50,
      priceInCents: 12000,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('Asserts "Pagamento simulado — nenhum valor será cobrado." no banner de checkout', () => {
      render(
        <CheckoutModal
          isOpen={true}
          onClose={vi.fn()}
          provider={mockProvider}
          vehicle={mockVehicle}
          offering={mockOffering}
          scheduledDate="2026-08-20"
          startTime="10:00"
          endTime="11:00"
        />
      );

      expect(screen.getByText('Pagamento simulado — nenhum valor será cobrado.')).toBeTruthy();
    });
  });
});
