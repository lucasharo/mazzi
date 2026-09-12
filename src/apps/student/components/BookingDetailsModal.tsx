import React, { useEffect, useRef, useState } from 'react';
import { CreditCard, MessageSquare, AlertTriangle, XCircle, ArrowLeft, Navigation, Star, } from 'lucide-react';
import { Booking, InstantCancellationQuote, InstantLessonRequest, InstantLessonTracking } from '../../../types';
import { Modal } from '../../../components/ui/Modal';
import { ReasonChips } from '../../../components/ui/ReasonChips';
import { Button } from '../../../components/ui/Button';
import { Textarea } from '../../../components/ui/Textarea';
import { formatCentsToBRL } from '../../../domain/money';
import { calculateLessonDurationMinutes, formatDateBR, formatTimeBR } from '../../../lib/date-format';
import { CANCELLED_BOOKING_STATUSES, getEffectiveBookingHoldExpiresAt, UNPAID_BOOKING_STATUSES } from '../../../domain/booking';
import { formatMeetingPoint, formatPendingPaymentMeetingPoint } from '../../../lib/meeting-point';
import { dbService } from '../../../lib/db-service';
import { requestCheckInLocation } from '../../../lib/checkin-location';
import type { CheckInLocation } from '../../../lib/checkin-location';
import { calculateCancellationPolicy } from '../../../domain/cancellation';
import { mapFriendlyErrorMessage } from '../../../lib/error-mapper';
import { getCheckInAvailability } from '../../../domain/checkin';
import { BookingDisputePanel } from '../../../components/booking/BookingDisputePanel';
import { ExternalNavigationModal } from '../../../components/instant/ExternalNavigationModal';
import { InstantLessonTrackingCard } from '../../../components/instant/InstantLessonTrackingCard';
import { CountdownTimer } from '../../../components/ui/CountdownTimer';
import type { ToastMessage } from '../../../components/ui/Toast';
import { BookingDetailsHeader, BookingPresenceCard, BookingDetailsOverview, BookingMapPreview, BookingPaymentSummary, BookingCancellationNotice, BookingPaymentStateNotices, getBookingRefundAmountInCents } from '../../../components/booking/BookingDetailsShared';
import { INSTANT_STUDENT_TRACKING_INTERVAL_SECONDS } from '../../../domain/instant-lesson';

const BOOKING_DETAIL_REFRESH_INTERVAL_MS = 3_000;

export interface BookingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onContinuePayment?: (booking: Booking) => void;
  onOpenChat?: (booking: Booking) => void;
  onCancelBooking?: (params: { bookingId: string; reason?: string; reasonCode?: string }) => Promise<any>;
  onBookingUpdated?: (updatedBooking: Booking) => void;
  onRefreshBooking?: (bookingId: string) => Promise<Booking | null>;
  onStudentCheckIn?: (bookingId: string, location: CheckInLocation) => Promise<Booking>;
  onReview?: (booking: Booking) => void;
  currentUserId?: string;
  checkInWindowBeforeMinutes?: number | null;
  instantLessonExpirationMinutes?: number;
  trackingPreview?: React.ReactNode;
  useHistory?: boolean;
  onToast?: (toast: Omit<ToastMessage, 'id'>) => void;
}

const CANCEL_REASON_CHIPS = [
  'Imprevisto pessoal',
  'Mudança de horário',
  'Problema de saúde',
  'Outro motivo',
];

function buildTrackingRequest(booking: Booking): InstantLessonRequest | null {
  const snapshot = booking.snapshot as Booking['snapshot'] & {
    providerOnTheWayAt?: string;
  };

  const rawMeetingPoint = snapshot.meetingPoint || (snapshot as any).meeting_point;
  const meetingPointObject = rawMeetingPoint && typeof rawMeetingPoint === 'object'
    ? rawMeetingPoint as { latitude?: unknown; longitude?: unknown }
    : undefined;
  const latitude = Number(meetingPointObject?.latitude ?? (booking.snapshot as any).latitude);
  const longitude = Number(meetingPointObject?.longitude ?? (booking.snapshot as any).longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    id: booking.id,
    studentId: booking.studentId,
    meetingPoint: {
      formattedAddress: booking.fullMeetingPoint || booking.meetingPoint || formatMeetingPoint(rawMeetingPoint) || 'Ponto de encontro',
      latitude,
      longitude,
    },
    category: booking.category,
    transmission: snapshot.transmission || 'ALL',
    maxPriceInCents: snapshot.priceInCents ?? booking.priceInCents ?? null,
    status: 'MATCHED',
    expiresAt: booking.scheduledEndAt || booking.scheduledStartAt || booking.createdAt,
    matchedProviderId: booking.providerId,
    matchedOfferingId: booking.offeringId,
    bookingId: booking.id,
    createdAt: booking.createdAt,
  };
}

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
  checkInWindowBeforeMinutes,
  instantLessonExpirationMinutes,
  trackingPreview,
  useHistory = true,
  onToast,
}) => {
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const [selectedReasonChip, setSelectedReasonChip] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [checkInNow, setCheckInNow] = useState(() => new Date());
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const [isAddressCopied, setIsAddressCopied] = useState(false);
  const [instantCancellationQuote, setInstantCancellationQuote] = useState<InstantCancellationQuote | null>(null);
  const [isLoadingInstantQuote, setIsLoadingInstantQuote] = useState(false);
  const [instantQuoteError, setInstantQuoteError] = useState<string | null>(null);
  const [instantTracking, setInstantTracking] = useState<InstantLessonTracking | null>(null);
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  const instantCancellationKeyRef = useRef<string | null>(null);
  const checkInRequestInFlightRef = useRef(false);

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
    const timer = window.setInterval(refreshBooking, BOOKING_DETAIL_REFRESH_INTERVAL_MS);
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

  const isInstantBooking = booking?.snapshot?.source === 'AULA_AGORA';
  // Keep the live booking column authoritative, but accept the legacy
  // snapshot while an older persisted client object is being rehydrated.
  // Otherwise the backend state is correct but the student never sees the
  // tracking action until the app is fully reloaded.
  const providerOnTheWayAt = booking?.providerOnTheWayAt
    || (booking?.snapshot as Booking['snapshot'] & { provider_on_the_way_at?: string; providerOnTheWayAt?: string })?.provider_on_the_way_at
    || (booking?.snapshot as Booking['snapshot'] & { provider_on_the_way_at?: string; providerOnTheWayAt?: string })?.providerOnTheWayAt;
  const isLessonStarted = booking?.status === 'IN_PROGRESS' || Boolean(booking?.lessonStartedAt);
  const trackingBookingId = booking && ['CONFIRMED', 'IN_PROGRESS'].includes(booking.status)
    && !isLessonStarted
    && providerOnTheWayAt
    ? booking.id
    : null;

  useEffect(() => {
    if (!isOpen || !trackingBookingId) {
      setInstantTracking(null);
      return undefined;
    }

    let disposed = false;
    let refreshInFlight = false;
    const refreshTracking = () => {
      if (refreshInFlight || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
      refreshInFlight = true;
      void dbService.getInstantTracking(trackingBookingId)
        .then((tracking) => {
          if (!disposed) setInstantTracking(tracking);
        })
        .catch(() => {
          if (!disposed) setInstantTracking(null);
        })
        .finally(() => {
          refreshInFlight = false;
        });
    };

    refreshTracking();
    const timer = window.setInterval(refreshTracking, INSTANT_STUDENT_TRACKING_INTERVAL_SECONDS * 1_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshTracking();
    };
    const handleWindowFocus = () => refreshTracking();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [isOpen, trackingBookingId]);

  useEffect(() => {
    setIsTrackingOpen(false);
  }, [isOpen, booking?.id]);

  useEffect(() => {
    const isInstantBooking = booking?.snapshot?.source === 'AULA_AGORA';
    if (!isOpen || !isConfirmingCancel || !booking || !isInstantBooking || booking.status === 'PENDING_PAYMENT') {
      return undefined;
    }

    let isCurrent = true;
    setInstantCancellationQuote(null);
    setInstantQuoteError(null);
    setIsLoadingInstantQuote(true);
    void dbService.getInstantCancellationQuote(booking.id)
      .then((quote) => {
        if (isCurrent) setInstantCancellationQuote(quote);
      })
      .catch((error: any) => {
        if (isCurrent) setInstantQuoteError(mapFriendlyErrorMessage(error, 'Não foi possível calcular o reembolso agora.'));
      })
      .finally(() => {
        if (isCurrent) setIsLoadingInstantQuote(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [isOpen, isConfirmingCancel, booking?.id, booking?.status, booking?.snapshot?.source]);

  if (!booking) return null;

  const handleStudentCheckInAction = async () => {
    if (!onStudentCheckIn || !booking || checkInRequestInFlightRef.current) return;
    checkInRequestInFlightRef.current = true;
    setIsCheckingIn(true);
    setCheckInError(null);
    try {
      const location = await requestCheckInLocation();
      const updatedBooking = await onStudentCheckIn(booking.id, location);
      if (updatedBooking && onBookingUpdated) {
        onBookingUpdated(updatedBooking);
      }
    } catch (err: any) {
      setCheckInError(mapFriendlyErrorMessage(err, 'Não foi possível realizar o check-in. Tente novamente.'));
    } finally {
      checkInRequestInFlightRef.current = false;
      setIsCheckingIn(false);
    }
  };

  const snapshot = booking.snapshot;
  const isPendingPayment = booking.status === 'PENDING_PAYMENT';
  const effectiveHoldExpiresAt = getEffectiveBookingHoldExpiresAt(booking, instantLessonExpirationMinutes);
  const isHoldValid = isPendingPayment
    ? effectiveHoldExpiresAt
      ? new Date(effectiveHoldExpiresAt).getTime() > Date.now()
      : true
    : false;
  const secondsLeft = isHoldValid && effectiveHoldExpiresAt
    ? Math.max(0, Math.ceil((new Date(effectiveHoldExpiresAt).getTime() - Date.now()) / 1000))
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
  const isProviderOnTheWay = Boolean(providerOnTheWayAt);
  const trackingRequest = trackingBookingId && !isLessonStarted && isProviderOnTheWay
    ? buildTrackingRequest(booking)
    : null;
  const isCompleted = booking.status === 'COMPLETED';
  const isStaleConfirmed = booking.status === 'CONFIRMED' && Boolean(isLessonEnded);
  const isCancelled = CANCELLED_BOOKING_STATUSES.includes(booking.status);
  const isDisputed = booking.status === 'DISPUTED';
  const isPaymentNotCompleted = UNPAID_BOOKING_STATUSES.includes(booking.status);
  const canOpenChat = !isPaymentNotCompleted;
  const shouldShowFooter = !isPaymentNotCompleted || (isPendingPayment && isHoldValid);
  const checkInAvailability = checkInWindowBeforeMinutes === null
    ? { canCheckIn: false, opensAt: null, reason: 'CONFIGURATION_UNAVAILABLE' as const }
    : getCheckInAvailability({
      scheduledStartAt: booking.scheduledStartAt,
      status: booking.status,
      alreadyCheckedIn: Boolean(booking.studentCheckedIn),
      checkInWindowBeforeMinutes,
      now: checkInNow,
    });

  const scheduledStart = booking.scheduledStartAt || (booking.scheduledDate && booking.startTime ? `${booking.scheduledDate}T${booking.startTime}:00` : '');
  const scheduledStartMs = scheduledStart ? new Date(scheduledStart).getTime() : Number.NaN;
  const isAddressReleaseWindowOpen = Number.isFinite(scheduledStartMs)
    && checkInNow.getTime() >= scheduledStartMs - (60 * 60 * 1_000);
  const rawMeetingPoint = booking.meetingPoint || snapshot.meetingPoint;
  const isProviderAddress = [booking.meetingPoint, snapshot?.meetingPoint].some((value) => (
    typeof value === 'object' && value !== null && (value as { type?: string }).type === 'PROVIDER_ADDRESS'
  ));
  const meetingPoint = isPendingPayment
    ? formatPendingPaymentMeetingPoint(rawMeetingPoint || booking.fullMeetingPoint)
    : isProviderAddress && booking.fullMeetingPoint
    ? booking.fullMeetingPoint
    : formatMeetingPoint(rawMeetingPoint);
  const latitude = (booking.meetingPoint as any)?.latitude ?? (snapshot?.meetingPoint as any)?.latitude;
  const longitude = (booking.meetingPoint as any)?.longitude ?? (snapshot?.meetingPoint as any)?.longitude;
  const mapPoint = latitude != null && longitude != null
    ? { lat: latitude, lng: longitude, title: meetingPoint || 'Ponto de encontro' }
    : undefined;
  const shouldHideProviderLocation = !isLessonStarted
    && ['CONFIRMED', 'IN_PROGRESS'].includes(booking.status)
    && !isProviderOnTheWay
    && isProviderAddress
    && !isAddressReleaseWindowOpen;
  const shouldHideDisputedProviderLocation = isDisputed && isProviderAddress;
  const shouldHideMeetingPoint = shouldHideProviderLocation || shouldHideDisputedProviderLocation;
  const visibleMeetingPoint = isCancelled
    ? (isProviderAddress ? '' : meetingPoint)
    : shouldHideMeetingPoint ? '' : meetingPoint;
  const hasPersistedCheckInData = Boolean(
    booking.studentCheckedIn
    || booking.instructorCheckedIn
    || booking.checkinStudentAt
    || booking.checkinInstructorAt,
  );
  const checkInFlowActive = ['CONFIRMED', 'IN_PROGRESS'].includes(booking.status);
  const visibleMapPoint = shouldHideProviderLocation || isCancelled ? undefined : mapPoint;
  const staticLessonMap = ['IN_PROGRESS', 'COMPLETED'].includes(booking.status) && Boolean(mapPoint);
  const cancelledMapOnly = isCancelled && Boolean(mapPoint);
  const meetingPointNotice = shouldHideDisputedProviderLocation
    ? 'Endereço oculto enquanto a contestação estiver em análise.'
    : shouldHideProviderLocation
    ? isProviderAddress && Number.isFinite(scheduledStartMs)
      ? `Endereço estará disponível a partir de ${formatTimeBR(new Date(scheduledStartMs - (60 * 60 * 1_000)).toISOString())}.`
      : 'Endereço estará disponível quando o instrutor estiver a caminho.'
    : undefined;
  const handleCopyMeetingPoint = async () => {
    if (!visibleMeetingPoint || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(meetingPoint);
      setIsAddressCopied(true);
      window.setTimeout(() => setIsAddressCopied(false), 1800);
    } catch {
      setIsAddressCopied(false);
    }
  };
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
  const bookingTotalInCents = snapshot.totalInCents || booking.totalInCents || 0;
  const refundAmountInCents = getBookingRefundAmountInCents(booking);

  const handleConfirmCancel = async () => {
    setIsCancelling(true);

    const finalReason = [selectedReasonChip, customReason.trim()].filter(Boolean).join(': ') || undefined;

    try {
      if (isInstantBooking && !isPendingPayment && (!instantCancellationQuote?.eligible || isLoadingInstantQuote)) {
        throw new Error('A cotação de reembolso ainda não está disponível. Aguarde um instante e tente novamente.');
      }
      const res = isPendingPayment
        ? await dbService.cancelPendingBooking(booking.id)
        : isInstantBooking
        ? await dbService.cancelInstantBooking({
            bookingId: booking.id,
            reason: finalReason,
            reasonCode: 'STUDENT_REQUEST',
            idempotencyKey: instantCancellationKeyRef.current || (instantCancellationKeyRef.current = `instant_cancel:${booking.id}:${Date.now()}`),
          })
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
        cancellationData: res.cancellation_data || booking.cancellationData,
      };

      if (onBookingUpdated) {
        onBookingUpdated(updated);
      }

      setIsConfirmingCancel(false);
      onClose();
    } catch (err: any) {
      if (process.env.NODE_ENV !== 'production') console.error('Error cancelling booking:', err);
      onToast?.({
        type: 'error',
        title: 'Cancelamento não concluído',
        description: mapFriendlyErrorMessage(err, 'Não foi possível cancelar a aula agora. Tente novamente em instantes.'),
      });
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
        disabled={isCancelling || (isInstantBooking && !isPendingPayment && (isLoadingInstantQuote || !instantCancellationQuote?.eligible))}
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

        {(isCompleted || isDisputed || isStaleConfirmed) && <BookingDisputePanel booking={booking} currentUserId={currentUserId} display="action" allowStaleConfirmed={isStaleConfirmed && currentUserId === booking.studentId} onToast={onToast} />}

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
        if (isConfirmingCancel) {
          setIsConfirmingCancel(false);
          return;
        }
        setIsConfirmingCancel(false);
        setIsTrackingOpen(false);
        onClose();
      }}
      title={isConfirmingCancel ? (isInstantBooking ? 'Cancelar Aula Agora' : 'Cancelar aula') : 'Detalhes da aula'}
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
              {isPendingPayment
                ? 'Revise os detalhes antes de prosseguir. O agendamento permanecerá em seu histórico como cancelado.'
                : 'Confira os detalhes e o reembolso aplicável antes de prosseguir. O agendamento permanecerá em seu histórico como cancelado.'}
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
            {!isPendingPayment && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Valor pago:</span>
                <span className="font-bold text-slate-900">{formatCentsToBRL(snapshot.totalInCents || booking.totalInCents)}</span>
              </div>
            )}
          </div>

          {!isPendingPayment && (isInstantBooking ? (
            <div className={`mazzi-compact-card rounded-2xl border p-4 space-y-1 ${
              instantQuoteError || (instantCancellationQuote && !instantCancellationQuote.eligible)
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}>
              <div className="flex items-center justify-between gap-2 font-extrabold text-xs">
                <span className="uppercase tracking-wider font-extrabold text-[11px] sm:text-xs">Aula Agora · reembolso</span>
                {instantCancellationQuote && (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-200 text-emerald-900 text-[10px] sm:text-[11px] font-black shrink-0 whitespace-nowrap">
                    {instantCancellationQuote.refundPercentage}% REEMBOLSO
                  </span>
                )}
              </div>
              {isLoadingInstantQuote && <p className="text-xs font-semibold leading-relaxed pt-1">Calculando o reembolso com os dados oficiais da aula...</p>}
              {instantQuoteError && <p className="text-xs font-semibold leading-relaxed pt-1">{instantQuoteError}</p>}
              {!isLoadingInstantQuote && !instantQuoteError && instantCancellationQuote?.eligible && (
                <>
                  <p className="text-xs font-semibold leading-relaxed pt-1">O valor é calculado pelo momento atual da Aula Agora e será confirmado pelo servidor no cancelamento.</p>
                  <p className="text-xs font-black pt-1">Reembolso: {formatCentsToBRL(instantCancellationQuote.refundAmountInCents)} · Retido/taxa: {formatCentsToBRL(instantCancellationQuote.retainedAmountInCents)}</p>
                </>
              )}
            </div>
          ) : (
            /* Financial Policy Result Banner — Agenda / DEC-013 */
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
              <p className="text-xs font-semibold leading-relaxed pt-1">{policyCalc.policyDescription}</p>
              {policyCalc.refundPercentage > 0 && (
                <p className="text-xs font-black pt-1">Valor estimado do reembolso: {formatCentsToBRL(policyCalc.refundAmountInCents)}</p>
              )}
            </div>
          ))}

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

        </div>
      ) : (
        /* STANDARD DETAILS VIEW */
        <div className="space-y-4 text-left">
          {isPendingPayment && isHoldValid && secondsLeft !== null && (
            <CountdownTimer
              secondsRemaining={secondsLeft}
              ariaLabel={`Você tem mais ${secondsLeft} segundos para realizar o pagamento`}
            />
          )}
          {!isLessonStarted && !shouldHideProviderLocation && isProviderOnTheWay && (trackingPreview || (trackingRequest ? (
            <InstantLessonTrackingCard
              request={trackingRequest}
              tracking={instantTracking}
              providerName={instructor || provider || 'Seu profissional'}
              priceInCents={snapshot.priceInCents || booking.priceInCents}
              paymentConfirmed={!isPendingPayment}
              onOpenTracking={() => setIsTrackingOpen(true)}
            />
          ) : null))}
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
            visible={checkInFlowActive || hasPersistedCheckInData}
            checkInAvailability={checkInAvailability}
            checkInError={checkInError}
            isCheckingIn={isCheckingIn}
            onCheckIn={checkInFlowActive ? handleStudentCheckInAction : undefined}
            showCheckInAction={checkInFlowActive}
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
            meetingPoint={visibleMeetingPoint}
            meetingPointNotice={meetingPointNotice}
            isProviderAddress={isProviderAddress && !shouldHideMeetingPoint && !isCancelled}
            showCopyAddress={isProviderAddress && !isPendingPayment && !shouldHideMeetingPoint && !staticLessonMap && !isCancelled}
            addressCopied={isAddressCopied}
            onCopyAddress={handleCopyMeetingPoint}
          />

          {cancelledMapOnly && !isPendingPayment && mapPoint && (
            <BookingMapPreview latitude={mapPoint.lat} longitude={mapPoint.lng} title={mapPoint.title} showMarker={false} />
          )}
          {staticLessonMap && !isCancelled && !isPendingPayment && mapPoint && (
            <BookingMapPreview latitude={mapPoint.lat} longitude={mapPoint.lng} title={mapPoint.title} showMarker />
          )}
          {!staticLessonMap && !isCancelled && !isDisputed && !isLessonStarted && !isPendingPayment && shouldHideProviderLocation && mapPoint && (
             <BookingMapPreview latitude={mapPoint.lat} longitude={mapPoint.lng} title={mapPoint.title} showMarker={false} />
          )}
          {!staticLessonMap && !isCancelled && !isLessonStarted && !isPendingPayment && visibleMapPoint && <BookingMapPreview
            latitude={visibleMapPoint.lat}
            longitude={visibleMapPoint.lng}
            title={visibleMapPoint.title}
            showMarker={!shouldHideDisputedProviderLocation}
            showNavigation={isProviderAddress && !shouldHideMeetingPoint && Boolean(mapPoint)}
            onOpenNavigation={() => setIsNavigationOpen(true)}
          />}

          <BookingPaymentSummary
            items={[
              { label: 'Valor da aula prática', amount: formatCentsToBRL(snapshot.priceInCents) },
            ]}
            total={formatCentsToBRL(bookingTotalInCents)}
            totalLabel="Total pago pelo aluno"
          />

          {refundAmountInCents > 0 && (
            <div role="status" className="mazzi-compact-card rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">Reembolso ao aluno</p>
                  <p className="mt-1 text-xs font-semibold text-emerald-800">Valor confirmado para devolução</p>
                </div>
                <p className="text-lg font-black">{formatCentsToBRL(refundAmountInCents)}</p>
              </div>
            </div>
          )}

          {refundAmountInCents <= 0 && isCancelled && (
            <div role="status" className="mazzi-compact-card rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-800">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Reembolso ao aluno</p>
              <p className="mt-1 text-xs font-semibold">Não há reembolso aplicável a este cancelamento.</p>
            </div>
          )}

          <BookingCancellationNotice booking={booking} />
          <BookingPaymentStateNotices
            isPendingPayment={isPendingPayment}
            isHoldValid={isHoldValid}
            secondsLeft={secondsLeft}
            isExpired={isExpired}
            showCountdown={false}
          />

          <BookingDisputePanel
            booking={booking}
            currentUserId={currentUserId}
            allowStaleConfirmed={isStaleConfirmed && currentUserId === booking.studentId}
            onToast={onToast}
          />

        </div>
      )}
    </Modal>
    <Modal
        isOpen={isTrackingOpen && Boolean(trackingRequest)}
        onClose={() => setIsTrackingOpen(false)}
        title="Acompanhamento da aula"
        ariaLabel="Acompanhamento do profissional"
        size="md"
        layer="nested"
        showBackButton
        fillContent
      >
        {trackingRequest && (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            <InstantLessonTrackingCard
              request={trackingRequest}
              tracking={instantTracking}
              providerName={instructor || provider || 'Seu profissional'}
              priceInCents={snapshot.priceInCents || booking.priceInCents}
              paymentConfirmed={!isPendingPayment}
            />
          </div>
        )}
      </Modal>
    {isProviderAddress && mapPoint && !staticLessonMap && !isCancelled && (
      <ExternalNavigationModal
        isOpen={isNavigationOpen}
        onClose={() => setIsNavigationOpen(false)}
        target={{ latitude: mapPoint.lat, longitude: mapPoint.lng, label: meetingPoint }}
      />
    )}
    </>
  );
};
