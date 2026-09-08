import React from 'react';
import { AlertTriangle, ArrowRight, Calendar, Check, ChevronRight, CircleX, Building2, Mail, Plus, Star, } from 'lucide-react';
import { Provider, Booking, ComplianceDocument, Vehicle, InstantLessonSettings, InstantLessonInstructorStatus } from '../../../types';
import type { SchoolInstructorComplianceSummary, SchoolInvitationContext, SchoolMembership } from '../../../lib/db-service';
import type { ProviderPaymentAccount } from '../../../types';
import { Button, ButtonBase } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { evaluateProviderEligibility } from '../../../domain/compliance';
import { resolveComplianceDocumentStatus } from '../../../domain/provider-compliance-presentation';
import { ContentSkeleton } from '../../../components/ui/ContentSkeleton';
import { ComplianceStatusAlert } from '../../../components/ui/ComplianceStatusAlert';
import { ProviderEarningsDashboardCard } from './ProviderEarningsTab';
import { Modal } from '../../../components/ui/Modal';
import { UpcomingBookingCard, UpcomingBookingEmptyCard } from '../../../components/ui/UpcomingBookingCard';
import { ProviderInstantLessonSummaryCard } from './ProviderInstantLessonSummaryCard';
import { getInstantLessonAvailabilityNotice } from '../../../domain/instant-lesson';
import { isProviderPaymentAccountReady } from '../../../domain/payments/provider-payment-readiness';

interface ProviderDashboardTabProps {
  currentProvider: Provider;
  todayBookings: Booking[];
  confirmedBookings: Booking[];
  completedBookings: Booking[];
  nextBooking: Booking | null;
  activeInstantBooking?: Booking | null;
  providerDocs: ComplianceDocument[];
  providerVehicles: Vehicle[];
  offerings: Array<{ id: string; instructorId?: string; vehicleId: string; status: string }>;
  availabilityRules: Array<{ instructorId?: string; isActive: boolean }>;
  paymentAccount?: ProviderPaymentAccount | null;
  schoolInstructors?: SchoolMembership[];
  schoolInstructorSummary?: SchoolInstructorComplianceSummary[];
  onSelectBooking: (booking: Booking) => void;
  onNavigateTab: (tabId: 'dashboard' | 'bookings' | 'earnings' | 'management' | 'profile') => void;
  onOpenAddVehicleModal: () => void;
  onOpenAddOfferingModal: () => void;
  instantSettings?: InstantLessonSettings[];
  instantInstructorStatuses?: InstantLessonInstructorStatus[];
  currentUserId?: string;
  bookings?: Booking[];
  nowMs?: number;
  onOpenInstantSettings?: () => void;
  calendarLoadError?: string | null;
  isRefreshing?: boolean;
  schoolInvitations?: SchoolInvitationContext[];
  onAcceptSchoolInvitation?: (invitationId: string) => Promise<void>;
  onDeclineSchoolInvitation?: (invitationId: string) => Promise<void>;
}

export const ProviderDashboardTab: React.FC<ProviderDashboardTabProps> = ({
  currentProvider,
  todayBookings,
  confirmedBookings,
  completedBookings,
  nextBooking,
  activeInstantBooking = null,
  providerDocs,
  providerVehicles,
  offerings = [],
  availabilityRules = [],
  paymentAccount,
  schoolInstructors = [],
  schoolInstructorSummary = [],
  onSelectBooking,
  onNavigateTab,
  onOpenAddVehicleModal,
  instantSettings = [],
  instantInstructorStatuses = [],
  currentUserId,
  bookings,
  nowMs = Date.now(),
  onOpenInstantSettings = () => onNavigateTab('management'),
  calendarLoadError,
  isRefreshing = false,
  schoolInvitations = [],
  onAcceptSchoolInvitation,
  onDeclineSchoolInvitation,
}) => {
  const [selectedInvitation, setSelectedInvitation] = React.useState<typeof schoolInvitations[number] | null>(null);
  const [invitationAction, setInvitationAction] = React.useState<'ACCEPT' | 'DECLINE' | null>(null);
  const complianceEligibility = evaluateProviderEligibility(currentProvider, providerDocs);
  const complianceStatus = resolveComplianceDocumentStatus(complianceEligibility, providerDocs);
  const instantAvailabilityNotice = getInstantLessonAvailabilityNotice(bookings || confirmedBookings, nowMs);
  const dashboardBooking = activeInstantBooking || nextBooking;
  const cancelledBookings = (bookings || []).filter((booking) => booking.status.startsWith('CANCELLED')).length;
  const marketplacePendingByInstructor = React.useMemo(() => {
    const instructors = currentProvider.type === 'DRIVING_SCHOOL'
      ? schoolInstructors.filter((instructor) => instructor.isActive && instructor.membershipStatus === 'ACTIVE')
      : currentUserId
        ? [{ id: '', userId: currentUserId, name: currentProvider.name, membershipStatus: 'ACTIVE', isActive: true }]
        : [];

    return instructors.map((instructor) => {
      const pending: string[] = [];
      const hasActiveVehicle = providerVehicles.some((vehicle) => vehicle.status === 'ACTIVE');
      const compliance = currentProvider.type === 'DRIVING_SCHOOL'
        ? schoolInstructorSummary.find((entry) => entry.membershipId === instructor.id)?.eligible === true
        : complianceEligibility.isEligible;

      if (!hasActiveVehicle) pending.push('Veículo ativo não cadastrado');
      if (!compliance) pending.push('Compliance aprovado pendente');
      if (!isProviderPaymentAccountReady(paymentAccount)) pending.push('Conta bancária não cadastrada');

      return { instructorName: instructor.name || 'Instrutor', pending };
    }).filter((item) => item.pending.length > 0);
  }, [availabilityRules, complianceEligibility.isEligible, currentProvider.name, currentProvider.type, currentUserId, offerings, paymentAccount, providerVehicles, schoolInstructorSummary, schoolInstructors]);

  return (
    <div className="space-y-[10px] text-left">
      {isRefreshing && <ContentSkeleton mode="object" label="Atualizando painel" />}

      {!isRefreshing && calendarLoadError && (
        <div className="space-y-4">
          <div className="mazzi-compact-card p-6 rounded-2xl bg-amber-50 border border-amber-200 text-left space-y-2">
            <h3 className="text-sm font-bold text-amber-950 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Agenda unificada indisponível
            </h3>
            <p className="text-xs text-amber-900/80">
              Não foi possível conectar ao servidor de agenda unificada. Os indicadores operacionais e o próximo compromisso estão temporariamente ocultos para evitar a exibição de dados incorretos.
            </p>
          </div>
        </div>
      )}

      {/* Compliance status: shared with the PRO profile */}
      {!isRefreshing && (
        <ComplianceStatusAlert
          status={complianceStatus}
          marketplaceReady={marketplacePendingByInstructor.length === 0}
          marketplacePending={marketplacePendingByInstructor.flatMap((item) => item.pending)}
        />
      )}

      {/* Próxima aula fica logo após o credenciamento para priorizar o próximo compromisso. */}
      {!isRefreshing && !calendarLoadError && (
        dashboardBooking ? (
          <UpcomingBookingCard booking={dashboardBooking} perspective="provider" onSelect={onSelectBooking} />
        ) : (
          <UpcomingBookingEmptyCard onViewBookings={() => onNavigateTab('bookings')} />
        )
      )}

      {!isRefreshing && (
        <ProviderInstantLessonSummaryCard providerId={currentProvider.id} settings={instantSettings} instructorStatuses={instantInstructorStatuses} currentUserId={currentUserId} availabilityNotice={instantAvailabilityNotice} onOpenSettings={onOpenInstantSettings} />
      )}

      {!isRefreshing && schoolInvitations.length > 0 && (
        <ButtonBase
          type="button"
          onClick={() => setSelectedInvitation(schoolInvitations[0])}
          className="mazzi-compact-card group flex min-h-24 w-full items-center justify-between gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-left shadow-xs transition hover:border-amber-400 hover:bg-amber-100"
          aria-label="Abrir convite de autoescola"
        >
          <div className="flex min-w-0 items-center gap-3">
            {schoolInvitations[0].schoolAvatarUrl ? (
              <img src={schoolInvitations[0].schoolAvatarUrl} alt="" className="h-12 w-12 shrink-0 rounded-2xl object-cover" />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-200 text-amber-900"><Building2 className="h-5 w-5" aria-hidden="true" /></span>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">Convite pendente</p>
              <p className="mt-1 truncate text-base font-black text-slate-950">{schoolInvitations[0].schoolName}</p>
              <p className="mt-1 text-xs font-semibold text-amber-900">Toque para aceitar ou recusar.</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-amber-700 transition group-hover:translate-x-1" aria-hidden="true" />
        </ButtonBase>
      )}

      {!isRefreshing && !calendarLoadError && (
        <>
          {/* Resumo no mesmo padrão compacto do dashboard do aluno. */}
          <section aria-label="Resumo das aulas" className="grid grid-cols-2 gap-2">
            {[
              { label: 'Aulas Hoje', value: todayBookings.length, icon: <Calendar className="h-5 w-5" aria-hidden="true" /> },
              { label: 'Confirmadas', value: confirmedBookings.length, icon: <Calendar className="h-5 w-5" aria-hidden="true" /> },
              { label: 'Concluídas', value: completedBookings.length, icon: <Check className="h-5 w-5" aria-hidden="true" /> },
              { label: 'Canceladas', value: cancelledBookings, icon: <CircleX className="h-5 w-5" aria-hidden="true" /> },
            ].map((item) => (
              <Card key={item.label} padding="none" className="mazzi-compact-card flex min-h-[68px] items-center justify-between gap-2 rounded-2xl shadow-xs">
                <div className="min-w-0">
                  <p className="mazzi-eyebrow text-[9px] text-[var(--mazzi-muted)]">{item.label}</p>
                  <p className="mt-0.5 text-[24px] font-black leading-none tracking-[-0.04em] text-[var(--mazzi-dark)] tabular-nums">{item.value}</p>
                </div>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-2xl bg-transparent text-[var(--mazzi-dark)]">{item.icon}</span>
              </Card>
            ))}
          </section>

          {/* O PRO mantém a avaliação, fora do resumo operacional. */}
          <section className="flex min-h-[68px] items-center justify-between rounded-2xl border border-[var(--mazzi-dark)] bg-[var(--mazzi-dark)] px-4 py-3 text-white shadow-xs" aria-label="Avaliação do perfil">
            <span className="mazzi-eyebrow text-[9px] text-[var(--mazzi-yellow)]">Avaliação do Perfil:</span>
            <span className="flex items-center gap-1 text-xl font-black"><Star className="h-4 w-4 fill-[var(--mazzi-yellow)] text-[var(--mazzi-yellow)]" />{currentProvider.ratingAverage?.toFixed(1) || '5.0'}</span>
          </section>

          <ProviderEarningsDashboardCard onNavigate={() => onNavigateTab('earnings')} refreshKey={isRefreshing ? 1 : 0} />
        </>
      )}

      {!isRefreshing && calendarLoadError && (
        <div className="p-4 rounded-2xl bg-[#202126] text-white shadow-xs inline-flex items-center gap-3">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#f6c945]">
            Avaliação do Perfil:
          </span>
          <p className="text-lg font-black text-white flex items-center gap-1">
            <Star className="w-4 h-4 fill-[#f6c945] text-[#f6c945]" />
            {currentProvider.ratingAverage?.toFixed(1) || '5.0'}
          </p>
        </div>
      )}

      {/* Quick Action Cards */}
      {!isRefreshing && <div className="grid grid-cols-1 gap-3">
        <ButtonBase
          type="button"
          onClick={() => onNavigateTab('management')}
          aria-label="Abrir gerenciamento de agenda, veículos e ofertas"
          className="mazzi-card group flex min-h-[68px] w-full items-center justify-between gap-3.5 rounded-2xl p-3.5 text-left shadow-xs transition-all duration-200 ease-out hover:shadow-md active:scale-[0.99]"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)]" aria-hidden="true">
              <Calendar className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <span className="mazzi-eyebrow block text-[9px] text-[#8b6800]">Gerenciar agenda, veículos e ofertas</span>
              <span className="mt-1 block truncate text-xs font-medium text-[var(--mazzi-muted)]">Configure horários, veículos, categorias e preços</span>
            </div>
          </div>
          <span className="ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--mazzi-surface-soft)] text-[var(--mazzi-dark)]" aria-hidden="true">
            <ChevronRight className="h-5 w-5 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
          </span>
        </ButtonBase>
      </div>}

      <Modal
        isOpen={Boolean(selectedInvitation)}
        onClose={() => invitationAction === null && setSelectedInvitation(null)}
        title="Convite da autoescola"
        size="sm"
        presentation="page"
        portal
        className="instant-light"
        footerVariant="wizard"
        footer={selectedInvitation ? <div className="flex w-full items-center gap-3">
          <Button variant="dangerSoft" size="sm" className="min-w-0 flex-1" disabled={invitationAction !== null} isLoading={invitationAction === 'DECLINE'} onClick={async () => {
            if (!selectedInvitation || !onDeclineSchoolInvitation) return;
            setInvitationAction('DECLINE');
            try { await onDeclineSchoolInvitation(selectedInvitation.id); setSelectedInvitation(null); } finally { setInvitationAction(null); }
          }} leftIcon={<CircleX className="h-4 w-4" />}>Recusar</Button>
          <Button variant="primary" size="sm" className="min-w-0 flex-[3]" disabled={invitationAction !== null} isLoading={invitationAction === 'ACCEPT'} onClick={async () => {
            if (!selectedInvitation || !onAcceptSchoolInvitation) return;
            setInvitationAction('ACCEPT');
            try { await onAcceptSchoolInvitation(selectedInvitation.id); setSelectedInvitation(null); } finally { setInvitationAction(null); }
          }} leftIcon={<Check className="h-4 w-4" />}>Aceitar</Button>
        </div> : undefined}
      >
        <div className="space-y-4 text-center">
          <div className="mazzi-compact-card flex flex-col items-center rounded-2xl bg-amber-50 p-5">
            {selectedInvitation?.schoolAvatarUrl ? <img src={selectedInvitation.schoolAvatarUrl} alt="" className="h-20 w-20 rounded-2xl object-cover shadow-xs" /> : <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-200 text-amber-900 shadow-xs"><Building2 className="h-8 w-8" aria-hidden="true" /></span>}
            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">Autoescola</p><p className="mt-1 text-lg font-black text-slate-950">{selectedInvitation?.schoolName || 'Autoescola'}</p>
          </div>
          <p className="text-center text-sm leading-relaxed text-slate-700">
            Você foi convidado para atuar como instrutor em <strong>{selectedInvitation?.schoolName || 'esta autoescola'}</strong>.
          </p>
          <p className="text-center text-xs font-semibold text-slate-500">Aceite para iniciar o processo de vínculo e compliance.</p>
        </div>
      </Modal>

    </div>
  );
};
