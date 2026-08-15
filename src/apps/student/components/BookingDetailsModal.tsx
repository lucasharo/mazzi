import React from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Car,
  UserCheck,
  Building2,
  CheckCircle2,
  ShieldCheck,
  CreditCard,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react';
import { Booking } from '../../../types';
import { Modal } from '../../../components/ui/Modal';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { Button } from '../../../components/ui/Button';
import { formatCentsToBRL } from '../../../domain/money';

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Detalhes da Reserva"
      size="md"
    >
      <div className="space-y-4 text-left">
        {/* Top Header & Status */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Código da Reserva
            </span>
            <span className="font-mono text-xs font-bold text-slate-800">
              {booking.id}
            </span>
          </div>
          <StatusBadge status={booking.status} />
        </div>

        {/* Schedule & Time */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Calendar className="w-4 h-4 text-amber-500" />
            <span>Data: {booking.scheduledDate}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700 text-xs font-semibold">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>Horário: {booking.startTime} às {booking.endTime} ({snapshot.durationMinutes || 50} min)</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700 text-xs font-semibold">
            <MapPin className="w-4 h-4 text-slate-400" />
            <span>Ponto de Encontro: {
              typeof (booking.meetingPoint || snapshot.meetingPoint) === 'string'
                ? (booking.meetingPoint || snapshot.meetingPoint)
                : (booking.meetingPoint as any)?.label || snapshot.meetingPoint || ''
            }</span>
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
                <span className="truncate">{String(snapshot.providerName || '')}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 text-[11px] block">Instrutor</span>
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                <span className="truncate">{String(snapshot.instructorName || '')}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 text-[11px] block">Veículo</span>
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Car className="w-3.5 h-3.5 text-slate-500" />
                <span className="truncate">{String(snapshot.vehicleName || '')}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 text-[11px] block">Categoria / Câmbio</span>
              <span className="font-extrabold text-slate-800">
                Cat. {snapshot.category} • {snapshot.transmission || 'MANUAL'}
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

          {isUpcoming && onCheckIn && (
            <Button
              variant={booking.studentCheckedIn ? 'secondary' : 'primary'}
              size="md"
              className="flex-1"
              onClick={() => onCheckIn(booking)}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              {booking.studentCheckedIn ? 'Check-in Realizado' : 'Fazer Check-in'}
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
