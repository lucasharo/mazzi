import React from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Car,
  UserCheck,
  Building2,
  CreditCard,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react';
import { Booking } from '../../../types';
import { Modal } from '../../../components/ui/Modal';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { Button } from '../../../components/ui/Button';
import { formatCentsToBRL } from '../../../domain/money';
import { formatDateBR, formatTimeBR } from '../../../lib/date-format';
import { formatMeetingPoint } from '../../../lib/meeting-point';

export interface BookingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onCheckIn?: (booking: Booking) => void;
  onOpenChat?: (booking: Booking) => void;
  onContinuePayment?: (booking: Booking) => void;
}

export const BookingDetailsModal: React.FC<BookingDetailsModalProps> = ({
  isOpen,
  onClose,
  booking,
  onCheckIn,
  onOpenChat,
  onContinuePayment,
}) => {
  if (!booking) return null;

  const snapshot = booking.snapshot;
  const isUpcoming = booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS';
  const isPendingPayment = booking.status === 'PENDING_PAYMENT';
  const isExpired = booking.status === 'EXPIRED';
  const meetingPoint = formatMeetingPoint(booking.meetingPoint || snapshot.meetingPoint);
  const start = booking.scheduledStartAt || (booking.scheduledDate && booking.startTime ? `${booking.scheduledDate}T${booking.startTime}:00` : '');
  const end = booking.scheduledEndAt || (booking.scheduledDate && booking.endTime ? `${booking.scheduledDate}T${booking.endTime}:00` : '');
  const transmission = snapshot.transmission === 'AUTOMATIC' ? 'Automático' : snapshot.transmission === 'MANUAL' ? 'Manual' : '';
  const duration = typeof snapshot.durationMinutes === 'number' && snapshot.durationMinutes > 0 ? snapshot.durationMinutes : null;
  const provider = snapshot.providerName || booking.providerName;
  const instructor = snapshot.instructorName || booking.instructorName;
  const vehicle = snapshot.vehicleName || booking.vehicleName;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Detalhes da Reserva"
      size="md"
    >
      <div className="space-y-4 text-left">
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Detalhes da aula</p><p className="mt-1 text-sm font-black text-slate-900">Sua reserva MAZZI</p></div>
          <StatusBadge status={booking.status} audience="student" />
        </div>

        {/* Schedule & Time */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Calendar className="w-4 h-4 text-amber-500" />
            <span>Data: {start ? formatDateBR(start) : formatDateBR(booking.scheduledDate)}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700 text-xs font-semibold">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>Horário: {start ? formatTimeBR(start) : booking.startTime}{end ? ` às ${formatTimeBR(end)}` : ''}{duration ? ` · ${duration} min` : ''}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700 text-xs font-semibold">
            <MapPin className="w-4 h-4 text-slate-400" />
            {meetingPoint && <span>Ponto de Encontro: {meetingPoint}</span>}
          </div>
        </div>

        {/* Frozen Historical Snapshot Info */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Detalhamento do Profissional & Veículo
          </h4>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <span className="text-slate-400 text-[11px] block">Prestador</span>
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span className="truncate">{provider}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 text-[11px] block">Instrutor</span>
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                <span className="truncate">{instructor}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 text-[11px] block">Veículo</span>
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Car className="w-3.5 h-3.5 text-slate-500" />
                <span className="truncate">{vehicle}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 text-[11px] block">Categoria / Câmbio</span>
              <span className="font-extrabold text-slate-800">
                Cat. {snapshot.category}{transmission ? ` • ${transmission}` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Pricing Breakdown Snapshot */}
        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2">
          <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-amber-600" />
            Resumo do Pagamento
          </h4>

          <div className="flex items-center justify-between text-xs text-slate-700">
            <span>Valor da Aula Prática</span>
            <span className="font-semibold">{formatCentsToBRL(snapshot.priceInCents)}</span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-700">
            <span>Taxa de Serviço MAZZI</span>
            <span className="font-semibold">{formatCentsToBRL(snapshot.platformFeeInCents)}</span>
          </div>

          <div className="pt-2 border-t border-amber-300/80 flex items-center justify-between text-sm font-black text-slate-950">
            <span>Total da Reserva</span>
            <span>{formatCentsToBRL(snapshot.totalInCents)}</span>
          </div>
        </div>

        {/* Hold Expiration Alert if pending */}
        {isPendingPayment && booking.holdExpiresAt && (
          <div className="p-3 rounded-xl bg-amber-100 border border-amber-300 flex items-center gap-2 text-xs text-amber-900 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Aguardando confirmação do pagamento. Horário retido temporariamente.
            </span>
          </div>
        )}

        {isExpired && (
          <div className="p-3 rounded-xl bg-slate-100 border border-slate-300 flex items-center gap-2 text-xs text-slate-700 font-medium">
            <AlertTriangle className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              O tempo de retenção deste horário expirou. Por favor, faça um novo agendamento.
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          {isPendingPayment && onContinuePayment && (
            <Button
              variant="primary"
              size="md"
              className="w-full"
              onClick={() => onContinuePayment(booking)}
              leftIcon={<CreditCard className="w-4 h-4" />}
            >
              Concluir Pagamento
            </Button>
          )}


          {onOpenChat && (
            <Button
              variant="outline"
              size="md"
              className={isUpcoming ? 'flex-1' : 'w-full'}
              onClick={() => onOpenChat(booking)}
              leftIcon={<MessageSquare className="w-4 h-4" />}
            >
              Abrir Chat
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
