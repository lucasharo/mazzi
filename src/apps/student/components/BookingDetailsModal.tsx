import React, { useEffect, useState } from 'react';
import { CreditCard, MessageSquare, AlertTriangle, XCircle, AlertCircle, ArrowLeft, Star, } from 'lucide-react';
import { Booking } from '../../../types';
import { Modal } from '../../../components/ui/Modal';
import { ReasonChips } from '../../../components/ui/ReasonChips';
import { Button } from '../../../components/ui/Button';
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
import { ExternalNavigationModal } from '../../../components/instant/ExternalNavigationModal';
import { BookingDetailsHeader, BookingPresenceCard, BookingDetailsOverview, BookingMapPreview, BookingPaymentSummary, BookingCancellationNotice, BookingPaymentStateNotices } from '../../../components/booking/BookingDetailsShared';

export interface BookingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onContinuePayment?: (booking: Booking) => void;
  onOpenChat?: (booking: Booking) => void;
  onCancelBooking?: (params: { bookingId: string; reason?: string; reasonCode?: string }) => Promise<any>;
  onBookingUpdated?: (updatedBooking: Booking) => void;
  onRefreshBooking?: (bookingId: string) => Promise<Booking | null>;
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
  onRefreshBooking,
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
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const [isAddressCopied, setIsAddressCopied] = useState(false);

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

  useEffect(() => {
    if (!isOpen || !booking || !onRefreshBooking) return undefined;

    let refreshInFlight = false;
    const refreshBooking = () => {
      if (refreshInFlight || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
      refreshInFlight = true;
      void onRefreshBooking(booking.id)
        .catch(() => undefined)
        .finally(() => {
          refreshInFlight = false;
        });
    };

    // The realtime subscription is the fast path, but it is not guaranteed to
    // be available on every browser/session. Keep the opened detail modal
    // authoritative with a lightweight fallback refresh so status, check-ins,
    // payment and cancellation data do not stay stuck on the object used to
    // open the modal.
    refreshBooking();
    const timer = window.setInterval(refreshBooking, 10_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshBooking();
    };
    const handleWindowFocus = () => refreshBooking();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [
    isOpen,
    booking?.id,
    onRefreshBooking,
  ]);

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
  // A confirmed lesson that has not actually started may still be cancelled
  // by the student, even if its scheduled time passed without check-in/start.
  const canStudentCancel = booking.status === 'CONFIRMED' && !booking.lessonStartedAt && !isExpired;
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

  const rawMeetingPoint = booking.meetingPoint || snapshot.meetingPoint;
  const isProviderAddress = [booking.meetingPoint, snapshot?.meetingPoint].some((value) => (
    typeof value === 'object' && value !== null && (value as { type?: string }).type === 'PROVIDER_ADDRESS'
  ));
  const meetingPoint = isProviderAddress && booking.fullMeetingPoint
    ? booking.fullMeetingPoint
    : formatMeetingPoint(rawMeetingPoint);
  const latitude = (booking.meetingPoint as any)?.latitude ?? (snapshot?.meetingPoint as any)?.latitude;
  const longitude = (booking.meetingPoint as any)?.longitude ?? (snapshot?.meetingPoint as any)?.longitude;
  const mapPoint = latitude != null && longitude != null
    ? { lat: latitude, lng: longitude, title: meetingPoint || 'Ponto de encontro' }
    : undefined;
  const handleCopyMeetingPoint = async () => {
    if (!meetingPoint || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(meetingPoint);
      setIsAddressCopied(true);
      window.setTimeout(() => setIsAddressCopied(false), 1800);
    } catch {
      setIsAddressCopied(false);
    }
  };
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
        variant="secondary"
        size="sm"
        leftIcon={<ArrowLeft className="w-4 h-4 shrink-0 text-white" aria-hidden="true" />}
        className="min-w-0 flex-1 !whitespace-normal !px-2 text-center leading-tight min-h-[48px] rounded-2xl text-xs"
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
            className={`${isUpcoming || (isCompleted && onReview) || isDisputed ? 'min-w-0 flex-1' : 'w-full'} order-1 rounded-2xl font-bold shadow-sm transition-all hover:shadow-md`}
            onClick={() => onOpenChat(booking)}
            leftIcon={<MessageSquare className="h-4 w-4 text-white" aria-hidden="true" />}
            aria-label="Abrir conversa no chat sobre esta reserva"
          >
            Mensagens
          </Button>
        )}

        {(isCompleted || isDisputed) && <BookingDisputePanel booking={booking} currentUserId={currentUserId} display="action" />}

        {(isUpcoming || canStudentCancel) && (
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
    <>
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
          <div className="mazzi-compact-card p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
              <span>Deseja cancelar esta aula?</span>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed font-medium">
              Confira os detalhes e o reembolso aplicável antes de prosseguir. O agendamento permanecerá em seu histórico como cancelado.
            </p>
          </div>

          {/* Lesson summary */}
          <div className="mazzi-compact-card p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 font-semibold text-slate-700">
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
          <div className={`mazzi-compact-card p-4 rounded-2xl border space-y-1 ${
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
          <BookingDetailsHeader
            status={booking.status}
            audience="student"
            title={instructor || 'Instrutor não informado'}
            subtitle={(
              <span className="block">Aula #{booking.id.slice(0, 8)}</span>
            )}
            instructorCheckedIn={Boolean(booking.instructorCheckedIn)}
          />

          <BookingPresenceCard
            audience="student"
            booking={booking}
            visible={booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS'}
            checkInAvailability={checkInAvailability}
            checkInError={checkInError}
            isCheckingIn={isCheckingIn}
            onCheckIn={handleStudentCheckInAction}
          />

          <BookingDetailsOverview
            providerLabel="Prestador"
            providerName={provider}
            instructorName={instructor}
            vehicleName={vehicle}
            category={snapshot.category}
            transmission={transmission || 'Não informado'}
            dateLabel={scheduledStart ? formatDateBR(scheduledStart) : formatDateBR(booking.scheduledDate)}
            timeLabel={isCompleted && lessonStart && lessonEnd
              ? `Início: ${formatTimeBR(lessonStart)} · Fim: ${formatTimeBR(lessonEnd)}`
              : `Horário: ${scheduledStart ? formatTimeBR(scheduledStart) : booking.startTime}${scheduledEnd ? ` às ${formatTimeBR(scheduledEnd)}` : ''}`}
            durationLabel={durationLabel}
            meetingPoint={meetingPoint}
            isProviderAddress={isProviderAddress}
            showCopyAddress={isProviderAddress}
            addressCopied={isAddressCopied}
            onCopyAddress={handleCopyMeetingPoint}
            hasExactMeetingPoint={Boolean(mapPoint)}
            showNavigation={isProviderAddress}
            onOpenNavigation={() => setIsNavigationOpen(true)}
          />

          {mapPoint && <BookingMapPreview latitude={mapPoint.lat} longitude={mapPoint.lng} title={mapPoint.title} />}

          <BookingPaymentSummary
            items={[{ label: 'Valor da aula prática', amount: formatCentsToBRL(snapshot.priceInCents) }]}
            total={formatCentsToBRL(snapshot.totalInCents)}
          />

          <BookingCancellationNotice booking={booking} />
          <BookingPaymentStateNotices
            isPendingPayment={isPendingPayment}
            isHoldValid={isHoldValid}
            minutesLeft={minutesLeft}
            isExpired={isExpired}
          />

          <BookingDisputePanel booking={booking} currentUserId={currentUserId} />

        </div>
      )}
    </Modal>
    {isProviderAddress && mapPoint && (
      <ExternalNavigationModal
        isOpen={isNavigationOpen}
        onClose={() => setIsNavigationOpen(false)}
        target={{ latitude: mapPoint.lat, longitude: mapPoint.lng, label: meetingPoint }}
      />
    )}
    </>
  );
};
