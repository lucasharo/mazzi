import React, { useState, useEffect } from 'react';
import {
  Building2,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  Clock3,
  Compass,
  CreditCard,
  AlertCircle,
  MapPin,
  MessageSquare,
  Navigation,
  Play,
  UserCheck,
  UserRound,
  X,
  XCircle,
} from 'lucide-react';
import { Booking } from '../../../types';
import { Modal } from '../../../components/ui/Modal';
import { Button, SecondaryButton } from '../../../components/ui/Button';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { formatMeetingPoint, formatPendingPaymentMeetingPoint } from '../../../lib/meeting-point';
import { needsMeetingPointAddress } from '../../../domain/maps/meeting-point-address';
import { formatCentsToBRL } from '../../../domain/money';
import { calculateLessonDurationMinutes, formatTransmissionLabel, formatTimeBR } from '../../../lib/date-format';
import { mapFriendlyErrorMessage } from '../../../lib/error-mapper';
import { getCheckInAvailability } from '../../../domain/checkin';
import { UNPAID_BOOKING_STATUSES } from '../../../domain/booking';
import { BookingDisputePanel } from '../../../components/booking/BookingDisputePanel';
import { UniversalMap } from '../../../components/maps/UniversalMap';
import { ExternalNavigationModal } from '../../../components/instant/ExternalNavigationModal';

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
  isLoading = false,
}) => {
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [submittingDisplacement, setSubmittingDisplacement] = useState(false);
  const [hasArrivedState, setHasArrivedState] = useState(hasArrivedProp);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [checkInNow, setCheckInNow] = useState(() => new Date());
  const [navModalOpen, setNavModalOpen] = useState(false);

  useEffect(() => {
    if (!isOpen || !booking) return undefined;
    setCheckInNow(new Date());
    setHasArrivedState(hasArrivedProp);
    const timer = window.setInterval(() => setCheckInNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, [isOpen, booking?.id, hasArrivedProp]);

  if (!booking) return null;

  const isInstant =
    booking.snapshot?.source === 'AULA_AGORA' ||
    (booking as any).snapshot_data?.source === 'AULA_AGORA' ||
    Boolean(onSetOnTheWay);

  const isWaitingPayment = isWaitingPaymentProp || booking.status === 'PENDING_PAYMENT';
  const isOnTheWay = isOnTheWayProp || booking.status === 'ON_THE_WAY';
  const isArrived = hasArrivedProp || hasArrivedState || Boolean(booking.instructorCheckedIn);

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
  const isCompleted = booking.status === 'COMPLETED';
  const isCancelled = booking.status === 'CANCELLED_BY_STUDENT' || booking.status === 'CANCELLED_BY_PROVIDER';
  const duration = calculateLessonDurationMinutes(booking);
  const studentName = booking.studentName?.trim() || 'Aluno';
  const providerName = snapshot.providerName || booking.providerName;
  const instructorName = snapshot.instructorName || booking.instructorName;
  const vehicleName = snapshot.vehicleName || booking.vehicleName || 'Veículo Cadastrado';
  const category = booking.offering?.category || snapshot.category || 'B';
  const transmission = formatTransmissionLabel(booking.offering?.transmission || snapshot.transmission || 'MANUAL');

  const meetingPointText = isWaitingPayment
    ? formatPendingPaymentMeetingPoint(booking.meetingPoint || snapshot.meetingPoint || booking.fullMeetingPoint)
    : formatMeetingPoint(booking.meetingPoint || snapshot.meetingPoint) ||
      (booking.fullMeetingPoint && !needsMeetingPointAddress(booking.fullMeetingPoint) ? booking.fullMeetingPoint : '') ||
      'Ponto de encontro indicado no mapa';

  const latitude = (booking.meetingPoint as any)?.latitude ?? (snapshot?.meetingPoint as any)?.latitude;
  const longitude = (booking.meetingPoint as any)?.longitude ?? (snapshot?.meetingPoint as any)?.longitude;

  const mapPoint = latitude != null && longitude != null
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
    isOnTheWay: isOnTheWay || Boolean(booking.snapshot?.provider_on_the_way_at),
    hasArrived: isArrived,
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
    if (!onStartLesson || isStarting) return;
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
          ) : !isOnTheWay && !isArrived ? (
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
          ) : !isArrived ? (
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
          ) : (
            onStartLesson && (
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
            )
          )}
          <div className="flex w-full items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className={`${onOpenChat ? 'flex-1' : 'w-full'} rounded-2xl border-[var(--mazzi-border)] bg-white font-bold text-slate-700 hover:bg-slate-50`}
              onClick={onClose}
              leftIcon={<X className="h-4 w-4 text-slate-500" aria-hidden="true" />}
            >
              Fechar
            </Button>
            {onOpenChat && (
              <SecondaryButton
                type="button"
                size="sm"
                className="flex-1 rounded-2xl border-slate-300 bg-white font-bold text-slate-700 shadow-sm transition-all hover:shadow-md"
                onClick={() => onOpenChat(booking)}
                leftIcon={<MessageSquare className="h-4 w-4 text-slate-500" aria-hidden="true" />}
                aria-label="Abrir conversa no chat sobre esta aula"
              >
                Mensagens
              </SecondaryButton>
            )}
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full rounded-2xl border-[var(--mazzi-border)] bg-white font-bold text-slate-700 hover:bg-slate-50"
          onClick={onClose}
          leftIcon={<X className="h-4 w-4 text-slate-500" aria-hidden="true" />}
        >
          Fechar
        </Button>
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
        {onOpenChat && (
          <SecondaryButton
            type="button"
            size="sm"
            className={`${canCancel || booking.status === 'DISPUTED' ? 'min-w-0 flex-1' : 'w-full'} rounded-2xl border-slate-300 bg-white font-bold text-slate-700 shadow-sm transition-all hover:shadow-md`}
            onClick={() => onOpenChat(booking)}
            leftIcon={<MessageSquare className="h-4 w-4 text-slate-500" aria-hidden="true" />}
            aria-label="Abrir conversa no chat sobre esta aula"
          >
            Mensagens
          </SecondaryButton>
        )}
        {(booking.status === 'COMPLETED' || booking.status === 'DISPUTED') && <BookingDisputePanel booking={booking} currentUserId={currentUserId} display="action" />}
        {canCancel && onCancelBooking && (
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
        useHistory={false}
        footer={UNPAID_BOOKING_STATUSES.includes(booking.status) && !isInstant ? undefined : isInstant ? instantFooter : standardFooter}
      >
        <div className="space-y-4 text-left" data-component="provider-booking-details-modal">
          {isInstant && (
            <>
              {isWaitingPayment ? (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
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
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
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
                        {isArrived
                          ? 'Você chegou ao ponto de encontro!'
                          : isOnTheWay
                          ? 'Você está a caminho!'
                          : 'Pagamento Confirmado!'}
                      </h3>
                      <p className="mt-1 text-xs font-medium text-slate-600">
                        {isArrived
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

          {!isInstant && (
            <div className="flex items-center justify-between rounded-2xl border border-[var(--mazzi-border)] bg-[var(--mazzi-surface-soft)] p-4">
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mazzi-muted)]">Aluno</p>
                <p className="mt-0.5 truncate text-sm font-extrabold text-[var(--mazzi-dark)]">{studentName}</p>
                <p className="mt-1 text-[11px] font-medium text-slate-500">Aula #{booking.id.slice(0, 8)}</p>
              </div>
              <StatusBadge status={booking.status} instructorCheckedIn={Boolean(booking.instructorCheckedIn || isArrived)} />
            </div>
          )}

          {/* Horário & Ponto de Encontro */}
          <div className="space-y-2.5 rounded-2xl border border-[var(--mazzi-border)] bg-white p-4 shadow-xs">
            <div className="flex items-center gap-2 text-sm font-extrabold text-[var(--mazzi-dark)]">
              <Calendar className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
              <span>Data: {booking.scheduledDate}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Clock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <span>
                {booking.status === 'COMPLETED' && lessonStart && lessonEnd
                  ? `Início: ${formatTimeBR(lessonStart)} · Fim: ${formatTimeBR(lessonEnd)}`
                  : `Horário: ${booking.startTime} às ${booking.endTime}`}
                {durationLabel ? ` · ${durationLabel}` : ''}
              </span>
            </div>
            {meetingPointText && (
              <div className="p-3.5 rounded-2xl bg-[var(--mazzi-surface-soft)] border border-[var(--mazzi-border)] space-y-2.5">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--mazzi-muted)]">
                  <MapPin className="h-3.5 w-3.5 text-amber-600 shrink-0" aria-hidden="true" />
                  Ponto de encontro exato
                </span>
                <p className="text-xs font-extrabold text-[var(--mazzi-dark)] break-words pt-0.5">{meetingPointText}</p>
                {!isWaitingPayment && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full rounded-2xl font-bold text-xs"
                    onClick={() => {
                      if (onOpenNavigation) onOpenNavigation();
                      setNavModalOpen(true);
                    }}
                    leftIcon={<Compass className="h-4 w-4 text-white" aria-hidden="true" />}
                  >
                    Abrir navegação
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* UniversalMap Preview */}
          {mapPoint && (
            <div className="overflow-hidden rounded-2xl border border-[var(--mazzi-border)] shadow-xs">
              <UniversalMap
                providers={[]}
                meetingPoint={mapPoint}
                height="180px"
                zoom={16}
                interactive={false}
              />
            </div>
          )}

          {/* Status de Presença e Check-in */}
          {(booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS' || isOnTheWay) && (
            <div className="space-y-3 rounded-2xl border border-[var(--mazzi-border)] bg-white p-4 shadow-xs">
              <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-500">
                <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Status de presença na aula
              </h4>
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div>
                  <span className="block text-xs font-bold text-slate-800">Check-in do aluno</span>
                  <span className="block text-[11px] text-slate-500">
                    {booking.studentCheckedIn ? 'Presença confirmada no ponto de encontro' : 'Aguardando check-in do aluno'}
                  </span>
                </div>
                {booking.studentCheckedIn ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                    Realizado {booking.checkinStudentAt ? `às ${formatTimeBR(booking.checkinStudentAt)}` : ''}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Aguardando</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="block text-xs font-bold text-slate-800">Seu check-in</span>
                  <span className="block text-[11px] text-slate-500">
                    {booking.instructorCheckedIn ? 'Presença confirmada no ponto de encontro' : 'Aguardando seu check-in'}
                  </span>
                </div>
                {booking.instructorCheckedIn ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                    Realizado {booking.checkinInstructorAt ? `às ${formatTimeBR(booking.checkinInstructorAt)}` : ''}
                  </span>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    isLoading={isCheckingIn}
                    disabled={isCheckingIn || !checkInAvailability.canCheckIn || !onCheckIn}
                    onClick={handleCheckIn}
                    leftIcon={<UserCheck className="h-3.5 w-3.5" aria-hidden="true" />}
                    aria-label="Fazer check-in na aula"
                  >
                    {checkInAvailability.canCheckIn ? 'Fazer check-in' : 'Check-in em breve'}
                  </Button>
                )}
              </div>
              {!booking.instructorCheckedIn && !checkInAvailability.canCheckIn && checkInAvailability.opensAt && (
                <p className="text-[11px] font-semibold text-slate-500">
                  Aguardando abertura do check-in · disponível a partir de {formatTimeBR(checkInAvailability.opensAt)}
                </p>
              )}
              {checkInError && (
                <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-bold text-rose-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
                  <span>{checkInError}</span>
                </div>
              )}
            </div>
          )}

          {/* Detalhamento do Profissional & Veículo */}
          <div className="space-y-3 rounded-2xl border border-[var(--mazzi-border)] bg-white p-4 shadow-xs">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Detalhes da aula</h4>
            <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              <div className="space-y-1">
                <span className="block text-[11px] font-medium text-slate-400">Autoescola</span>
                <div className="flex items-center gap-1.5 font-bold text-[var(--mazzi-dark)]">
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                  <span className="truncate">{providerName}</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="block text-[11px] font-medium text-slate-400">Instrutor</span>
                <div className="flex items-center gap-1.5 font-bold text-[var(--mazzi-dark)]">
                  <UserRound className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                  <span className="truncate">{instructorName}</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="block text-[11px] font-medium text-slate-400">Veículo</span>
                <div className="flex items-center gap-1.5 font-bold text-[var(--mazzi-dark)]">
                  <Car className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                  <span className="truncate">{vehicleName}</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="block text-[11px] font-medium text-slate-400">Categoria / Câmbio</span>
                <span className="font-bold text-[var(--mazzi-dark)]">
                  Cat. {category} · {transmission}
                </span>
              </div>
            </div>
          </div>

          {/* Resumo do Pagamento */}
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
              <span>Total da aula</span>
              <span>{formatCentsToBRL(bookingTotalInCents)}</span>
            </div>
          </div>

          {isCancelled && booking.cancellationReason && (
            <div role="status" className="space-y-1 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900">
              <div className="flex items-center gap-1.5 font-extrabold">
                <XCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
                <span>Motivo do cancelamento</span>
              </div>
              <p className="pl-5 text-[11px] font-medium text-rose-700">{booking.cancellationReason}</p>
            </div>
          )}

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
