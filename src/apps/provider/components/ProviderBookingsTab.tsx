import React from 'react';
import { Clock, CheckCircle2, Play, CheckCircle, XCircle, MessageSquare, Eye, CalendarClock, CalendarRange, History, RefreshCw, } from 'lucide-react';
import { Booking } from '../../../types';
import { Button, ButtonBase } from '../../../components/ui/Button';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { EmptyState, ErrorState } from '../../../components/ui/EmptyState';
import { AppPageHeader } from '../../../components/ui/AppPageHeader';
import { formatMeetingPoint } from '../../../lib/meeting-point';
import { formatCentsToBRL } from '../../../domain/money';

interface ProviderBookingsTabProps {
  bookingFilterTab: 'all' | 'today' | 'upcoming' | 'history';
  onFilterTabChange: (tab: 'all' | 'today' | 'upcoming' | 'history') => void;
  filteredBookings: Booking[];
  actionSuccessMessage: string | null;
  actionErrorMessage: string | null;
  onSelectBooking: (booking: Booking) => void;
  onOpenChat: (booking: Booking) => void;
  onCheckIn: (booking: Booking) => void;
  onStartLesson: (booking: Booking) => void;
  onCompleteLesson: (booking: Booking) => void;
  onCancelBooking: (booking: Booking) => void;
  isCompleting: boolean;
  canCancelBooking?: (booking: Booking) => boolean;
  calendarLoadError?: string | null;
  isRefreshing?: boolean;
  onRetryCalendarLoad?: () => void;
}

export const ProviderBookingsTab: React.FC<ProviderBookingsTabProps> = ({
  bookingFilterTab,
  onFilterTabChange,
  filteredBookings,
  actionSuccessMessage,
  actionErrorMessage,
  onSelectBooking,
  onOpenChat,
  onCheckIn,
  onStartLesson,
  onCompleteLesson,
  onCancelBooking,
  isCompleting,
  canCancelBooking,
  calendarLoadError,
  isRefreshing,
  onRetryCalendarLoad,
}) => {
  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <AppPageHeader
        eyebrow="Sua jornada"
        title="Minhas aulas"
        subtitle="Acompanhe seus próximos horários e o histórico."
        action={onRetryCalendarLoad ? <ButtonBase type="button" className="mazzi-icon-button" onClick={onRetryCalendarLoad} disabled={isRefreshing} aria-label="Atualizar aulas" title="Atualizar aulas"><RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" /></ButtonBase> : undefined}
      />

      {/* Action Messages */}
      {actionSuccessMessage && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-bold text-emerald-900">
          <span>{actionSuccessMessage}</span>
        </div>
      )}
      {actionErrorMessage && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-bold text-rose-900">
          <span>{actionErrorMessage}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div role="tablist" aria-label="Filtros de aulas" className="mazzi-segmented overflow-x-auto">
        <ButtonBase
          type="button"
          role="tab"
          onClick={() => onFilterTabChange('all')}
          aria-selected={bookingFilterTab === 'all'}
          data-active={bookingFilterTab === 'all'}
          className="flex min-w-[72px] items-center justify-center gap-1.5 whitespace-nowrap !px-1.5"
        >
          <CalendarRange className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Todas</span>
        </ButtonBase>
        <ButtonBase
          type="button"
          role="tab"
          onClick={() => onFilterTabChange('today')}
          aria-selected={bookingFilterTab === 'today'}
          data-active={bookingFilterTab === 'today'}
          className="flex min-w-[64px] items-center justify-center gap-1.5 whitespace-nowrap !px-1.5"
        >
          <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Hoje</span>
        </ButtonBase>
        <ButtonBase
          type="button"
          role="tab"
          onClick={() => onFilterTabChange('upcoming')}
          aria-selected={bookingFilterTab === 'upcoming'}
          data-active={bookingFilterTab === 'upcoming'}
          className="flex min-w-[84px] items-center justify-center gap-1.5 whitespace-nowrap !px-1.5"
        >
          <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Próximas</span>
        </ButtonBase>
        <ButtonBase
          type="button"
          role="tab"
          onClick={() => onFilterTabChange('history')}
          aria-selected={bookingFilterTab === 'history'}
          data-active={bookingFilterTab === 'history'}
          className="flex min-w-[88px] items-center justify-center gap-1.5 whitespace-nowrap !px-1.5"
        >
          <History className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Histórico</span>
        </ButtonBase>
      </div>

      {/* Bookings List or States */}
      {calendarLoadError ? (
        <ErrorState
          title="Não foi possível carregar sua agenda completa."
          message={calendarLoadError}
          onRetry={onRetryCalendarLoad}
        />
      ) : filteredBookings.length === 0 ? (
        <EmptyState
          title="Nenhum agendamento encontrado"
          description="Você não possui aulas no filtro selecionado no momento."
        />
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((b) => {
            const isConfirmed = b.status === 'CONFIRMED';
            const isInProgress = b.status === 'IN_PROGRESS';
            const isPendingPayment = b.status === 'PENDING_PAYMENT';
            const isCompleted = b.status === 'COMPLETED';
            const isCancelled = b.status.includes('CANCELLED');

            return (
              <div
                key={b.id}
                className="p-5 rounded-3xl bg-white border border-[#e9e6de] shadow-xs space-y-4 transition hover:border-slate-300"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Reserva #{b.id.slice(0, 8)}
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[#202126] text-white">
                      Cat. {b.category}
                    </span>
                    {(b.snapshot?.providerName || b.providerName) && (
                      <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-900 border border-blue-200">
                        {b.snapshot?.providerName || b.providerName}
                      </span>
                    )}
                    {isPendingPayment && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                        Aguardando Pagamento do Aluno
                      </span>
                    )}
                  </div>
                  <StatusBadge status={b.status} />
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Aluno(a)</p>
                    <p className="text-base font-bold text-slate-900">{b.studentName}</p>
                    <p className="flex items-center gap-1.5 pt-1 text-xs font-bold text-[var(--mazzi-dark)]">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {b.scheduledDate} • {b.startTime} - {b.endTime}
                    </p>
                  </div>

                  <div className="space-y-1 text-left sm:text-right">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Valor Líquido</p>
                    <p className="text-base font-bold text-slate-900">
                      {formatCentsToBRL(b.priceInCents || b.totalInCents || 0)}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      Veículo: <span className="text-slate-800 font-bold">{b.snapshot?.vehicleName || 'Cadastrado'}</span>
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      Encontro: <span className="text-slate-800 font-bold">{formatMeetingPoint(b.meetingPoint)}</span>
                    </p>
                  </div>
                </div>

                {/* Operations & Action Controls */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onOpenChat(b)}
                      leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
                    >
                      Chat
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSelectBooking(b)}
                      leftIcon={<Eye className="w-3.5 h-3.5" />}
                    >
                      Detalhes
                    </Button>
                  </div>

                  {/* Contextual Action Buttons */}
                  <div className="flex items-center gap-2">
                    {isConfirmed && !b.instructorCheckedIn && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onCheckIn(b)}
                        leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-[#f6c945]" />}
                      >
                        Check-in
                      </Button>
                    )}

                    {isConfirmed && b.instructorCheckedIn && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onStartLesson(b)}
                        leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
                      >
                        Iniciar Aula
                      </Button>
                    )}

                    {isInProgress && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onCompleteLesson(b)}
                        isLoading={isCompleting}
                        leftIcon={<CheckCircle className="w-3.5 h-3.5" />}
                      >
                        Finalizar Aula
                      </Button>
                    )}

                    {(canCancelBooking ? canCancelBooking(b) : (isConfirmed || isPendingPayment) && !b.instructorCheckedIn) && (
                      <Button
                        variant="dangerSoft"
                        size="sm"
                        onClick={() => onCancelBooking(b)}
                        leftIcon={<XCircle className="w-3.5 h-3.5" />}
                      >
                        Cancelar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
