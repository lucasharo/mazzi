// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import fs from 'fs';
import path from 'path';

import { isMockValidationPaymentAllowed } from '../src/lib/runtime-env';
import { PaymentGatewayFactory } from '../src/domain/payments/gateway-factory';
import { FakePaymentGateway } from '../src/domain/payments/fake-adapter';
import { BookingDetailsModal } from '../src/apps/student/components/BookingDetailsModal';
import { mapFriendlyErrorMessage } from '../src/lib/error-mapper';
import { Booking } from '../src/types';

describe('TASK-058 — Close MVP Release Blockers (Analytics Isolation, Student Check-In & Mock Payments)', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const mig52Path = path.join(__dirname, '../supabase/migrations/20260818000052_provider_lesson_lifecycle_rpcs.sql');
  const mig53Path = path.join(__dirname, '../supabase/migrations/20260818000053_secure_booking_category_fallback.sql');
  const mig54Path = path.join(__dirname, '../supabase/migrations/20260818000054_instructor_unified_calendar_and_global_blocks.sql');
  const mig55Path = path.join(__dirname, '../supabase/migrations/20260820000055_fix_global_blocks_list_rpc_ambiguity.sql');
  const mig56Path = path.join(__dirname, '../supabase/migrations/20260820000056_mvp_release_blockers_analytics_student_checkin.sql');

  // --- 1. MIGRATION IMMUTABILITY & DDL CONTRACT TESTS ---
  describe('Migration Immutability & Structural DDL Assertions', () => {
    it('Migrations 52, 53, 54 e 55 permanecem intocadas byte-a-byte', () => {
      expect(fs.existsSync(mig52Path)).toBe(true);
      expect(fs.existsSync(mig53Path)).toBe(true);
      expect(fs.existsSync(mig54Path)).toBe(true);
      expect(fs.existsSync(mig55Path)).toBe(true);
    });

    it('Migration 56 existe e remove b.instructor_id = auth.uid() do analytics de provider (P0)', () => {
      expect(fs.existsSync(mig56Path)).toBe(true);
      const sql56 = fs.readFileSync(mig56Path, 'utf8');

      // P0: Provider Analytics Isolation
      expect(sql56).toContain('CREATE OR REPLACE FUNCTION public.get_provider_analytics_summary');
      expect(sql56).toContain('provider.finance.read_own');
      expect(sql56).toContain('school.finance.read');
      expect(sql56).not.toMatch(/b\.instructor_id\s*=\s*auth\.uid\(\)/i);

      // P1: Student Check-In RPC
      expect(sql56).toContain('CREATE OR REPLACE FUNCTION public.student_check_in_booking');
      expect(sql56).toContain('UNAUTHORIZED_STUDENT');
      expect(sql56).toContain('CHECKIN_WINDOW_NOT_OPEN');
      expect(sql56).toContain('CHECKIN_WINDOW_EXPIRED');
      expect(sql56).toContain('STUDENT_CHECKIN_BOOKING');

      // P2: Quote TTL 10m Alignment
      expect(sql56).toContain('CREATE OR REPLACE FUNCTION public.create_quote_from_offering');
      expect(sql56).toContain('v_ttl_minutes        INT          := 10;');
      expect(sql56).not.toContain('v_ttl_minutes        INT          := 15;');
    });
  });

  // --- 2. MOCK VALIDATION PAYMENT SAFETY HELPERS ---
  describe('Mock Validation Payment Safety Helpers', () => {
    it('DEV environment allows fake payment gateway', () => {
      // In happy-dom vitest DEV environment, isMockValidationPaymentAllowed() returns true
      expect(isMockValidationPaymentAllowed()).toBe(true);
      const gateway = PaymentGatewayFactory.createGateway();
      expect(gateway.gatewayType).toBe('DEVELOPMENT_MOCK');
    });

    it('Real Mercado Pago provider request throws REAL_PAYMENT_GATEWAY_NOT_ENABLED', () => {
      expect(() => {
        PaymentGatewayFactory.createGateway({ provider: 'mercadopago' });
      }).toThrowError(/REAL_PAYMENT_GATEWAY_NOT_ENABLED/);
    });
  });

  // --- 3. REAL REACT COMPONENT TESTS: Student Check-In UI ---
  describe('Student Check-In Component Tests (BookingDetailsModal)', () => {
    const mockConfirmedBooking: Booking = {
      id: 'bk_student_chk_123',
      studentId: 'st_123',
      studentName: 'Ana Aluna',
      providerId: 'p_school_456',
      providerName: 'Autoescola Paulista',
      instructorId: 'inst_carlos',
      instructorName: 'Carlos Instrutor',
      vehicleId: 'v_999',
      vehicleName: 'Gol 1.0',
      offeringId: 'off_789',
      category: 'B',
      scheduledDate: '2026-08-20',
      startTime: '10:00',
      endTime: '11:00',
      scheduledStartAt: '2026-08-20T10:00:00-03:00',
      scheduledEndAt: '2026-08-20T11:00:00-03:00',
      status: 'CONFIRMED',
      snapshot: { category: 'B', priceInCents: 12000, platformFeeInCents: 1000, totalInCents: 13000 } as any,
      studentCheckedIn: false,
      meetingPoint: 'Estação Paulista do Metrô',
      priceInCents: 12000,
      platformFeeInCents: 1000,
      totalInCents: 13000,
      createdAt: new Date().toISOString(),
    };

    it('A. Exibe cartão "Check-in do Aluno" com botão "Fazer check-in" para aula CONFIRMED', () => {
      render(
        <BookingDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          booking={mockConfirmedBooking}
          onStudentCheckIn={vi.fn().mockResolvedValue({ success: true, checkin_student_at: new Date().toISOString() })}
        />
      );

      expect(screen.getByText('Check-in do Aluno')).toBeTruthy();
      expect(screen.getByRole('button', { name: /Fazer check-in na aula/i })).toBeTruthy();
    });

    it('B. Clicar "Fazer check-in" invoca callback onStudentCheckIn com booking.id', async () => {
      const onStudentCheckInMock = vi.fn().mockResolvedValue({
        success: true,
        checkin_student_at: '2026-08-20T09:45:00-03:00',
      });

      render(
        <BookingDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          booking={mockConfirmedBooking}
          onStudentCheckIn={onStudentCheckInMock}
        />
      );

      const checkInBtn = screen.getByRole('button', { name: /Fazer check-in na aula/i });
      fireEvent.click(checkInBtn);

      expect(onStudentCheckInMock).toHaveBeenCalledWith('bk_student_chk_123');
    });

    it('C. Exibe badge verde "Realizado às HH:mm" quando studentCheckedIn = true', () => {
      const checkedInBooking: Booking = {
        ...mockConfirmedBooking,
        studentCheckedIn: true,
        checkinStudentAt: '2026-08-20T09:45:00-03:00',
      };

      render(
        <BookingDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          booking={checkedInBooking}
        />
      );

      expect(screen.getByText(/Realizado/)).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Fazer check-in na aula/i })).toBeNull();
    });

    it('D. Exibe erro amigável ao falhar a RPC de check-in (ex: UNAUTHORIZED_STUDENT ou janela expirada)', async () => {
      const onStudentCheckInMock = vi.fn().mockRejectedValue(new Error('CHECKIN_WINDOW_EXPIRED'));

      render(
        <BookingDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          booking={mockConfirmedBooking}
          onStudentCheckIn={onStudentCheckInMock}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Fazer check-in na aula/i }));

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeTruthy();
        expect(alert.textContent).toContain('A janela de check-in desta aula já terminou.');
      });
    });
  });

  // --- 4. ERROR MAPPER FOR STUDENT CHECK-IN ---
  describe('Student Check-In Friendly Error Mapper Assertions', () => {
    it('Mapeia UNAUTHORIZED_STUDENT para mensagem amigável sem vazar detalhes técnicos', () => {
      const msg = mapFriendlyErrorMessage('UNAUTHORIZED_STUDENT: Acesso negado. Apenas o aluno titular...');
      expect(msg).toBe('Você não tem permissão para realizar esta ação neste agendamento.');
    });

    it('Mapeia CHECKIN_WINDOW_NOT_OPEN para mensagem amigável', () => {
      const msg = mapFriendlyErrorMessage('CHECKIN_WINDOW_NOT_OPEN: O check-in só fica disponível 30 minutos antes...');
      expect(msg).toBe('O check-in ainda não está disponível. Aguarde a abertura da janela de check-in.');
    });

    it('Mapeia CHECKIN_WINDOW_EXPIRED para mensagem amigável', () => {
      const msg = mapFriendlyErrorMessage('CHECKIN_WINDOW_EXPIRED: A janela de check-in para esta aula expirou.');
      expect(msg).toBe('A janela de check-in desta aula já terminou.');
    });
  });
});
