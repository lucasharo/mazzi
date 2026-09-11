import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const studentApp = fs.readFileSync(path.join(process.cwd(), 'src/apps/student/StudentApp.tsx'), 'utf8');
const checkoutModal = fs.readFileSync(path.join(process.cwd(), 'src/apps/student/components/CheckoutModal.tsx'), 'utf8');
const confirmableAddressAutocomplete = fs.readFileSync(path.join(process.cwd(), 'src/components/search/ConfirmableAddressAutocomplete.tsx'), 'utf8');
const instantLessonModal = fs.readFileSync(path.join(process.cwd(), 'src/apps/student/components/InstantLessonModal.tsx'), 'utf8');
const mainStart = studentApp.indexOf('<main className="mazzi-mobile text-left">');
const homeStart = studentApp.indexOf("{activeTab === 'home' && (");
const searchStart = studentApp.indexOf("{activeTab === 'bookings' && bookingFlowStep === 'search' && (");
const homeSource = studentApp.slice(homeStart, searchStart);

describe('Student Home dashboard', () => {
  it('uses the central student home instead of rendering search results inline', () => {
    expect(homeStart).toBeGreaterThanOrEqual(0);
    expect(searchStart).toBeGreaterThan(homeStart);
    expect(homeSource).toContain('Olá,');
    expect(homeSource).toContain('UpcomingBookingCard');
    expect(homeSource).toContain('Aula Agora');
    expect(homeSource).toContain('Agendar Aula');
    expect(homeSource).not.toContain('<SearchHeader');
    expect(homeSource).not.toContain('Nenhum profissional encontrado');
    expect(homeSource).not.toContain('Filtros');
    expect(studentApp.slice(mainStart, homeStart)).not.toContain('UpcomingBookingCard');
  });

  it('keeps the dashboard metrics backed by booking-derived state', () => {
    expect(studentApp).toContain('studentDashboardStats');
    expect(studentApp).toContain("today: todayBookings.filter((booking) => !CANCELLED_BOOKING_STATUSES.includes(booking.status)).length");
    expect(studentApp).toContain("completed: historyBookings.filter((booking) => booking.status === 'COMPLETED').length");
    expect(studentApp).toContain("booking.status === 'CANCELLED_BY_STUDENT' || booking.status === 'CANCELLED_BY_PROVIDER'");
    expect(homeSource).toContain('StudentStatsGrid stats={studentDashboardStats}');
    expect(homeSource).toContain('StudentDashboardSkeleton');
    expect(studentApp).toContain('mazzi-compact-card flex min-h-[68px]');
  });

  it('uses the three-item Início navigation and keeps the traditional search flow reachable', () => {
    expect(studentApp).toContain("{ id: 'home', label: 'Início', icon: <LayoutDashboard");
    expect(studentApp).toContain("{ id: 'bookings', label: 'Aulas'");
    expect(studentApp).toContain("{ id: 'profile', label: 'Perfil'");
    expect(homeSource).toContain('onClick={() => openBookingSearch()}');
    expect(studentApp).not.toContain('data-component="agenda-wizard-entry"');
    expect(studentApp).not.toContain('Buscar profissionais para agendar uma aula');
    expect(studentApp).not.toContain('onClick={openBookingSearch}');
    expect(studentApp).toContain("setBookingFlowStep('search')");
    expect(studentApp).toContain("const bookingWizardStepsWithSearch = ['Profissional', ...bookingWizardSteps]");
    expect(studentApp).toContain('current="Profissional"');
    expect(studentApp).toContain('title="Buscar profissionais"');
    expect(studentApp).toContain('const backToBookingSearch = () =>');
  });

  it('keeps Sua Jornada disabled as a future feature', () => {
    expect(homeSource).toContain('Sua jornada: em breve');
    expect(homeSource).toContain('aria-disabled="true"');
    expect(homeSource).toContain('Mais aulas, mais conquistas!');
  });

  it('uses the empty calendar icon for the agenda card', () => {
    expect(studentApp).not.toContain('CalendarDays');
    expect(homeSource).toContain('bg-[var(--mazzi-yellow)]');
    expect(homeSource).toContain('<CalendarIcon');
  });

  it('returns every wizard exit X to the student home', () => {
    expect(studentApp).toContain('const closeStudentWizard = () => {');
    expect(studentApp).toContain("setActiveTab('home');");
    expect(studentApp).toContain('onClose={closeStudentWizard}');
    expect(studentApp).toContain('onExit={closeStudentWizard}');
    expect(checkoutModal).toContain('onExit?: () => void;');
    expect(checkoutModal).toContain('onClose={isInstantLesson ? onClose : onExit || onClose}');
    expect(checkoutModal).toContain('onReturnToInstantWizard?: () => void;');
    expect(checkoutModal).toContain('Cancelar aula');
    expect(instantLessonModal).toContain('onClose={onClose}');
  });

  it('keeps address selection inside the parent wizard', () => {
    expect(confirmableAddressAutocomplete).not.toContain('useHistory={false}');
    expect(confirmableAddressAutocomplete).toContain('layer="nested"');
    expect(confirmableAddressAutocomplete).toContain('onConfirm(suggestion, nextValue);');
  });
});
