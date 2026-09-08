import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  Clock3,
  Compass,
  MapPin,
  MessageSquare,
  Navigation,
  Play,
  XCircle,
} from 'lucide-react';
import { Booking } from '../../../types';
import { Modal } from '../../../components/ui/Modal';
import { Button, SecondaryButton } from '../../../components/ui/Button';
import { formatMeetingPoint, formatPendingPaymentMeetingPoint } from '../../../lib/meeting-point';
import { needsMeetingPointAddress } from '../../../domain/maps/meeting-point-address';
import { formatCentsToBRL } from '../../../domain/money';
import { calculateLessonDurationMinutes, formatTransmissionLabel, formatTimeBR } from '../../../lib/date-format';
import { mapFriendlyErrorMessage } from '../../../lib/error-mapper';
import { getCheckInAvailability } from '../../../domain/checkin';
import { getBookingStartTimestamp, getEffectiveBookingHoldExpiresAt } from '../../../domain/booking';
import { BookingDisputePanel } from '../../../components/booking/BookingDisputePanel';
import { ExternalNavigationModal } from '../../../components/instant/ExternalNavigationModal';
import { BookingDetailsHeader, BookingPresenceCard, BookingDetailsOverview, BookingMapPreview, BookingPaymentSummary, BookingCancellationNotice, BookingPaymentStateNotices } from '../../../components/booking/BookingDetailsShared';

export interface ProviderBookingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onOpenChat?: (booking: Booking) => void;
  onCheckIn?: (booking: Booking) => void | Promise<string | void>;
  onStartLesson?: (booking: Booking) => void | Promise<boolean | void>;
  onCompleteLesson?: (booking: Booking) => void | Promise<void>;
  onCancelBooking?: (booking: Booking) => void;
  isCompleting?: boolean;
  canCancelBooking?: (booking: Booking) => boolean;
  currentUserId?: string;
  isWaitingPayment?: boolean;
  isOnTheWay?: boolean;
  distanceKm?: number | null;
  etaMinutes?: number | null;
  onOpenNavigation?: () => void;
  onSetOnTheWay?: (bookingId: string) => Promise<void>;
  hasScheduleConflict?: boolean;
  checkInWindowBeforeMinutes?: number | null;
  instantLessonExpirationMinutes?: number;
  onRefreshBooking?: (bookingId: string) => Promise<Booking | null>;
  isLoading?: boolean;
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
  isCompleting = false,
  canCancelBooking,
  currentUserId,
  isWaitingPayment: isWaitingPaymentProp,
  isOnTheWay: isOnTheWayProp,
  distanceKm,
  etaMinutes,
  onOpenNavigation,
  onSetOnTheWay,
  hasScheduleConflict = false,
  checkInWindowBeforeMinutes,
  instantLessonExpirationMinutes,
  onRefreshBooking,
  isLoading = false,
}) => {
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const startingLessonBookingIdRef = useRef<string | null>(null);
  const [submittingDisplacement, setSubmittingDisplacement] = useState(false);
  const [hasStartedDisplacement, setHasStartedDisplacement] = useState(false);
  const [hasArrivedState, setHasArrivedState] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [checkInNow, setCheckInNow] = useState(() => new Date());
  const [navModalOpen, setNavModalOpen] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);

  useEffect(() => {
    // Keep the start action locked until the authoritative booking state
    // changes. The RPC may resolve before React receives the IN_PROGRESS update.
    if (!isOpen || !booking || booking.status === 'IN_PROGRESS') {
      startingLessonBookingIdRef.current = null;
      setIsStarting(false);
    }
  }, [isOpen, booking?.id, booking?.status]);

  useEffect(() => {
    setHasStartedDisplacement(false);
  }, [isOpen, booking?.id]);

  useEffect(() => {
    if (!isOpen || !booking) return undefined;
    setCheckInNow(new Date());
    setHasArrivedState(false);
    const timer = window.setInterval(() => setCheckInNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, [isOpen, booking?.id]);

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

    // Realtime remains the fast path, while this scoped fallback keeps the
    // open detail authoritative if the channel is delayed or unavailable.
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
  }, [isOpen, booking?.id, onRefreshBooking]);

  if (!booking) return null;

  const isWaitingPayment = isWaitingPaymentProp || booking.status === 'PENDING_PAYMENT';
  const isOnTheWay = isOnTheWayProp || hasStartedDisplacement || Boolean(booking.providerOnTheWayAt || booking.snapshot?.provider_on_the_way_at);
  const isArrived = hasArrivedState || Boolean(booking.instructorCheckedIn);

  const snapshot = booking.snapshot || {
    providerName: booking.providerName,
    instructorName: booking.instructorName,
    vehicleName: booking.vehicleName,
    meetingPoint: booking.meetingPoint,
    category: booking.category,
    transmission: undefined,
  } as Booking['snapshot'];

  // The persisted booking is authoritative. A snapshot can contain the
  // original/default meeting point and must not override the current booking.
  // The UI string is only a formatted label. Keep the structured snapshot as
  // the source for the meeting-point type (STUDENT_ADDRESS/PROVIDER_ADDRESS).
  const effectiveMeetingPoint = snapshot.meetingPoint ?? booking.meetingPoint ?? booking.fullMeetingPoint;
  const isProviderMeetingPoint = typeof effectiveMeetingPoint === 'object'
    && effectiveMeetingPoint !== null
    && (effectiveMeetingPoint as { type?: string }).type === 'PROVIDER_ADDRESS';
  const shouldWaitForStudentAtProviderLocation = isProviderMeetingPoint;

  const isConfirmed = booking.status === 'CONFIRMED';
  const isInProgress = booking.status === 'IN_PROGRESS';
  const isCompleted = booking.status === 'COMPLETED';
  const hasPersistedCheckInData = Boolean(
    booking.studentCheckedIn
    || booking.instructorCheckedIn
    || booking.checkinStudentAt
    || booking.checkinInstructorAt,
  );
  const checkInFlowActive = ['CONFIRMED', 'IN_PROGRESS'].includes(booking.status);
  const duration = calculateLessonDurationMinutes(booking);
  const studentName = booking.studentName?.trim() || 'Aluno';
  const providerName = snapshot.providerName || booking.providerName;
  const instructorName = snapshot.instructorName || booking.instructorName;
  const vehicleName = snapshot.vehicleName || booking.vehicleName || 'Veículo Cadastrado';
  const category = booking.offering?.category || snapshot.category || 'B';
  const transmission = formatTransmissionLabel(booking.offering?.transmission || snapshot.transmission || 'MANUAL');

  const rawMeetingPoint = effectiveMeetingPoint;
  const meetingPointText = isWaitingPayment
    ? formatPendingPaymentMeetingPoint(rawMeetingPoint)
    : booking.fullMeetingPoint && !needsMeetingPointAddress(booking.fullMeetingPoint)
      ? booking.fullMeetingPoint
      : formatMeetingPoint(rawMeetingPoint) ||
        (booking.fullMeetingPoint && !needsMeetingPointAddress(booking.fullMeetingPoint) ? booking.fullMeetingPoint : '') ||
        'Ponto de encontro indicado no mapa';
  const canShowMeetingPoint = !isWaitingPayment && (isOnTheWay || isProviderMeetingPoint || isCompleted);
  const meetingPointNotice = !canShowMeetingPoint && !isWaitingPayment
    ? 'Endereço estará disponível quando você clicar em “Estou a caminho”.'
    : undefined;

  const latitude = (booking.meetingPoint as any)?.latitude ?? (snapshot?.meetingPoint as any)?.latitude;
  const longitude = (booking.meetingPoint as any)?.longitude ?? (snapshot?.meetingPoint as any)?.longitude;

  const hasExactMeetingPoint = typeof latitude === 'number' && Number.isFinite(latitude)
    && typeof longitude === 'number' && Number.isFinite(longitude);
  const mapPoint = hasExactMeetingPoint
    ? { lat: latitude, lng: longitude, title: meetingPointText }
    : undefined;
  const completedMapOnly = isCompleted && Boolean(mapPoint);
  const lessonStart = booking.lessonStartedAt || '';
  const lessonEnd = booking.lessonFinishedAt || '';
  const durationLabel = booking.status === 'COMPLETED' && lessonStart && lessonEnd
    ? `Duração realizada: ${duration} min`
    : duration ? `${duration} min` : '';

  const lessonPriceInCents = snapshot.priceInCents ?? booking.priceInCents ?? booking.totalInCents ?? 0;
  const platformFeeInCents = snapshot.platformFeeInCents ?? booking.platformFeeInCents ?? 0;
  const bookingTotalInCents = snapshot.totalInCents ?? booking.totalInCents ?? lessonPriceInCents;
  const netAmountInCents = Math.max(0, bookingTotalInCents - platformFeeInCents);
  const effectiveHoldExpiresAt = getEffectiveBookingHoldExpiresAt(booking, instantLessonExpirationMinutes);

  const canCancel = canCancelBooking
    ? canCancelBooking(booking)
    : isConfirmed && !booking.instructorCheckedIn;

  const checkInAvailability = checkInWindowBeforeMinutes === null
    ? { canCheckIn: false, opensAt: null, reason: 'CONFIGURATION_UNAVAILABLE' as const }
    : getCheckInAvailability({
      scheduledStartAt: booking.scheduledStartAt,
      scheduledDate: booking.scheduledDate,
      startTime: booking.startTime,
      status: booking.status,
      alreadyCheckedIn: Boolean(booking.instructorCheckedIn),
      checkInWindowBeforeMinutes,
      now: checkInNow,
    });
  const lessonStartTimestamp = getBookingStartTimestamp(booking);
  const arrivalWindowOpen = checkInWindowBeforeMinutes !== null && lessonStartTimestamp > 0
    && (checkInAvailability.opensAt === null || checkInNow.getTime() >= checkInAvailability.opensAt.getTime());
  const canShowTravelActions = arrivalWindowOpen && !hasScheduleConflict;

  const handleCheckIn = async (): Promise<boolean> => {
    if (!onCheckIn || isCheckingIn) return false;
    setIsCheckingIn(true);
    setCheckInError(null);
    try {
      const result = await onCheckIn(booking);
      if (typeof result === 'string') {
        setCheckInError(result);
        return false;
      }
      return true;
    } catch (error) {
      setCheckInError(mapFriendlyErrorMessage(error, 'Não foi possível realizar o check-in. Tente novamente.'));
      return false;
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleStartLesson = async () => {
    if (
      !onStartLesson ||
      isStarting ||
      startingLessonBookingIdRef.current === booking.id ||
      !booking.instructorCheckedIn ||
      !booking.studentCheckedIn
    ) return;

    startingLessonBookingIdRef.current = booking.id;
    setIsStarting(true);
    try {
      const result = await onStartLesson(booking);
      if (result === false) {
        startingLessonBookingIdRef.current = null;
        setIsStarting(false);
      }
    } catch {
      // Keep the button available when a caller fails before changing status.
      startingLessonBookingIdRef.current = null;
      setIsStarting(false);
    }
  };

  const handleStartDisplacement = async () => {
    if (!onSetOnTheWay || submittingDisplacement || isLoading) return;
    setSubmittingDisplacement(true);
    try {
      await onSetOnTheWay(booking.id);
      setHasStartedDisplacement(true);
    } finally {
      setSubmittingDisplacement(false);
    }
  };

  const handleMarkArrived = async () => {
    if (isLoading) return;
    const checkInCompleted = await handleCheckIn();
    if (checkInCompleted) {
      setHasArrivedState(true);
      setCheckInError(null);
    }
  };

  const handleCopyAddress = async () => {
    if (isWaitingPayment || !isOnTheWay || !meetingPointText || meetingPointText === 'Ponto de encontro indicado no mapa') return;
    if (!navigator.clipboard?.writeText) return;

    try {
      await navigator.clipboard.writeText(meetingPointText);
      setAddressCopied(true);
      window.setTimeout(() => setAddressCopied(false), 1800);
    } catch {
      setAddressCopied(false);
    }
  };

  const instantFooter = (
    <div className="w-full">
      {!isWaitingPayment ? (
        <div className="w-full space-y-2.5">
          {isCompleted ? null : isInProgress ? (
            onCompleteLesson && (
              <Button
                type="button"
                variant="primary"
                className="w-full rounded-2xl border-[var(--mazzi-yellow)] bg-[var(--mazzi-yellow)] font-extrabold text-[var(--mazzi-dark)] hover:brightness-95"
                isLoading={isCompleting}
                disabled={isCompleting}
                onClick={() => void onCompleteLesson(booking)}
                leftIcon={<CheckCircle2 className="h-4 w-4 text-[var(--mazzi-dark)]" aria-hidden="true" />}
              >
                Finalizar aula
              </Button>
            )
          ) : !isOnTheWay && !isArrived && !shouldWaitForStudentAtProviderLocation && canShowTravelActions ? (
            <Button
              type="button"
              variant="primary"
              className="w-full rounded-2xl font-extrabold"
              isLoading={submittingDisplacement || isLoading}
              onClick={() => void handleStartDisplacement()}
              leftIcon={<Navigation className="h-4 w-4" aria-hidden="true" />}
            >
              Estou a caminho
            </Button>
          ) : !isArrived && !shouldWaitForStudentAtProviderLocation && canShowTravelActions ? (
            <Button
              type="button"
              variant="primary"
              className="w-full rounded-2xl font-extrabold"
              disabled={isLoading || submittingDisplacement || isCheckingIn || !checkInAvailability.canCheckIn}
              isLoading={isCheckingIn}
              onClick={() => void handleMarkArrived()}
              leftIcon={<MapPin className="h-4 w-4 text-[var(--mazzi-dark)]" aria-hidden="true" />}
            >
              Cheguei ao local
            </Button>
          ) : shouldWaitForStudentAtProviderLocation && !isArrived ? (
            <div className="mazzi-compact-card rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs font-bold text-slate-700" role="status">
              Ponto de encontro no local do PRO. Aguarde o aluno chegar.
            </div>
          ) : !isArrived && !canShowTravelActions ? (
            <div className="mazzi-compact-card rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs font-bold text-slate-700" role="status">
              {hasScheduleConflict ? 'Ações temporariamente indisponíveis por conflito com outra aula.' : checkInAvailability.opensAt ? `As ações ficarão disponíveis ${checkInWindowBeforeMinutes} minutos antes da aula.` : 'Ações indisponíveis até a configuração ser carregada.'}
            </div>
          ) : (
            booking.instructorCheckedIn && booking.studentCheckedIn ? (
              <Button
                type="button"
                variant="primary"
                className="w-full rounded-2xl border-emerald-600 bg-emerald-600 font-extrabold text-white hover:bg-emerald-700"
                isLoading={isStarting}
                disabled={isStarting}
                onClick={() => void handleStartLesson()}
                leftIcon={<Play className="h-4 w-4 fill-current" aria-hidden="true" />}
              >
                Iniciar aula
              </Button>
            ) : (
              <div
                className="mazzi-compact-card rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs font-bold text-amber-900"
                role="status"
              >
                Aguardando o check-in do aluno para iniciar a aula.
              </div>
            )
          )}
          {onOpenChat && (
            <SecondaryButton
              type="button"
              size="sm"
              className="w-full rounded-2xl font-bold shadow-sm transition-all hover:shadow-md"
              onClick={() => onOpenChat(booking)}
              leftIcon={<MessageSquare className="h-4 w-4 text-white" aria-hidden="true" />}
              aria-label="Abrir conversa no chat sobre esta aula"
            >
              Mensagens
            </SecondaryButton>
          )}
        </div>
      ) : (
        onOpenChat ? (
          <SecondaryButton
            type="button"
            size="sm"
            className="w-full rounded-2xl font-bold shadow-sm transition-all hover:shadow-md"
            onClick={() => onOpenChat(booking)}
            leftIcon={<MessageSquare className="h-4 w-4 text-white" aria-hidden="true" />}
            aria-label="Abrir conversa no chat sobre esta aula"
          >
            Mensagens
          </SecondaryButton>
        ) : null
      )}
    </div>
  );

  const standardFooter = (
    <div className="flex w-full flex-col gap-2.5">
      {!isCompleted && !isInProgress && !isProviderMeetingPoint && canShowTravelActions && !isArrived && (
        !isOnTheWay ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="w-full rounded-2xl font-bold"
            isLoading={submittingDisplacement || isLoading}
            onClick={() => void handleStartDisplacement()}
            leftIcon={<Navigation className="h-4 w-4" aria-hidden="true" />}
          >
            Estou a caminho
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="w-full rounded-2xl font-bold"
            disabled={isLoading || submittingDisplacement || isCheckingIn || !checkInAvailability.canCheckIn}
            isLoading={isCheckingIn}
            onClick={() => void handleMarkArrived()}
            leftIcon={<MapPin className="h-4 w-4 text-[var(--mazzi-dark)]" aria-hidden="true" />}
          >
            Cheguei ao local
          </Button>
        )
      )}
      {isConfirmed && booking.instructorCheckedIn && booking.studentCheckedIn && (
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="w-full rounded-2xl border-emerald-600 bg-emerald-600 font-bold text-white shadow-md transition-all hover:bg-emerald-700 hover:shadow-lg"
          onClick={() => void handleStartLesson()}
          disabled={isStarting}
          isLoading={isStarting}
          leftIcon={<Play className="h-4 w-4 fill-current" aria-hidden="true" />}
        >
          Iniciar aula
        </Button>
      )}
      {isInProgress && onCompleteLesson && (
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="w-full rounded-2xl border-[var(--mazzi-yellow)] bg-[var(--mazzi-yellow)] font-bold text-[var(--mazzi-dark)] shadow-md transition-all hover:brightness-95 hover:shadow-lg"
          onClick={() => onCompleteLesson(booking)}
          isLoading={isCompleting}
          leftIcon={<CheckCircle2 className="h-4 w-4 text-[var(--mazzi-dark)]" aria-hidden="true" />}
        >
          Finalizar aula
        </Button>
      )}
      {isConfirmed && isArrived && !(booking.instructorCheckedIn && booking.studentCheckedIn) && (
        <div
          className="mazzi-compact-card rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs font-bold text-amber-900"
          role="status"
        >
          Aguardando o check-in do aluno para iniciar a aula.
        </div>
      )}
      <div className="flex w-full items-center gap-3">
        {canCancel && onCancelBooking && (
          <Button
            type="button"
            variant="dangerSoft"
            size="sm"
            className={`${onOpenChat ? 'min-w-0 flex-1' : 'w-full'}`}
            onClick={() => onCancelBooking(booking)}
            aria-label="Cancelar aula"
            leftIcon={<XCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />}
          >
            Cancelar aula
          </Button>
        )}
        {onOpenChat && (
          <SecondaryButton
            type="button"
            size="sm"
            className={`${canCancel || booking.status === 'DISPUTED' ? 'min-w-0 flex-1' : 'w-full'} order-2 rounded-2xl font-bold shadow-sm transition-all hover:shadow-md`}
            onClick={() => onOpenChat(booking)}
            leftIcon={<MessageSquare className="h-4 w-4 text-white" aria-hidden="true" />}
            aria-label="Abrir conversa no chat sobre esta aula"
          >
            Mensagens
          </SecondaryButton>
        )}
        {(booking.status === 'COMPLETED' || booking.status === 'DISPUTED') && <BookingDisputePanel booking={booking} currentUserId={currentUserId} display="action" />}
      </div>
    </div>
  );

  const modalTitle = 'Detalhes da aula';

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={modalTitle}
        ariaLabel="Detalhes operacionais da aula"
        size="md"
        footer={isWaitingPayment ? instantFooter : standardFooter}
      >
        <div className="space-y-4 text-left" data-component="provider-booking-details-modal">
          {isWaitingPayment && !isCompleted && (
            <div className="mazzi-compact-card rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-900">
                  <Clock3 className="h-5 w-5 animate-pulse" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">O aluno está finalizando o pagamento</h3>
                  <p className="mt-1 text-xs font-medium text-slate-600">
                    A aula foi aceita. Aguarde a confirmação de pagamento do aluno antes de se deslocar.
                  </p>
                </div>
              </div>
            </div>
          )}

          <BookingDetailsHeader
            status={booking.status}
            audience="provider"
            title={studentName}
            subtitle={`Aula #${booking.id.slice(0, 8)}`}
            instructorCheckedIn={Boolean(booking.instructorCheckedIn)}
          />

          <BookingPresenceCard
            audience="provider"
            booking={hasArrivedState && !booking.instructorCheckedIn ? { ...booking, instructorCheckedIn: true } : booking}
            visible={checkInFlowActive || isOnTheWay || hasPersistedCheckInData}
            checkInAvailability={checkInAvailability}
            canCheckInAtLocation
            checkInError={checkInError}
            isCheckingIn={isCheckingIn}
            onCheckIn={checkInFlowActive ? handleCheckIn : undefined}
            showCheckInAction={isProviderMeetingPoint && checkInFlowActive}
          />

          <BookingDetailsOverview
            providerLabel="Autoescola"
            providerName={providerName}
            instructorName={instructorName}
            vehicleName={vehicleName}
            category={category}
            transmission={transmission}
            dateLabel={booking.scheduledDate}
            timeLabel={booking.status === 'COMPLETED' && lessonStart && lessonEnd
              ? `Início: ${formatTimeBR(lessonStart)} · Fim: ${formatTimeBR(lessonEnd)}`
              : `Horário: ${booking.startTime} às ${booking.endTime}`}
            durationLabel={durationLabel}
            meetingPoint={canShowMeetingPoint ? meetingPointText : ''}
            meetingPointNotice={meetingPointNotice}
            isProviderAddress={isProviderMeetingPoint}
            showCopyAddress={!isWaitingPayment && isOnTheWay && !isProviderMeetingPoint && !isCompleted}
            addressCopied={addressCopied}
            onCopyAddress={handleCopyAddress}
          />
          {completedMapOnly && !isWaitingPayment && mapPoint && (
            <BookingMapPreview latitude={mapPoint.lat} longitude={mapPoint.lng} title={mapPoint.title} showMarker />
          )}
          {!completedMapOnly && !isWaitingPayment && !canShowMeetingPoint && mapPoint && (
             <BookingMapPreview latitude={mapPoint.lat} longitude={mapPoint.lng} title={mapPoint.title} showMarker={false} />
          )}
          {!completedMapOnly && mapPoint && canShowMeetingPoint && <BookingMapPreview
            latitude={mapPoint.lat}
            longitude={mapPoint.lng}
            title={mapPoint.title}
            showNavigation={!isInProgress && hasExactMeetingPoint && !isProviderMeetingPoint}
            onOpenNavigation={() => {
              if (onOpenNavigation) onOpenNavigation();
              setNavModalOpen(true);
            }}
          />}

          <BookingPaymentSummary
            items={[
              { label: 'Valor líquido', amount: formatCentsToBRL(netAmountInCents) },
              { label: 'Taxa de Serviço MAZZI', amount: formatCentsToBRL(platformFeeInCents) },
            ]}
            total={formatCentsToBRL(bookingTotalInCents)}
          />

          <BookingCancellationNotice booking={booking} />
          <BookingPaymentStateNotices
            isPendingPayment={isWaitingPayment}
            isHoldValid={effectiveHoldExpiresAt ? new Date(effectiveHoldExpiresAt).getTime() > Date.now() : true}
            secondsLeft={effectiveHoldExpiresAt ? Math.max(0, Math.ceil((new Date(effectiveHoldExpiresAt).getTime() - Date.now()) / 1000)) : null}
            isExpired={booking.status === 'EXPIRED' || (isWaitingPayment && Boolean(effectiveHoldExpiresAt) && new Date(effectiveHoldExpiresAt).getTime() <= Date.now())}
          />

          <BookingDisputePanel booking={booking} currentUserId={currentUserId} />
        </div>
      </Modal>

      {latitude != null && longitude != null && !isCompleted && (
        <ExternalNavigationModal
          isOpen={navModalOpen}
          onClose={() => setNavModalOpen(false)}
          target={{ latitude, longitude, label: meetingPointText }}
        />
      )}
    </>
  );
};
