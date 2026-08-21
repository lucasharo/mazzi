import React from 'react';
import {
  Clock,
  Car,
  MapPin,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Play,
  CheckCircle,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';
import { Booking } from '../../../types';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { formatMeetingPoint } from '../../../lib/meeting-point';
import { formatCentsToBRL } from '../../../domain/money';
import { calculateLessonDurationMinutes, formatTransmissionLabel } from '../../../lib/date-format';

interface ProviderBookingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onOpenChat: (booking: Booking) => void;
  onCheckIn: (booking: Booking) => void;
  onStartLesson: (booking: Booking) => void;
  onCompleteLesson: (booking: Booking) => void;
  onCancelBooking: (booking: Booking) => void;
  isCompleting: boolean;
  canCancelBooking?: (booking: Booking) => boolean;
}

export const ProviderBookingDetailsModal: React.FC<ProviderBookingDetailsModalProps> = ({
  isOpen,
  onClose,
  booking,
  onOpenChat,
  onCheckIn,
  onStartLesson,
  onCompleteLesson,
  onCancelBooking,
  isCompleting,
  canCancelBooking,
}) => {
  if (!booking) return null;

  const isConfirmed = booking.status === 'CONFIRMED';
  const isInProgress = booking.status === 'IN_PROGRESS';
  const isPendingPayment = booking.status === 'PENDING_PAYMENT';
  const isCompleted = booking.status === 'COMPLETED';

  const durationMin = calculateLessonDurationMinutes(booking);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalhes do Agendamento">
      <div className="space-y-5 text-left">
        {/* Header Summary */}
        <div className="flex items-center justify-between gap-2 p-3.5 rounded-2xl bg-slate-100 border border-slate-200">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
              Reserva #{booking.id.slice(0, 8)}
            </span>
            <h4 className="text-base font-black text-slate-900">{booking.studentName}</h4>
          </div>
          <StatusBadge status={booking.status} />
        </div>

        {/* Schedule & Category */}
        <div className="p-4 rounded-2xl bg-white border border-[#e9e6de] space-y-2">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
            Data & Horário
          </span>
          <p className="text-sm font-black text-[#202126] flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            {booking.scheduledDate} • {booking.startTime} - {booking.endTime}
            {durationMin && <span className="text-slate-500 font-normal">({durationMin} min)</span>}
          </p>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-md bg-[#202126] text-white">
              Categoria {booking.category}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Transmissão: {formatTransmissionLabel(booking.snapshot?.transmission)}
            </span>
          </div>
        </div>

        {/* Location & Vehicle Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
            <span className="font-extrabold text-slate-400 uppercase tracking-wider block text-[10px]">
              Veículo do Agendamento
            </span>
            <p className="font-extrabold text-slate-900">
              {booking.snapshot?.vehicleName || booking.vehicleName || 'Veículo Cadastrado'}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
            <span className="font-extrabold text-slate-400 uppercase tracking-wider block text-[10px]">
              Ponto de Encontro
            </span>
            <p className="font-extrabold text-slate-900 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              {formatMeetingPoint(booking.meetingPoint)}
            </p>
          </div>
        </div>

        {/* Financial Breakdown (Split) */}
        <div className="p-4 rounded-2xl bg-[#202126] text-white space-y-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#f6c945] block">
            Resumo Financeiro da Aula
          </span>
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-slate-300">Valor Bruto da Aula:</span>
            <span className="font-bold text-white">{formatCentsToBRL(booking.totalInCents || 0)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Taxa de Plataforma MAZZI:</span>
            <span className="font-medium text-slate-400">- {formatCentsToBRL(booking.platformFeeInCents || 0)}</span>
          </div>
          <div className="flex items-center justify-between text-sm font-black pt-2 border-t border-slate-800">
            <span className="text-[#f6c945]">Repasse Líquido do Instrutor:</span>
            <span className="text-[#f6c945]">
              {formatCentsToBRL((booking.totalInCents || 0) - (booking.platformFeeInCents || 0))}
            </span>
          </div>
        </div>

        {/* Cancellation Reason if cancelled */}
        {booking.cancellationReason && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1">
            <span className="font-extrabold text-rose-950 block">Motivo do Cancelamento:</span>
            <p>{booking.cancellationReason}</p>
          </div>
        )}

        {/* Actions Footer */}
        <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenChat(booking)}
            leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
          >
            Abrir Chat com Aluno
          </Button>

          <div className="flex items-center gap-2">
            {isConfirmed && !booking.instructorCheckedIn && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onCheckIn(booking)}
                leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-[#f6c945]" />}
              >
                Check-in
              </Button>
            )}

            {isConfirmed && booking.instructorCheckedIn && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onStartLesson(booking)}
                leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
              >
                Iniciar Aula
              </Button>
            )}

            {isInProgress && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onCompleteLesson(booking)}
                isLoading={isCompleting}
                leftIcon={<CheckCircle className="w-3.5 h-3.5" />}
              >
                Finalizar Aula
              </Button>
            )}

            {(canCancelBooking ? canCancelBooking(booking) : isConfirmed && !booking.instructorCheckedIn) && (
              <Button
                variant="dangerSoft"
                size="sm"
                onClick={() => onCancelBooking(booking)}
                leftIcon={<XCircle className="w-3.5 h-3.5" />}
              >
                Cancelar
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
