// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { InstantLessonActiveBanner } from '../src/components/instant/InstantLessonActiveBanner';
import { InstantLessonOperationalModal } from '../src/components/instant/InstantLessonOperationalModal';
import { ExternalNavigationModal } from '../src/components/instant/ExternalNavigationModal';
import type { Booking } from '../src/types';
import fs from 'node:fs';
import path from 'node:path';

const mockBooking: Booking = {
  id: 'b-instant-100',
  studentId: 's-100',
  studentName: 'Ana Silva',
  providerId: 'p-100',
  providerName: 'Carlos Instrutor',
  instructorId: 'p-100',
  instructorName: 'Carlos Instrutor',
  offeringId: 'o-100',
  vehicleId: 'v-100',
  vehicleName: 'VW Gol',
  scheduledDate: '2026-09-04',
  startTime: '16:00',
  endTime: '16:50',
  scheduledStartAt: '2026-09-04T16:00:00Z',
  scheduledEndAt: '2026-09-04T16:50:00Z',
  status: 'CONFIRMED',
  priceInCents: 15000,
  platformFeeInCents: 1500,
  totalInCents: 15000,
  category: 'B',
  meetingPoint: 'Estação Consolação - Av. Paulista, 2073, São Paulo',
  fullMeetingPoint: 'Estação Consolação - Av. Paulista, 2073, São Paulo',
  createdAt: '2026-09-04T16:00:00Z',
  updatedAt: '2026-09-04T16:00:00Z',
  snapshot: {
    source: 'AULA_AGORA',
    category: 'B',
    providerId: 'p-100',
    providerName: 'Carlos Instrutor',
    providerType: 'INSTRUCTOR',
    instructorId: 'p-100',
    instructorName: 'Carlos Instrutor',
    vehicleId: 'v-100',
    vehicleName: 'VW Gol',
    durationMinutes: 50,
    priceInCents: 15000,
    platformFeeInCents: 1500,
    totalInCents: 15000,
    meetingPoint: {
      latitude: -23.5583,
      longitude: -46.6601,
      address: 'Estação Consolação - Av. Paulista, 2073, São Paulo',
    },
  },
};

describe('Instant Lesson Post-Accept & Active Journey Flow', () => {
  describe('Migration & RPC Contract Integrity', () => {
    it('defines public.set_provider_on_the_way in forward migration', () => {
      const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260904170000_task_089_instant_provider_on_the_way.sql');
      expect(fs.existsSync(migrationPath)).toBe(true);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.set_provider_on_the_way');
      expect(sql).toContain('snapshot_data');
      expect(sql).toContain("NOT IN ('CONFIRMED', 'IN_PROGRESS')");
      expect(sql).toContain('p_booking_id');
    });
  });

  describe('InstantLessonActiveBanner UI Component', () => {
    it('renders waiting payment banner state when operationalState is WAITING_PAYMENT', () => {
      const pendingBooking: Booking = { ...mockBooking, status: 'PENDING_PAYMENT' };
      const { container } = render(<InstantLessonActiveBanner booking={pendingBooking} operationalState="WAITING_PAYMENT" onOpenDetails={vi.fn()} />);
      expect(container.textContent).toContain('Aguardando pagamento do aluno');
      expect(container.textContent).toContain('Ver detalhes');
    });

    it('renders active instant lesson banner when operationalState is CONFIRMED', () => {
      const { container } = render(<InstantLessonActiveBanner booking={mockBooking} operationalState="CONFIRMED" onOpenDetails={vi.fn()} />);
      expect(container.textContent).toContain('Pagamento Confirmado!');
      expect(container.textContent).toContain('Ana Silva');
      expect(container.textContent).toContain('Ir para a aula');
    });

    it('renders on the way status in banner when operationalState is ON_THE_WAY', () => {
      const onTheWayBooking: Booking = { ...mockBooking, status: 'ON_THE_WAY' };
      const { container } = render(<InstantLessonActiveBanner booking={onTheWayBooking} operationalState="ON_THE_WAY" onOpenDetails={vi.fn()} />);
      expect(container.textContent).toContain('Você está a caminho');
    });
  });

  describe('InstantLessonOperationalModal UI Component', () => {
    it('renders student name, category B, address, price and actions for confirmed instant lesson', () => {
      render(
        <InstantLessonOperationalModal
          isOpen={true}
          booking={mockBooking}
          onClose={vi.fn()}
          onOpenNavigation={vi.fn()}
          onSetOnTheWay={vi.fn()}
        />
      );

      const modalContent = document.body.textContent || '';
      expect(modalContent).toContain('Aula Agora Confirmada');
      expect(modalContent).toContain('Ana Silva');
      expect(modalContent).toContain('Cat. B');
      expect(modalContent).toContain('150,00');
      expect(modalContent).toContain('Estação Consolação');
      expect(modalContent).toContain('Abrir navegação');
      expect(modalContent).toContain('Estou a caminho');
    });
  });

  describe('ExternalNavigationModal UI Component', () => {
    it('renders map app options (Google Maps, Waze, Apple Maps, Web) with target coordinates', () => {
      render(
        <ExternalNavigationModal
          isOpen={true}
          target={{ latitude: -23.5583, longitude: -46.6601, label: 'Av Paulista, 2073' }}
          onClose={vi.fn()}
        />
      );

      const modalContent = document.body.textContent || '';
      expect(modalContent).toContain('Escolha o aplicativo de navegação');
      expect(modalContent).toContain('Google Maps');
      expect(modalContent).toContain('Waze');
      expect(modalContent).toContain('Navegador Web');
    });
  });
});
