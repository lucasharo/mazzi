import React from 'react';
import {
  Clock,
  CheckCircle2,
  Play,
  CheckCircle,
  XCircle,
  MessageSquare,
  Eye,
  Info,
  Calendar as CalendarIcon,
  ShieldAlert,
} from 'lucide-react';
import { Booking } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { EmptyState } from '../../../components/ui/EmptyState';
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
}) => {
  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div>
        <p className="mazzi-eyebrow mb-1">Gestão de Aulas</p>
        <h2 className="mazzi-title">Sua agenda de aulas</h2>
      </div>

      {/* Action Messages */}
      {actionSuccessMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-extrabold text-emerald-900 flex items-center justify-between">
          <span>{actionSuccessMessage}</span>
        </div>
      )}
      {actionErrorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-extrabold text-rose-900 flex items-center justify-between">
          <span>{actionErrorMessage}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white border border-[#e9e6de] shadow-xs overflow-x-auto">
        <button
          type="button"
          onClick={() => onFilterTabChange('all')}
          className={`flex-1 min-w-[80px] py-2 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            bookingFilterTab === 'all' ? 'bg-[#202126] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CalendarIcon className="w-3.5 h-3.5" />
          <span>Todas</span>
        </button>
        <button
          type="button"
          onClick={() => onFilterTabChange('today')}
          className={`flex-1 min-w-[80px] py-2 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            bookingFilterTab === 'today' ? 'bg-[#202126] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Hoje</span>
        </button>
        <button
          type="button"
          onClick={() => onFilterTabChange('upcoming')}
          className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            bookingFilterTab === 'upcoming' ? 'bg-[#202126] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Próximas</span>
        </button>
        <button
          type="button"
          onClick={() => onFilterTabChange('history')}
          className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            bookingFilterTab === 'history' ? 'bg-[#202126] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Histórico</span>
        </button>
      </div>

      {/* Lessons List */}
      {filteredBookings.length === 0 ? (
        <EmptyState
          icon={<Clock className="w-8 h-8 text-slate-400" />}
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
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                      Reserva #{b.id.slice(0, 8)}
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[#202126] text-white">
                      Cat. {b.category}
                    </span>
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
                    <p className="text-base font-black text-slate-900">{b.studentName}</p>
                    <p className="text-xs font-extrabold text-[#202126] flex items-center gap-1.5 pt-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {b.scheduledDate} • {b.startTime} - {b.endTime}
                    </p>
                  </div>

                  <div className="space-y-1 text-left sm:text-right">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Valor Líquido</p>
                    <p className="text-base font-black text-slate-900">
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

                    {(isConfirmed || isPendingPayment) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCancelBooking(b)}
                        className="text-rose-600 hover:bg-rose-50"
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
