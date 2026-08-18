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
        {/* Status Header */}
        <div className="flex items-center justify-between rounded-2xl border border-[var(--mazzi-border)] bg-[var(--mazzi-surface-soft)] p-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mazzi-muted)]">Detalhes da aula</p>
            <p className="mt-0.5 text-sm font-extrabold text-[var(--mazzi-dark)]">Sua reserva MAZZI</p>
          </div>
          <StatusBadge status={booking.status} audience="student" />
        </div>

        {/* Schedule & Meeting Point */}
        <div className="p-4 rounded-2xl bg-white border border-[var(--mazzi-border)] space-y-2.5 shadow-xs">
          <div className="flex items-center gap-2 text-[var(--mazzi-dark)] font-extrabold text-sm">
            <Calendar className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />
            <span>Data: {start ? formatDateBR(start) : formatDateBR(booking.scheduledDate)}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700 text-xs font-semibold">
            <Clock className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            <span>
              Horário: {start ? formatTimeBR(start) : booking.startTime}
              {end ? ` às ${formatTimeBR(end)}` : ''}
              {duration ? ` · ${duration} min` : ''}
            </span>
          </div>
          {meetingPoint && (
            <div className="flex items-center gap-2 text-slate-700 text-xs font-semibold">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
              <span>Ponto de Encontro: {meetingPoint}</span>
            </div>
          )}
        </div>

        {/* Frozen Historical Snapshot Details */}
        <div className="p-4 rounded-2xl bg-white border border-[var(--mazzi-border)] space-y-3 shadow-xs">
          <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">
            Detalhamento do Profissional & Veículo
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <span className="text-slate-400 text-[11px] block font-medium">Prestador</span>
              <div className="flex items-center gap-1.5 font-bold text-[var(--mazzi-dark)]">
                <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                <span className="truncate">{provider}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 text-[11px] block font-medium">Instrutor</span>
              <div className="flex items-center gap-1.5 font-bold text-[var(--mazzi-dark)]">
                <UserCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                <span className="truncate">{instructor}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 text-[11px] block font-medium">Veículo</span>
              <div className="flex items-center gap-1.5 font-bold text-[var(--mazzi-dark)]">
                <Car className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                <span className="truncate">{vehicle}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 text-[11px] block font-medium">Categoria / Câmbio</span>
              <span className="font-bold text-[var(--mazzi-dark)]">
                Cat. {snapshot.category}{transmission ? ` • ${transmission}` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Pricing Breakdown Snapshot */}
        <div className="p-4 rounded-2xl bg-[var(--mazzi-surface-soft)] border border-[var(--mazzi-border)] space-y-2">
          <h4 className="text-xs font-semibold text-[var(--mazzi-dark)] uppercase tracking-wider flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
            Resumo do Pagamento
          </h4>

          <div className="flex items-center justify-between text-xs text-slate-700">
            <span>Valor da Aula Prática</span>
            <span className="font-bold">{formatCentsToBRL(snapshot.priceInCents)}</span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-700">
            <span>Taxa de Serviço MAZZI</span>
            <span className="font-bold">{formatCentsToBRL(snapshot.platformFeeInCents)}</span>
          </div>

          <div className="pt-2 border-t border-[var(--mazzi-border)] flex items-center justify-between text-sm font-bold text-[var(--mazzi-dark)]">
            <span>Total da Reserva</span>
            <span>{formatCentsToBRL(snapshot.totalInCents)}</span>
          </div>
        </div>

        {/* Hold Expiration Alert if pending */}
        {isPendingPayment && booking.holdExpiresAt && (
          <div role="status" className="p-3.5 rounded-xl bg-amber-50 border border-amber-300/80 flex items-center gap-2 text-xs text-amber-900 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
            <span>
              Aguardando confirmação do pagamento. Horário retido temporariamente.
            </span>
          </div>
        )}

        {isExpired && (
          <div role="alert" className="p-3.5 rounded-xl bg-slate-100 border border-slate-300 flex items-center gap-2 text-xs text-slate-700 font-medium">
            <AlertTriangle className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
            <span>
              O tempo de retenção deste horário expirou. Por favor, faça um novo agendamento.
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-slate-100">
          {isPendingPayment && onContinuePayment && (
            <Button
              type="button"
              variant="primary"
              size="md"
              className="w-full min-h-11 font-bold"
              onClick={() => onContinuePayment(booking)}
              leftIcon={<CreditCard className="w-4 h-4" aria-hidden="true" />}
              aria-label="Concluir pagamento desta reserva pendente"
            >
              Concluir Pagamento
            </Button>
          )}

          {onOpenChat && (
            <Button
              type="button"
              variant="outline"
              size="md"
              className={`${isUpcoming && !isPendingPayment ? 'w-full' : isPendingPayment ? 'w-full sm:w-auto' : 'w-full'} min-h-11 font-medium`}
              onClick={() => onOpenChat(booking)}
              leftIcon={<MessageSquare className="w-4 h-4" aria-hidden="true" />}
              aria-label="Abrir conversa no chat sobre esta reserva"
            >
              Abrir Chat
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
