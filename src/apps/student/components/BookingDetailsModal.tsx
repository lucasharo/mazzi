import React, { useEffect, useState } from 'react';
import { Calendar, Clock, MapPin, Car, UserCheck, Building2, CreditCard, MessageSquare, AlertTriangle, XCircle, AlertCircle, ArrowLeft, CheckCircle2, Circle, Star, } from 'lucide-react';
import { Booking } from '../../../types';
import { Modal } from '../../../components/ui/Modal';
import { ReasonChips } from '../../../components/ui/ReasonChips';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { Button, ButtonBase } from '../../../components/ui/Button';
import { Textarea } from '../../../components/ui/Textarea';
import { formatCentsToBRL } from '../../../domain/money';
import { calculateLessonDurationMinutes, formatDateBR, formatTimeBR } from '../../../lib/date-format';
import { UNPAID_BOOKING_STATUSES } from '../../../domain/booking';
import { formatMeetingPoint } from '../../../lib/meeting-point';
import { dbService } from '../../../lib/db-service';
import { calculateCancellationPolicy } from '../../../domain/cancellation';
import { mapFriendlyErrorMessage } from '../../../lib/error-mapper';
import { getCheckInAvailability } from '../../../domain/checkin';
import { BookingDisputePanel } from '../../../components/booking/BookingDisputePanel';

export interface BookingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onContinuePayment?: (booking: Booking) => void;
  onOpenChat?: (booking: Booking) => void;
  onCancelBooking?: (params: { bookingId: string; reason?: string; reasonCode?: string }) => Promise<any>;
  onBookingUpdated?: (updatedBooking: Booking) => void;
  onStudentCheckIn?: (bookingId: string) => Promise<Booking>;
  onReview?: (booking: Booking) => void;
  currentUserId?: string;
  trackingPreview?: React.ReactNode;
  useHistory?: boolean;
}

const CANCEL_REASON_CHIPS = [
  'Imprevisto pessoal',
  'Mudança de horário',
  'Problema de saúde',
  'Outro motivo',
];

export const BookingDetailsModal: React.FC<BookingDetailsModalProps> = ({
  isOpen,
  onClose,
  booking,
  onOpenChat,
  onContinuePayment,
  onBookingUpdated,
  onStudentCheckIn,
  onReview,
  currentUserId,
  trackingPreview,
  useHistory = true,
}) => {
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const [selectedReasonChip, setSelectedReasonChip] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [checkInNow, setCheckInNow] = useState(() => new Date());

  useEffect(() => {
    if (!isOpen || !booking) return undefined;
    // Evaluate immediately when the modal opens or the selected booking changes.
    // The first interval tick must not be required to cross the check-in window.
    setCheckInNow(new Date());
    // Use a one-second cadence so the button crosses the opening boundary
    // without requiring a reload or waiting for a coarse polling interval.
    const timer = window.setInterval(() => setCheckInNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, [isOpen, booking]);

  if (!booking) return null;

  const handleStudentCheckInAction = async () => {
    if (!onStudentCheckIn || !booking) return;
    setIsCheckingIn(true);
    setCheckInError(null);
    try {
      const updatedBooking = await onStudentCheckIn(booking.id);
      if (updatedBooking && onBookingUpdated) {
        onBookingUpdated(updatedBooking);
      }
    } catch (err: any) {
      setCheckInError(mapFriendlyErrorMessage(err, 'Não foi possível realizar o check-in. Tente novamente.'));
    } finally {
      setIsCheckingIn(false);
    }
  };

  const snapshot = booking.snapshot;
  const isPendingPayment = booking.status === 'PENDING_PAYMENT';
  const isHoldValid = isPendingPayment
    ? booking.holdExpiresAt
      ? new Date(booking.holdExpiresAt).getTime() > Date.now()
      : true
    : false;
  const minutesLeft = isHoldValid && booking.holdExpiresAt
    ? Math.max(1, Math.ceil((new Date(booking.holdExpiresAt).getTime() - Date.now()) / (1000 * 60)))
    : null;

  const isLessonEnded =
    (booking.scheduledEndAt && new Date(booking.scheduledEndAt).getTime() <= Date.now()) ||
    (snapshot.scheduledEndAt && new Date(snapshot.scheduledEndAt).getTime() <= Date.now()) ||
    (booking.scheduledDate && booking.endTime && new Date(`${booking.scheduledDate}T${booking.endTime}:00`).getTime() <= Date.now());

  const isExpired = booking.status === 'EXPIRED' || (isPendingPayment && !isHoldValid);
  const isUpcoming = (booking.status === 'CONFIRMED' || (isPendingPayment && isHoldValid)) && !isExpired && !isLessonEnded;
  const isCancelled = booking.status === 'CANCELLED_BY_STUDENT' || booking.status === 'CANCELLED_BY_PROVIDER';
  const isCompleted = booking.status === 'COMPLETED';
  const isDisputed = booking.status === 'DISPUTED';
  const isPaymentNotCompleted = UNPAID_BOOKING_STATUSES.includes(booking.status);
  const canOpenChat = !isPaymentNotCompleted;
  const shouldShowFooter = !isPaymentNotCompleted || (isPendingPayment && isHoldValid);
  const checkInAvailability = getCheckInAvailability({
    scheduledStartAt: booking.scheduledStartAt,
    status: booking.status,
    alreadyCheckedIn: Boolean(booking.studentCheckedIn),
    now: checkInNow,
  });

  const meetingPoint = formatMeetingPoint(booking.meetingPoint || snapshot.meetingPoint);
  const scheduledStart = booking.scheduledStartAt || (booking.scheduledDate && booking.startTime ? `${booking.scheduledDate}T${booking.startTime}:00` : '');
  const scheduledEnd = booking.scheduledEndAt || (booking.scheduledDate && booking.endTime ? `${booking.scheduledDate}T${booking.endTime}:00` : '');
  const lessonStart = booking.lessonStartedAt || '';
  const lessonEnd = booking.lessonFinishedAt || '';
  const transmission = snapshot.transmission === 'AUTOMATIC' ? 'Automático' : snapshot.transmission === 'MANUAL' ? 'Manual' : '';
  const duration = calculateLessonDurationMinutes(booking);
  const durationLabel = isCompleted && lessonStart && lessonEnd
    ? `Duração realizada: ${duration} min`
    : duration ? `${duration} min` : '';
  const provider = snapshot.providerName || booking.providerName;
  const instructor = snapshot.instructorName || booking.instructorName;
  const vehicle = snapshot.vehicleName || booking.vehicleName;

  // Compute cancellation policy numbers for preview
  const lessonDate = scheduledStart ? new Date(scheduledStart) : new Date(booking.scheduledDate);
  const hoursUntilLesson = (lessonDate.getTime() - Date.now()) / (1000 * 60 * 60);

  const policyCalc = calculateCancellationPolicy({
    cancelledBy: 'STUDENT',
    hoursUntilLesson,
    totalPaidInCents: snapshot.totalInCents || booking.totalInCents || 0,
    lessonPriceInCents: snapshot.priceInCents || booking.priceInCents || 0,
    platformFeeInCents: snapshot.platformFeeInCents || booking.platformFeeInCents || 0,
  });

  const handleConfirmCancel = async () => {
    setIsCancelling(true);
    setCancelError(null);

    const finalReason = [selectedReasonChip, customReason.trim()].filter(Boolean).join(': ') || undefined;

    try {
      const res = isPendingPayment
        ? await dbService.cancelPendingBooking(booking.id)
        : await dbService.cancelBooking({
            bookingId: booking.id,
            reason: finalReason,
          });

      const updated: Booking = {
        ...booking,
        status: (res.status as any) || 'CANCELLED_BY_STUDENT',
        cancelledAt: res.cancelled_at || new Date().toISOString(),
        cancellationReason: res.cancellation_reason || finalReason,
        refundAmountInCents: res.refund_amount_in_cents ?? booking.refundAmountInCents,
      };

      if (onBookingUpdated) {
        onBookingUpdated(updated);
      }

      setIsConfirmingCancel(false);
      onClose();
    } catch (err: any) {
      if (process.env.NODE_ENV !== 'production') console.error('Error cancelling booking:', err);
      setCancelError(err?.message || 'Não foi possível cancelar este agendamento.');
    } finally {
      setIsCancelling(false);
    }
  };

  const cancellationFooter = (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        leftIcon={<ArrowLeft className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />}
        className="min-w-0 flex-1 !whitespace-normal !px-2 text-center leading-tight min-h-[48px] font-bold rounded-2xl border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all cursor-pointer shadow-sm text-xs"
        disabled={isCancelling}
        onClick={() => setIsConfirmingCancel(false)}
      >
        Manter aula
      </Button>
      <Button
        type="button"
        variant="danger"
        size="sm"
        leftIcon={<XCircle className="w-4 h-4 text-white shrink-0" aria-hidden="true" />}
        className="min-w-0 flex-1 !whitespace-normal !px-2 text-center leading-tight"
        isLoading={isCancelling}
        onClick={handleConfirmCancel}
      >
        Cancelar aula
      </Button>
    </>
  );

  const footerContent = !isConfirmingCancel ? (
    <div className="flex w-full flex-col gap-2.5">
      {isPendingPayment && isHoldValid && onContinuePayment && (
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="w-full rounded-2xl font-bold shadow-md transition-all hover:shadow-lg"
          onClick={() => onContinuePayment(booking)}
          leftIcon={<CreditCard className="h-4 w-4" aria-hidden="true" />}
          aria-label="Finalizar pagamento desta reserva pendente"
        >
          Realizar pagamento
        </Button>
      )}

      <div className="flex w-full items-center gap-3">
        {isCompleted && onReview && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            className={`${onOpenChat && canOpenChat ? 'w-1/2' : 'w-full'} order-2 rounded-2xl font-bold shadow-md transition-all hover:shadow-lg`}
            onClick={() => onReview(booking)}
            leftIcon={<Star className="h-4 w-4" aria-hidden="true" />}
            aria-label="Avaliar instrutor"
          >
            Avaliar instrutor
          </Button>
        )}

        {onOpenChat && canOpenChat && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`${isUpcoming || (isCompleted && onReview) || isDisputed ? 'min-w-0 flex-1' : 'w-full'} order-1 rounded-2xl border-slate-200 bg-white font-bold text-slate-800 shadow-sm transition-all hover:bg-slate-50 hover:shadow-md`}
            onClick={() => onOpenChat(booking)}
            leftIcon={<MessageSquare className="h-4 w-4 text-slate-600" aria-hidden="true" />}
            aria-label="Abrir conversa no chat sobre esta reserva"
          >
            Mensagens
          </Button>
        )}

        {(isCompleted || isDisputed) && <BookingDisputePanel booking={booking} currentUserId={currentUserId} display="action" />}

        {isUpcoming && (
          <Button
            type="button"
            variant="dangerSoft"
            size="sm"
            onClick={() => setIsConfirmingCancel(true)}
            className={onOpenChat && canOpenChat ? 'w-1/2' : 'w-full'}
            aria-label="Cancelar esta aula"
            leftIcon={<XCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />}
          >
            Cancelar aula
          </Button>
        )}
      </div>
    </div>
  ) : undefined;

  return (
    <Modal
      useHistory={useHistory}
      isOpen={isOpen}
      onClose={() => {
        setIsConfirmingCancel(false);
        setCancelError(null);
        onClose();
      }}
      title={isConfirmingCancel ? 'Cancelar aula' : 'Detalhes da aula'}
      size="md"
      footer={shouldShowFooter ? (isConfirmingCancel ? cancellationFooter : footerContent) : undefined}
    >
      {isConfirmingCancel ? (
        /* CANCELLATION CONFIRMATION VIEW (DEC-013) */
        <div className="space-y-4 text-left">
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
              <span>Deseja cancelar esta aula?</span>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed font-medium">
              Confira os detalhes e o reembolso aplicável antes de prosseguir. O agendamento permanecerá em seu histórico como cancelado.
            </p>
          </div>

          {/* Lesson summary */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 font-semibold text-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Data e Horário:</span>
              <span className="font-bold text-slate-900">{formatDateBR(scheduledStart)} às {formatTimeBR(scheduledStart)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Instrutor:</span>
              <span className="font-bold text-slate-900">{instructor}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Valor pago:</span>
              <span className="font-bold text-slate-900">{formatCentsToBRL(snapshot.totalInCents || booking.totalInCents)}</span>
            </div>
          </div>

          {/* Financial Policy Result Banner */}
          <div className={`p-4 rounded-2xl border space-y-1 ${
            policyCalc.refundPercentage === 100
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : policyCalc.refundPercentage === 50
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            <div className="flex items-center justify-between gap-2 font-extrabold text-xs">
              <span className="uppercase tracking-wider font-extrabold text-[11px] sm:text-xs">Política de Reembolso (DEC-013)</span>
              <span className={`px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-black shrink-0 whitespace-nowrap ${
                policyCalc.refundPercentage === 100
                  ? 'bg-emerald-200 text-emerald-900'
                  : policyCalc.refundPercentage === 50
                  ? 'bg-amber-200 text-amber-900'
                  : 'bg-rose-200 text-rose-900'
              }`}>
                {policyCalc.refundPercentage}% REEMBOLSO
              </span>
            </div>
            <p className="text-xs font-semibold leading-relaxed pt-1">
              {policyCalc.policyDescription}
            </p>
            {policyCalc.refundPercentage > 0 && (
              <p className="text-xs font-black pt-1">
                Valor estimado do reembolso: {formatCentsToBRL(policyCalc.refundAmountInCents)}
              </p>
            )}
          </div>

          {/* Optional reason selector */}
          <div className="space-y-2 pt-1">
            <label className="mazzi-field-label block">
              Motivo do cancelamento <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <ReasonChips
              options={CANCEL_REASON_CHIPS.map((chip) => ({ value: chip, label: chip }))}
              value={selectedReasonChip}
              onChange={(value) => setSelectedReasonChip(selectedReasonChip === value ? '' : value)}
              ariaLabel="Motivos do cancelamento"
            />
            <Textarea
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Observações adicionais (opcional)..."
              rows={2}
              maxLength={300}
              className="w-full rounded-2xl border border-[var(--mazzi-border)] p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[var(--mazzi-yellow)] focus:outline-none focus:ring-2 focus:ring-[var(--mazzi-focus-glow)] resize-none"
            />
          </div>

          {cancelError && (
            <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{cancelError}</span>
            </div>
          )}

        </div>
      ) : (
        /* STANDARD DETAILS VIEW */
        <div className="space-y-4 text-left">
          {trackingPreview}
          {/* Status Header */}
          <div className="flex items-center justify-between rounded-2xl border border-[var(--mazzi-border)] bg-[var(--mazzi-surface-soft)] p-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mazzi-muted)]">Detalhes da aula</p>
              <p className="mt-0.5 text-sm font-extrabold text-[var(--mazzi-dark)]">Sua aula MAZZI</p>
            </div>
            <StatusBadge status={booking.status} audience="student" />
          </div>

          <BookingDisputePanel booking={booking} currentUserId={currentUserId} />

          {/* Schedule & Meeting Point */}
          <div className="p-4 rounded-2xl bg-white border border-[var(--mazzi-border)] space-y-2.5 shadow-xs">
            <div className="flex items-center gap-2 text-[var(--mazzi-dark)] font-extrabold text-sm">
              <Calendar className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />
              <span>Data: {scheduledStart ? formatDateBR(scheduledStart) : formatDateBR(booking.scheduledDate)}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700 text-xs font-semibold">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
              <span>
                {isCompleted && lessonStart && lessonEnd
                  ? `Início: ${formatTimeBR(lessonStart)} · Fim: ${formatTimeBR(lessonEnd)}`
                  : `Horário: ${scheduledStart ? formatTimeBR(scheduledStart) : booking.startTime}${scheduledEnd ? ` às ${formatTimeBR(scheduledEnd)}` : ''}`}
                {durationLabel ? ` · ${durationLabel}` : ''}
              </span>
            </div>
            {meetingPoint && (
              <div className="flex items-center gap-2 text-slate-700 text-xs font-semibold">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                <span>Ponto de Encontro: {meetingPoint}</span>
              </div>
            )}
          </div>

          {/* Presence & Check-In Card */}
          {(booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS') && (
            <div className="p-4 rounded-2xl bg-white border border-[var(--mazzi-border)] space-y-3 shadow-xs">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">
                Status de Presença na Aula
              </h4>

              {/* Student Check-In Row */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Seu Check-in (Aluno)</span>
                  <span className="text-[11px] text-slate-500 block">
                    {booking.studentCheckedIn ? 'Presença confirmada' : 'Confirme sua presença no ponto de encontro'}
                  </span>
                </div>
                {booking.studentCheckedIn ? (
                  <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Realizado {booking.checkinStudentAt ? `às ${formatTimeBR(booking.checkinStudentAt)}` : ''}
                  </span>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    isLoading={isCheckingIn}
                    disabled={isCheckingIn || !onStudentCheckIn || !checkInAvailability.canCheckIn}
                    onClick={handleStudentCheckInAction}
                    leftIcon={<UserCheck className="w-3.5 h-3.5" aria-hidden="true" />}
                    aria-label="Fazer check-in na aula"
                  >
                    {checkInAvailability.canCheckIn ? 'Fazer check-in' : 'Check-in em breve'}
                  </Button>
                )}
              </div>
              {!booking.studentCheckedIn && !checkInAvailability.canCheckIn && checkInAvailability.opensAt && (
                <p className="text-[11px] font-semibold text-slate-500">Check-in disponível a partir de {formatTimeBR(checkInAvailability.opensAt)}</p>
              )}

              {/* Instructor Check-In Row */}
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Check-in do Instrutor</span>
                  <span className="text-[11px] text-slate-500 block">{booking.instructorCheckedIn ? 'Presença confirmada' : 'Aguardando check-in do profissional'}</span>
                </div>
                {booking.instructorCheckedIn ? (
                  <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Realizado {booking.checkinInstructorAt ? `às ${formatTimeBR(booking.checkinInstructorAt)}` : ''}
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full shrink-0">
                    Aguardando check-in
                  </span>
                )}
              </div>

              {checkInError && (
                <div role="alert" className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{checkInError}</span>
                </div>
              )}
            </div>
          )}

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

            <div className="pt-2 border-t border-[var(--mazzi-border)] flex items-center justify-between text-sm font-bold text-[var(--mazzi-dark)]">
              <span>Total da aula</span>
              <span>{formatCentsToBRL(snapshot.totalInCents)}</span>
            </div>
          </div>

          {/* Special notice for cancelled bookings */}
          {isCancelled && (
            <div role="status" className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 space-y-1 text-xs text-rose-900">
              <div className="flex items-center gap-1.5 font-extrabold">
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
                <span>
                  {booking.status === 'CANCELLED_BY_STUDENT' ? 'Cancelada pelo aluno' : 'Cancelada pelo profissional'}
                </span>
              </div>
              {booking.cancellationReason && (
                <p className="text-[11px] text-rose-700 font-medium pl-5">
                  Motivo: {booking.cancellationReason}
                </p>
              )}
            </div>
          )}

          {/* Special notice for pending payment */}
          {isPendingPayment && isHoldValid && (
            <div role="status" className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-2 text-xs text-amber-900 font-semibold">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                <span>Aguardando confirmação do pagamento. Horário retido temporariamente.</span>
              </div>
              {minutesLeft !== null && (
                <span className="text-[11px] font-extrabold bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded-md shrink-0">
                  {minutesLeft} min
                </span>
              )}
            </div>
          )}

          {isExpired && (
            <div role="status" className="p-3.5 rounded-2xl bg-slate-100 border border-slate-300 flex items-center gap-2 text-xs text-slate-700 font-medium">
              <AlertTriangle className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
              <span>
                Pagamento não realizado. O prazo para confirmar este horário terminou. Por favor, faça um novo agendamento.
              </span>
            </div>
          )}

        </div>
      )}
    </Modal>
  );
};
