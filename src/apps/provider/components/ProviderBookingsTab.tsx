import React from 'react';
import { Clock, Calendar as CalendarRange, History, RefreshCw } from 'lucide-react';
import { Booking } from '../../../types';
import { ButtonBase } from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Tabs';
import { EmptyState, ErrorState } from '../../../components/ui/EmptyState';
import { AppPageHeader } from '../../../components/ui/AppPageHeader';
import { BookingCard } from '../../../components/ui/BookingCard';
import { ContentSkeleton } from '../../../components/ui/ContentSkeleton';

interface ProviderBookingsTabProps {
  bookingFilterTab: 'upcoming' | 'today' | 'history';
  onFilterTabChange: (tab: 'upcoming' | 'today' | 'history') => void;
  bookingQuickFilter: 'all' | 'confirmed' | 'in_progress' | 'completed' | 'disputed' | 'cancelled';
  onQuickFilterChange: (filter: ProviderBookingsTabProps['bookingQuickFilter']) => void;
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
  bookingQuickFilter,
  onQuickFilterChange,
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

      <Tabs
        id="provider-booking-tabs"
        ariaLabel="Filtros de aulas"
        activeTab={bookingFilterTab}
        onChange={(tab) => onFilterTabChange(tab as ProviderBookingsTabProps['bookingFilterTab'])}
        tabs={[
          { id: 'upcoming', label: 'Próximas', icon: <CalendarRange className="h-4 w-4" /> },
          { id: 'today', label: 'Hoje', icon: <Clock className="h-4 w-4" /> },
          { id: 'history', label: 'Histórico', icon: <History className="h-4 w-4" /> },
        ]}
        className="mazzi-segmented"
      />

      <div className="flex flex-wrap justify-center gap-2" aria-label="Filtros rápidos de aulas">
        {(bookingFilterTab === 'history'
          ? [{ value: 'all' as const, label: 'Todas' }, { value: 'completed' as const, label: 'Concluídas' }, { value: 'disputed' as const, label: 'Em contestação' }, { value: 'cancelled' as const, label: 'Canceladas' }]
          : [{ value: 'all' as const, label: 'Todas' }, { value: 'confirmed' as const, label: 'Confirmadas' }, { value: 'in_progress' as const, label: 'Em andamento' }]
        ).map((option) => (
          <ButtonBase key={option.value} type="button" onClick={() => onQuickFilterChange(option.value)} aria-pressed={bookingQuickFilter === option.value} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${bookingQuickFilter === option.value ? 'bg-[var(--mazzi-dark)] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            {option.label}
          </ButtonBase>
        ))}
      </div>

      {/* Bookings List or States */}
      {isRefreshing ? (
        <ContentSkeleton label="Atualizando aulas" />
      ) : calendarLoadError ? (
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
          {filteredBookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              variant="instructor"
              onOpenChat={onOpenChat}
              onViewDetails={onSelectBooking}
              onCheckIn={onCheckIn}
              onStartLesson={onStartLesson}
              onCompleteLesson={onCompleteLesson}
              onCancelBooking={onCancelBooking}
              isCompleting={isCompleting}
              canCancelBooking={canCancelBooking}
            />
          ))}
        </div>
      )}
    </div>
  );
};
