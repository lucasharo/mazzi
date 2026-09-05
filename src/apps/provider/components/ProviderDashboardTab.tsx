import React from 'react';
import { AlertTriangle, ArrowRight, Star, Calendar, SlidersHorizontal, Plus, Mail, Check, CircleX, Building2, } from 'lucide-react';
import { Provider, Booking, ComplianceDocument, Vehicle, InstantLessonSettings, InstantLessonInstructorStatus } from '../../../types';
import type { SchoolInvitationContext } from '../../../lib/db-service';
import { Button, ButtonBase } from '../../../components/ui/Button';
import { evaluateProviderEligibility } from '../../../domain/compliance';
import { resolveComplianceDocumentStatus } from '../../../domain/provider-compliance-presentation';
import { ContentSkeleton } from '../../../components/ui/ContentSkeleton';
import { ComplianceStatusAlert } from '../../../components/ui/ComplianceStatusAlert';
import { ProviderEarningsDashboardCard } from './ProviderEarningsTab';
import { Modal } from '../../../components/ui/Modal';
import { UpcomingBookingCard, UpcomingBookingEmptyCard } from '../../../components/ui/UpcomingBookingCard';
import { ProviderInstantLessonSummaryCard } from './ProviderInstantLessonSummaryCard';
import { getInstantLessonAvailabilityNotice } from '../../../domain/instant-lesson';

interface ProviderDashboardTabProps {
  currentProvider: Provider;
  todayBookings: Booking[];
  confirmedBookings: Booking[];
  completedBookings: Booking[];
  nextBooking: Booking | null;
  activeInstantBooking?: Booking | null;
  providerDocs: ComplianceDocument[];
  providerVehicles: Vehicle[];
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
      {!isRefreshing && <ComplianceStatusAlert status={complianceStatus} />}

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
          {/* Operational Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="mazzi-card p-4">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--mazzi-muted)]">
                Aulas Hoje
              </span>
              <p className="mt-1 text-2xl font-bold text-[var(--mazzi-dark)]">{todayBookings.length}</p>
            </div>

            <div className="mazzi-card p-4">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--mazzi-muted)]">
                Confirmadas
              </span>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{confirmedBookings.length}</p>
            </div>

            <div className="mazzi-card p-4">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--mazzi-muted)]">
                Concluídas
              </span>
              <p className="mt-1 text-2xl font-bold text-[var(--mazzi-dark)]">{completedBookings.length}</p>
            </div>

            <div className="rounded-[22px] border border-[var(--mazzi-dark)] bg-[var(--mazzi-dark)] p-4 text-white shadow-[var(--mazzi-shadow)]">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--mazzi-yellow)]">
                Avaliação
              </span>
              <p className="mt-1 flex items-center gap-1 text-xl font-bold text-white">
                <Star className="w-4 h-4 fill-[#f6c945] text-[#f6c945]" />
                {currentProvider.ratingAverage?.toFixed(1) || '5.0'}
              </p>
            </div>
          </div>

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
      {!isRefreshing && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ButtonBase
          type="button"
          onClick={() => onNavigateTab('management')}
          className="mazzi-card group flex min-h-20 cursor-pointer items-center justify-between p-4 text-left transition hover:border-slate-300"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-[#202126] font-bold flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 transition group-hover:text-amber-700">
                Gerenciar Agenda & Horários
              </h3>
              <p className="text-xs text-slate-500">Configure regras semanais e bloqueios</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition" />
        </ButtonBase>

        <ButtonBase
          type="button"
          onClick={() => onNavigateTab('management')}
          className="mazzi-card group flex min-h-20 cursor-pointer items-center justify-between p-4 text-left transition hover:border-slate-300"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-[#202126] font-bold flex items-center justify-center">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 transition group-hover:text-slate-700">
                Gestão de Veículos & Ofertas
              </h3>
              <p className="text-xs text-slate-500">Cadastre modelos, categorias e preços</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition" />
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

      {/* Operational Alerts */}
      <div className="mazzi-compact-card p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 space-y-2">
        <div className="flex items-center gap-2 font-bold">
          <AlertTriangle className="w-4 h-4 text-amber-700" />
          <span>Alertas da Operação MAZZI Pro:</span>
        </div>
        <ul className="list-disc pl-5 space-y-1 text-amber-800 font-medium">
          {providerDocs.some((d) => d.status === 'PENDING' || d.status === 'IN_REVIEW') && (
            <li>Você possui documentos aguardando análise de compliance.</li>
          )}
          {providerDocs.some((d) => d.status === 'EXPIRED') && (
            <li>Você possui documentos vencidos. Envie uma nova versão para atualizar o credenciamento.</li>
          )}
          {providerVehicles.length === 0 && (
            <li>
              Nenhum veículo cadastrado.{' '}
              <ButtonBase
                type="button"
                onClick={onOpenAddVehicleModal}
                className="underline font-bold hover:text-amber-950 inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Cadastrar Veículo
              </ButtonBase>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};
