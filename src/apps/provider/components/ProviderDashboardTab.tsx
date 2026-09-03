import React from 'react';
import { Clock, AlertTriangle, ArrowRight, Star, Calendar, SlidersHorizontal, Plus, } from 'lucide-react';
import { Provider, Booking, ComplianceDocument, Vehicle } from '../../../types';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { Badge } from '../../../components/ui/Badge';
import { Button, ButtonBase } from '../../../components/ui/Button';
import { ObjectEmptyState } from '../../../components/ui/ObjectEmptyState';
import { AppPageHeader } from '../../../components/ui/AppPageHeader';
import { formatMeetingPoint } from '../../../lib/meeting-point';
import { evaluateProviderEligibility } from '../../../domain/compliance';
import { resolveComplianceDocumentStatus } from '../../../domain/provider-compliance-presentation';
import { ContentSkeleton } from '../../../components/ui/ContentSkeleton';
import { ComplianceStatusAlert } from '../../../components/ui/ComplianceStatusAlert';
import { ProviderEarningsDashboardCard } from './ProviderEarningsTab';

interface ProviderDashboardTabProps {
  currentProvider: Provider;
  todayBookings: Booking[];
  confirmedBookings: Booking[];
  completedBookings: Booking[];
  nextBooking: Booking | null;
  providerDocs: ComplianceDocument[];
  providerVehicles: Vehicle[];
  onSelectBooking: (booking: Booking) => void;
  onNavigateTab: (tabId: 'dashboard' | 'bookings' | 'earnings' | 'management' | 'profile') => void;
  onOpenAddVehicleModal: () => void;
  onOpenAddOfferingModal: () => void;
  calendarLoadError?: string | null;
  isRefreshing?: boolean;
}

export const ProviderDashboardTab: React.FC<ProviderDashboardTabProps> = ({
  currentProvider,
  todayBookings,
  confirmedBookings,
  completedBookings,
  nextBooking,
  providerDocs,
  providerVehicles,
  onSelectBooking,
  onNavigateTab,
  onOpenAddVehicleModal,
  calendarLoadError,
  isRefreshing = false,
}) => {
  const complianceEligibility = evaluateProviderEligibility(currentProvider, providerDocs);
  const complianceStatus = resolveComplianceDocumentStatus(complianceEligibility, providerDocs);

  return (
    <div className="space-y-6 text-left">
      <AppPageHeader
        eyebrow="Hoje"
        title="Sua rotina operacional"
        subtitle={!calendarLoadError ? 'Aulas agendadas hoje' : undefined}
      />

      {isRefreshing && <ContentSkeleton mode="object" label="Atualizando painel" />}

      {!isRefreshing && calendarLoadError && (
        <div className="space-y-4">
          <div className="p-6 rounded-3xl bg-amber-50 border border-amber-200 text-left space-y-2">
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

          {/* NEXT LESSON OPERATIONAL WIDGET */}
          <div className="space-y-4 rounded-3xl bg-[var(--mazzi-dark)] p-5 text-white shadow-[var(--mazzi-shadow)]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#f6c945]" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  Próxima Aula Agendada
                </h2>
              </div>
              <Badge variant="warning">Próxima Aula</Badge>
            </div>

            {nextBooking ? (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 p-4 rounded-2xl border border-slate-800">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-base font-bold text-white">{nextBooking.studentName}</p>
                      <span className="rounded-md border border-[var(--mazzi-yellow)]/40 bg-[var(--mazzi-yellow)]/20 px-2 py-0.5 text-[10px] font-bold text-[var(--mazzi-yellow)]">
                        Cat. {nextBooking.category}
                      </span>
                      {(nextBooking.snapshot?.providerName || nextBooking.providerName) && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-400/30">
                          {nextBooking.snapshot?.providerName || nextBooking.providerName}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#f6c945] font-extrabold">
                      {nextBooking.scheduledDate} • {nextBooking.startTime} - {nextBooking.endTime}
                    </p>
                    <p className="text-xs text-slate-400">
                      Veículo: <span className="text-white font-semibold">{nextBooking.snapshot.vehicleName}</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      Encontro: <span className="text-white font-semibold">{formatMeetingPoint(nextBooking.meetingPoint)}</span>
                    </p>
                  </div>

                  <div className="flex flex-col sm:items-end gap-2 shrink-0">
                    <StatusBadge status={nextBooking.status} />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onSelectBooking(nextBooking)}
                      rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                    >
                      Abrir Detalhes & Check-in
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <ObjectEmptyState
                title="Nenhuma aula confirmada"
                description="Não há aulas agendadas para os próximos horários."
                action={(
                  <Button variant="primary" size="sm" onClick={() => onNavigateTab('bookings')}>
                    Ver minhas aulas
                  </Button>
                )}
              />
            )}
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

      {/* Operational Alerts */}
      <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 space-y-2">
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
