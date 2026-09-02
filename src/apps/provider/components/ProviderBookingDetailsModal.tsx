import React from 'react';
import {
  Building2,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  CreditCard,
  AlertCircle,
  MapPin,
  MessageSquare,
  Play,
  UserCheck,
  UserRound,
  XCircle,
} from 'lucide-react';
import { Booking } from '../../../types';
import { Modal } from '../../../components/ui/Modal';
import { Button, SecondaryButton } from '../../../components/ui/Button';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { formatMeetingPoint } from '../../../lib/meeting-point';
import { formatCentsToBRL } from '../../../domain/money';
import { calculateLessonDurationMinutes, formatTransmissionLabel } from '../../../lib/date-format';
import { mapFriendlyErrorMessage } from '../../../lib/error-mapper';
import { getCheckInAvailability } from '../../../domain/checkin';
import { UNPAID_BOOKING_STATUSES } from '../../../domain/booking';
import { formatTimeBR } from '../../../lib/date-format';
import { BookingDisputePanel } from '../../../components/booking/BookingDisputePanel';

interface ProviderBookingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onOpenChat: (booking: Booking) => void;
  onCheckIn: (booking: Booking) => void | Promise<string | void>;
  onStartLesson: (booking: Booking) => void;
  onCompleteLesson: (booking: Booking) => void;
  onCancelBooking: (booking: Booking) => void;
  isCompleting: boolean;
  canCancelBooking?: (booking: Booking) => boolean;
  currentUserId?: string;
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
  currentUserId,
}) => {
  const [isCheckingIn, setIsCheckingIn] = React.useState(false);
  const [checkInError, setCheckInError] = React.useState<string | null>(null);
  const [checkInNow, setCheckInNow] = React.useState(() => new Date());

  React.useEffect(() => {
    if (!isOpen || !booking) return undefined;
    setCheckInNow(new Date());
    const timer = window.setInterval(() => setCheckInNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, [isOpen, booking?.id]);

  if (!booking) return null;

  const snapshot = booking.snapshot || {
    providerName: booking.providerName,
    instructorName: booking.instructorName,
    vehicleName: booking.vehicleName,
    meetingPoint: booking.meetingPoint,
    category: booking.category,
    transmission: undefined,
  } as Booking['snapshot'];
  const isConfirmed = booking.status === 'CONFIRMED';
  const isInProgress = booking.status === 'IN_PROGRESS';
  const isCancelled = booking.status === 'CANCELLED_BY_STUDENT' || booking.status === 'CANCELLED_BY_PROVIDER';
  const duration = calculateLessonDurationMinutes(booking);
  const studentName = booking.studentName?.trim() || 'Aluno não identificado';
  const providerName = snapshot.providerName || booking.providerName;
  const instructorName = snapshot.instructorName || booking.instructorName;
  const vehicleName = snapshot.vehicleName || booking.vehicleName || 'Veículo Cadastrado';
  const meetingPoint = formatMeetingPoint(booking.meetingPoint || snapshot.meetingPoint);
  const lessonPriceInCents = snapshot.priceInCents ?? booking.priceInCents ?? booking.totalInCents ?? 0;
  const platformFeeInCents = snapshot.platformFeeInCents ?? booking.platformFeeInCents ?? 0;
  const bookingTotalInCents = snapshot.totalInCents ?? booking.totalInCents ?? lessonPriceInCents;
  const netAmountInCents = Math.max(0, bookingTotalInCents - platformFeeInCents);
  const canCancel = canCancelBooking
    ? canCancelBooking(booking)
    : isConfirmed && !booking.instructorCheckedIn;
  const checkInAvailability = getCheckInAvailability({
    scheduledStartAt: booking.scheduledStartAt,
    scheduledDate: booking.scheduledDate,
    startTime: booking.startTime,
    status: booking.status,
    alreadyCheckedIn: Boolean(booking.instructorCheckedIn),
    now: checkInNow,
  });

  const handleCheckIn = async () => {
    setIsCheckingIn(true);
    setCheckInError(null);
    try {
      const result = await onCheckIn(booking);
      if (typeof result === 'string') setCheckInError(result);
    } catch (error) {
      setCheckInError(mapFriendlyErrorMessage(error, 'Não foi possível realizar o check-in. Tente novamente.'));
    } finally {
      setIsCheckingIn(false);
    }
  };

  const footer = (
    <div className="flex w-full flex-col gap-2.5">
      {isConfirmed && booking.instructorCheckedIn && booking.studentCheckedIn && (
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="w-full rounded-2xl font-bold shadow-md transition-all hover:shadow-lg"
          onClick={() => onStartLesson(booking)}
          leftIcon={<Play className="h-4 w-4 fill-current" aria-hidden="true" />}
        >
          Iniciar aula
        </Button>
      )}
      {isInProgress && (
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="w-full rounded-2xl font-bold shadow-md transition-all hover:shadow-lg"
          onClick={() => onCompleteLesson(booking)}
          isLoading={isCompleting}
          leftIcon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
        >
          Finalizar aula
        </Button>
      )}
      <div className="flex w-full items-center gap-3">
        <SecondaryButton
          type="button"
          size="sm"
          className={`${canCancel || booking.status === 'DISPUTED' ? 'min-w-0 flex-1' : 'w-full'} rounded-2xl border-slate-300 bg-white font-bold text-slate-700 shadow-sm transition-all hover:shadow-md`}
          onClick={() => onOpenChat(booking)}
          leftIcon={<MessageSquare className="h-4 w-4 text-slate-500" aria-hidden="true" />}
          aria-label="Abrir conversa no chat sobre esta reserva"
        >
          Mensagens
        </SecondaryButton>
        {(booking.status === 'COMPLETED' || booking.status === 'DISPUTED') && <BookingDisputePanel booking={booking} currentUserId={currentUserId} display="action" />}
        {canCancel && (
          <Button
            type="button"
            variant="dangerSoft"
            size="sm"
            className="w-1/2"
            onClick={() => onCancelBooking(booking)}
            aria-label="Cancelar aula"
            leftIcon={<XCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />}
          >
            Cancelar aula
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalhes do Agendamento" size="md" footer={UNPAID_BOOKING_STATUSES.includes(booking.status) ? undefined : footer}>
      <div className="space-y-4 text-left">
        {/* Same status hierarchy used by the Student reservation details. */}
        <div className="flex items-center justify-between rounded-2xl border border-[var(--mazzi-border)] bg-[var(--mazzi-surface-soft)] p-4">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mazzi-muted)]">Aluno</p>
            <p className="mt-0.5 truncate text-sm font-extrabold text-[var(--mazzi-dark)]">{studentName}</p>
            <p className="mt-1 text-[11px] font-medium text-slate-500">Reserva #{booking.id.slice(0, 8)}</p>
          </div>
          <StatusBadge status={booking.status} />
        </div>

        {/* Schedule & meeting point */}
        <div className="space-y-2.5 rounded-2xl border border-[var(--mazzi-border)] bg-white p-4 shadow-xs">
          <div className="flex items-center gap-2 text-sm font-extrabold text-[var(--mazzi-dark)]">
            <Calendar className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
            <span>Data: {booking.scheduledDate}</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Clock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span>Horário: {booking.startTime} às {booking.endTime}{duration ? ` · ${duration} min` : ''}</span>
          </div>
          {meetingPoint && (
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <span>Ponto de encontro: {meetingPoint}</span>
            </div>
          )}
        </div>

        {/* Presence & check-in */}
        {(booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS') && (
          <div className="space-y-3 rounded-2xl border border-[var(--mazzi-border)] bg-white p-4 shadow-xs">
            <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-500"><UserCheck className="h-3.5 w-3.5" aria-hidden="true" />Status de presença na aula</h4>
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div>
                <span className="block text-xs font-bold text-slate-800">Check-in do aluno</span>
                  <span className="block text-[11px] text-slate-500">{booking.studentCheckedIn ? 'Presença confirmada no ponto de encontro' : 'Aguardando check-in do aluno'}</span>
              </div>
              {booking.studentCheckedIn ? (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  Realizado
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Aguardando</span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="block text-xs font-bold text-slate-800">Seu check-in</span>
                  <span className="block text-[11px] text-slate-500">{booking.instructorCheckedIn ? 'Aguardando check-in do aluno' : 'Aguardando seu check-in'}</span>
              </div>
              {booking.instructorCheckedIn ? (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  Realizado
                </span>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  isLoading={isCheckingIn}
                    disabled={isCheckingIn || !checkInAvailability.canCheckIn}
                  onClick={handleCheckIn}
                  leftIcon={<UserCheck className="h-3.5 w-3.5" aria-hidden="true" />}
                  aria-label="Fazer check-in na aula"
                >
                  {checkInAvailability.canCheckIn ? 'Fazer check-in' : 'Check-in em breve'}
                </Button>
              )}
            </div>
            {!booking.instructorCheckedIn && !checkInAvailability.canCheckIn && checkInAvailability.opensAt && (
              <p className="text-[11px] font-semibold text-slate-500">Aguardando abertura do check-in · disponível a partir de {formatTimeBR(checkInAvailability.opensAt)}</p>
            )}
            {checkInError && (
              <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-bold text-rose-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
                <span>{checkInError}</span>
              </div>
            )}
          </div>
        )}

        {/* Frozen booking snapshot */}
        <div className="space-y-3 rounded-2xl border border-[var(--mazzi-border)] bg-white p-4 shadow-xs">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Detalhes da aula</h4>
          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <div className="space-y-1">
              <span className="block text-[11px] font-medium text-slate-400">Autoescola</span>
              <div className="flex items-center gap-1.5 font-bold text-[var(--mazzi-dark)]"><Building2 className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" /><span className="truncate">{providerName}</span></div>
            </div>
            <div className="space-y-1">
              <span className="block text-[11px] font-medium text-slate-400">Instrutor</span>
              <div className="flex items-center gap-1.5 font-bold text-[var(--mazzi-dark)]"><UserRound className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" /><span className="truncate">{instructorName}</span></div>
            </div>
            <div className="space-y-1">
              <span className="block text-[11px] font-medium text-slate-400">Veículo</span>
              <div className="flex items-center gap-1.5 font-bold text-[var(--mazzi-dark)]"><Car className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" /><span className="truncate">{vehicleName}</span></div>
            </div>
            <div className="space-y-1">
              <span className="block text-[11px] font-medium text-slate-400">Categoria / Câmbio</span>
              <span className="font-bold text-[var(--mazzi-dark)]">Cat. {snapshot.category} · {formatTransmissionLabel(snapshot.transmission)}</span>
            </div>
          </div>
        </div>

        {/* Same payment summary used by the Student reservation details. */}
        <div className="space-y-2 rounded-2xl border border-[var(--mazzi-border)] bg-[var(--mazzi-surface-soft)] p-4">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--mazzi-dark)]">
            <CreditCard className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
            Resumo do Pagamento
          </h4>
          <div className="flex items-center justify-between text-xs text-slate-700">
            <span>Valor líquido</span>
            <span className="font-bold">{formatCentsToBRL(netAmountInCents)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-700">
            <span>Taxa de Serviço MAZZI</span>
            <span className="font-bold">{formatCentsToBRL(platformFeeInCents)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--mazzi-border)] pt-2 text-sm font-bold text-[var(--mazzi-dark)]">
            <span>Total da Reserva</span>
            <span>{formatCentsToBRL(bookingTotalInCents)}</span>
          </div>
        </div>

        {isCancelled && booking.cancellationReason && (
          <div role="status" className="space-y-1 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900">
            <div className="flex items-center gap-1.5 font-extrabold"><XCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" /><span>Motivo do cancelamento</span></div>
            <p className="pl-5 text-[11px] font-medium text-rose-700">{booking.cancellationReason}</p>
          </div>
        )}

        <BookingDisputePanel booking={booking} currentUserId={currentUserId} />

      </div>
    </Modal>
  );
};
