import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock3,
  Compass,
  MapPin,
  MessageSquare,
  Navigation,
  Play,
  UserCheck,
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
import { UNPAID_BOOKING_STATUSES } from '../../../domain/booking';
import { BookingDisputePanel } from '../../../components/booking/BookingDisputePanel';
import { ExternalNavigationModal } from '../../../components/instant/ExternalNavigationModal';
import { BookingDetailsHeader, BookingPresenceCard, BookingDetailsOverview, BookingMapPreview, BookingPaymentSummary, BookingCancellationNotice, BookingPaymentStateNotices } from '../../../components/booking/BookingDetailsShared';

export interface ProviderBookingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onOpenChat?: (booking: Booking) => void;
  onCheckIn?: (booking: Booking) => void | Promise<string | void>;
  onStartLesson?: (booking: Booking) => void | Promise<void>;
  onCompleteLesson?: (booking: Booking) => void | Promise<void>;
  onCancelBooking?: (booking: Booking) => void;
  isCompleting?: boolean;
  canCancelBooking?: (booking: Booking) => boolean;
  currentUserId?: string;
  isWaitingPayment?: boolean;
  isOnTheWay?: boolean;
  hasArrived?: boolean;
  distanceKm?: number | null;
  etaMinutes?: number | null;
  onOpenNavigation?: () => void;
  onSetOnTheWay?: (bookingId: string) => Promise<void>;
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
  hasArrived: hasArrivedProp = false,
  distanceKm,
  etaMinutes,
  onOpenNavigation,
  onSetOnTheWay,
  onRefreshBooking,
  isLoading = false,
}) => {
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [submittingDisplacement, setSubmittingDisplacement] = useState(false);
  const [hasArrivedState, setHasArrivedState] = useState(hasArrivedProp);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [checkInNow, setCheckInNow] = useState(() => new Date());
  const [navModalOpen, setNavModalOpen] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !booking) return undefined;
    setCheckInNow(new Date());
    setHasArrivedState(hasArrivedProp);
    const timer = window.setInterval(() => setCheckInNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, [isOpen, booking?.id, hasArrivedProp]);

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

  const isInstant =
    booking.snapshot?.source === 'AULA_AGORA' ||
    (booking as any).snapshot_data?.source === 'AULA_AGORA';

  const isWaitingPayment = isWaitingPaymentProp || booking.status === 'PENDING_PAYMENT';
  const isOnTheWay = isOnTheWayProp || Boolean(booking.providerOnTheWayAt || booking.snapshot?.provider_on_the_way_at);
  const isArrived = hasArrivedProp || hasArrivedState || Boolean(booking.instructorCheckedIn);

  const snapshot = booking.snapshot || {
    providerName: booking.providerName,
    instructorName: booking.instructorName,
    vehicleName: booking.vehicleName,
    meetingPoint: booking.meetingPoint,
    category: booking.category,
    transmission: undefined,
  } as Booking['snapshot'];

  const isProviderMeetingPoint = [booking.meetingPoint, snapshot.meetingPoint].some((value) => (
    typeof value === 'object' && value !== null && (value as { type?: string }).type === 'PROVIDER_ADDRESS'
  ));
  const shouldWaitForStudentAtProviderLocation = isProviderMeetingPoint;

  const isConfirmed = booking.status === 'CONFIRMED';
  const isInProgress = booking.status === 'IN_PROGRESS';
  const isCompleted = booking.status === 'COMPLETED';
  const duration = calculateLessonDurationMinutes(booking);
  const studentName = booking.studentName?.trim() || 'Aluno';
  const providerName = snapshot.providerName || booking.providerName;
  const instructorName = snapshot.instructorName || booking.instructorName;
  const vehicleName = snapshot.vehicleName || booking.vehicleName || 'Veículo Cadastrado';
  const category = booking.offering?.category || snapshot.category || 'B';
  const transmission = formatTransmissionLabel(booking.offering?.transmission || snapshot.transmission || 'MANUAL');

  const rawMeetingPoint = booking.meetingPoint || snapshot.meetingPoint || booking.fullMeetingPoint;
  const meetingPointText = isWaitingPayment
    ? formatPendingPaymentMeetingPoint(rawMeetingPoint)
    : isProviderMeetingPoint && booking.fullMeetingPoint
      ? booking.fullMeetingPoint
      : formatMeetingPoint(rawMeetingPoint) ||
        (booking.fullMeetingPoint && !needsMeetingPointAddress(booking.fullMeetingPoint) ? booking.fullMeetingPoint : '') ||
        'Ponto de encontro indicado no mapa';

  const latitude = (booking.meetingPoint as any)?.latitude ?? (snapshot?.meetingPoint as any)?.latitude;
  const longitude = (booking.meetingPoint as any)?.longitude ?? (snapshot?.meetingPoint as any)?.longitude;

  const hasExactMeetingPoint = typeof latitude === 'number' && Number.isFinite(latitude)
    && typeof longitude === 'number' && Number.isFinite(longitude);
  const mapPoint = hasExactMeetingPoint
    ? { lat: latitude, lng: longitude, title: meetingPointText }
    : undefined;
  const lessonStart = booking.lessonStartedAt || '';
  const lessonEnd = booking.lessonFinishedAt || '';
  const durationLabel = booking.status === 'COMPLETED' && lessonStart && lessonEnd
    ? `Duração realizada: ${duration} min`
    : duration ? `${duration} min` : '';

  const lessonPriceInCents = snapshot.priceInCents ?? booking.priceInCents ?? booking.totalInCents ?? 0;
  const platformFeeInCents = snapshot.platformFeeInCents ?? booking.platformFeeInCents ?? 0;
  const bookingTotalInCents = snapshot.totalInCents ?? booking.totalInCents ?? lessonPriceInCents;
  const netAmountInCents = Math.max(0, bookingTotalInCents - platformFeeInCents);

  const canCancel = canCancelBooking
    ? canCancelBooking(booking)
    : isConfirmed && !booking.instructorCheckedIn && !isInstant;

  const checkInAvailability = getCheckInAvailability({
    scheduledStartAt: booking.scheduledStartAt,
    scheduledDate: booking.scheduledDate,
    startTime: booking.startTime,
    status: booking.status,
    alreadyCheckedIn: Boolean(booking.instructorCheckedIn),
    now: checkInNow,
  });

  const handleCheckIn = async () => {
    if (!onCheckIn || isCheckingIn) return;
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

  const handleStartLesson = async () => {
    if (!onStartLesson || isStarting || !booking.instructorCheckedIn || !booking.studentCheckedIn) return;
    setIsStarting(true);
    try {
      await onStartLesson(booking);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStartDisplacement = async () => {
    if (!onSetOnTheWay || submittingDisplacement || isLoading) return;
    setSubmittingDisplacement(true);
    try {
      await onSetOnTheWay(booking.id);
    } finally {
      setSubmittingDisplacement(false);
    }
  };

  const handleCopyAddress = async () => {
    if (isWaitingPayment || !meetingPointText || meetingPointText === 'Ponto de encontro indicado no mapa') return;
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
                className="w-full rounded-2xl font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                isLoading={isCompleting}
                disabled={isCompleting}
                onClick={() => void onCompleteLesson(booking)}
                leftIcon={<CheckCircle2 className="h-4 w-4 text-white" aria-hidden="true" />}
              >
                Finalizar aula
              </Button>
            )
          ) : !isOnTheWay && !isArrived && !shouldWaitForStudentAtProviderLocation ? (
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
          ) : !isArrived && !shouldWaitForStudentAtProviderLocation ? (
            <Button
              type="button"
              variant="primary"
              className="w-full rounded-2xl font-extrabold"
              disabled={isLoading || submittingDisplacement || isCheckingIn}
              isLoading={isCheckingIn}
              onClick={async () => {
                setHasArrivedState(true);
                if (onCheckIn) {
                  await handleCheckIn();
                }
              }}
              leftIcon={<MapPin className="h-4 w-4 text-[var(--mazzi-dark)]" aria-hidden="true" />}
            >
              Cheguei ao local
            </Button>
          ) : shouldWaitForStudentAtProviderLocation && !isArrived ? (
            <div className="mazzi-compact-card rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs font-bold text-slate-700" role="status">
              Ponto de encontro no local do PRO. Aguarde o aluno chegar.
            </div>
          ) : (
            booking.instructorCheckedIn && booking.studentCheckedIn ? (
              <Button
                type="button"
                variant="primary"
                className="w-full rounded-2xl font-extrabold"
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
      {isConfirmed && booking.instructorCheckedIn && booking.studentCheckedIn && (
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="w-full rounded-2xl font-bold shadow-md transition-all hover:shadow-lg"
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
          className="w-full rounded-2xl font-bold shadow-md transition-all hover:shadow-lg"
          onClick={() => onCompleteLesson(booking)}
          isLoading={isCompleting}
          leftIcon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
        >
          Finalizar aula
        </Button>
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

  const modalTitle = isInstant
    ? isWaitingPayment
      ? 'Aula Agora — Aguardando Pagamento'
      : 'Aula Agora Confirmada'
    : 'Detalhes da aula';

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={modalTitle}
        ariaLabel="Detalhes operacionais da aula"
        size="md"
        footer={UNPAID_BOOKING_STATUSES.includes(booking.status) && !isInstant ? undefined : isInstant ? instantFooter : standardFooter}
      >
        <div className="space-y-4 text-left" data-component="provider-booking-details-modal">
          {isInstant && !isCompleted && (
            <>
              {isWaitingPayment ? (
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
              ) : (
                <div className="mazzi-compact-card rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white shadow-xs">
                      {isArrived ? (
                        <UserCheck className="h-5 w-5" aria-hidden="true" />
                      ) : isOnTheWay ? (
                        <Navigation className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                      )}
                    </span>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">
                        {isInProgress
                          ? 'Aula em andamento'
                          : isArrived
                          ? 'Você chegou ao ponto de encontro!'
                          : isOnTheWay
                          ? 'Você está a caminho!'
                          : 'Pagamento Confirmado!'}
                      </h3>
                      <p className="mt-1 text-xs font-medium text-slate-600">
                        {isInProgress
                          ? 'A aula já foi iniciada. Acompanhe abaixo os detalhes e o status de presença.'
                          : isArrived
                          ? 'O check-in foi liberado para você e para o aluno. Faça seu check-in para iniciar a aula.'
                          : isOnTheWay
                          ? 'O aluno já foi avisado e está aguardando você no ponto de encontro.'
                          : 'Sua aula foi confirmada pelo backend. Confira os detalhes e dirija-se ao ponto de encontro.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <BookingDetailsHeader
            status={booking.status}
            audience="provider"
            title={studentName}
            subtitle={`Aula #${booking.id.slice(0, 8)}`}
            instructorCheckedIn={Boolean(booking.instructorCheckedIn || isArrived)}
          />

          <BookingPresenceCard
            audience="provider"
            booking={booking}
            visible={booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS' || isOnTheWay}
            checkInAvailability={checkInAvailability}
            checkInError={checkInError}
            isCheckingIn={isCheckingIn}
            onCheckIn={handleCheckIn}
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
            meetingPoint={meetingPointText}
            isProviderAddress={isProviderMeetingPoint}
            showCopyAddress={!isWaitingPayment && !isProviderMeetingPoint}
            addressCopied={addressCopied}
            onCopyAddress={handleCopyAddress}
            hasExactMeetingPoint={hasExactMeetingPoint}
            showNavigation={!isWaitingPayment && !isProviderMeetingPoint}
            onOpenNavigation={() => {
              if (onOpenNavigation) onOpenNavigation();
              setNavModalOpen(true);
            }}
          />
          {mapPoint && <BookingMapPreview latitude={mapPoint.lat} longitude={mapPoint.lng} title={mapPoint.title} />}

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
            isHoldValid={booking.holdExpiresAt ? new Date(booking.holdExpiresAt).getTime() > Date.now() : true}
            minutesLeft={booking.holdExpiresAt ? Math.max(1, Math.ceil((new Date(booking.holdExpiresAt).getTime() - Date.now()) / (1000 * 60))) : null}
            isExpired={booking.status === 'EXPIRED' || (isWaitingPayment && Boolean(booking.holdExpiresAt) && new Date(booking.holdExpiresAt).getTime() <= Date.now())}
          />

          <BookingDisputePanel booking={booking} currentUserId={currentUserId} />
        </div>
      </Modal>

      {latitude != null && longitude != null && (
        <ExternalNavigationModal
          isOpen={navModalOpen}
          onClose={() => setNavModalOpen(false)}
          target={{ latitude, longitude, label: meetingPointText }}
        />
      )}
    </>
  );
};
