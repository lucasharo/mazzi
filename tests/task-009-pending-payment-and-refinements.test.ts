import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

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
});
