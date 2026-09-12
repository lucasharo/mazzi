import React from 'react';
import { Calendar as CalendarIcon, Car, CheckCircle2, ExternalLink, MapPin, Sparkles, UserRound, WifiOff, XCircle } from 'lucide-react';
import { Booking } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { EnvironmentBadge } from '../../../components/ui/EnvironmentBadge';
import { UniversalMap } from '../../../components/maps/UniversalMap';
import { formatDateBR, formatTimeBR, formatTransmissionLabel } from '../../../lib/date-format';
import { formatMeetingPoint } from '../../../lib/meeting-point';

export type StripeCheckoutReturnStatus = 'CHECKOUT_SUCCESS' | 'SUCCESS' | 'CANCELLED' | 'OFFLINE' | 'ERROR';

const SUCCESS_TRANSITION_DURATION_MS = 2_000;

interface Props {
  status: StripeCheckoutReturnStatus;
  booking?: Booking | null;
  message?: string;
  onViewBookings: () => void;
  onViewBooking?: (booking: Booking) => void;
  onBackToSearch: () => void;
}

export const StripeCheckoutReturnScreen: React.FC<Props> = ({
  status,
  booking,
  message,
  onViewBookings,
  onViewBooking,
  onBackToSearch,
}) => {
  // Payment confirmation is authoritative once the backend reports SUCCESS.
  // The checkout return is presented immediately, but it never changes the
  // payment or booking state. The backend can still replace it with an error
  // or offline state while the authoritative confirmation is pending.
  const isSuccess = status === 'SUCCESS';
  const isCheckoutSuccess = status === 'CHECKOUT_SUCCESS';
  const isSuccessPresentation = isSuccess || isCheckoutSuccess;
  const isInstantBooking = booking?.snapshot?.source === 'AULA_AGORA'
    || (booking as any)?.snapshot_data?.source === 'AULA_AGORA';
  const isCancelled = status === 'CANCELLED';
  const isOffline = status === 'OFFLINE';
  const [successTransitionComplete, setSuccessTransitionComplete] = React.useState(!isSuccessPresentation);
  const autoOpenedBookingRef = React.useRef(false);

  React.useEffect(() => {
    if (!isSuccessPresentation || successTransitionComplete) return undefined;

    const timer = window.setTimeout(() => {
      setSuccessTransitionComplete(true);
    }, SUCCESS_TRANSITION_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [isSuccessPresentation, successTransitionComplete]);

  React.useEffect(() => {
    if (status !== 'SUCCESS' || !booking || !successTransitionComplete || autoOpenedBookingRef.current) return;
    autoOpenedBookingRef.current = true;
    onViewBooking?.(booking);
  }, [booking, onViewBooking, status, successTransitionComplete]);

  const scheduleDate = booking?.scheduledStartAt ? formatDateBR(booking.scheduledStartAt) : booking ? formatDateBR(booking.scheduledDate) : '';
  const scheduleStart = booking?.scheduledStartAt ? formatTimeBR(booking.scheduledStartAt) : booking?.startTime || '';
  const scheduleEnd = booking?.scheduledEndAt ? formatTimeBR(booking.scheduledEndAt) : booking?.endTime || '';
  const vehicleName = booking?.vehicleName || booking?.snapshot.vehicleName || 'Veículo não informado';
  const scheduledStart = booking?.scheduledStartAt || (booking?.scheduledDate && booking?.startTime ? `${booking.scheduledDate}T${booking.startTime}:00` : '');
  const scheduledStartMs = scheduledStart ? new Date(scheduledStart).getTime() : Number.NaN;
  const isAddressReleaseWindowOpen = Number.isFinite(scheduledStartMs)
    && Date.now() >= scheduledStartMs - (60 * 60 * 1_000);
  const isProviderAddress = [booking?.meetingPoint, booking?.snapshot?.meetingPoint].some((value) => (
    typeof value === 'object' && value !== null && (value as { type?: string }).type === 'PROVIDER_ADDRESS'
  ));
  const isLessonStarted = booking?.status === 'IN_PROGRESS' || Boolean(booking?.lessonStartedAt);
  const isProviderOnTheWay = Boolean(booking?.providerOnTheWayAt);
  const shouldHideMeetingPoint = Boolean(booking)
    && !isLessonStarted
    && !isProviderOnTheWay
    && isProviderAddress
    && !isAddressReleaseWindowOpen;
  const meetingPointNotice = shouldHideMeetingPoint
    ? isProviderAddress && Number.isFinite(scheduledStartMs)
      ? `Endereço estará disponível a partir de ${formatTimeBR(new Date(scheduledStartMs - (60 * 60 * 1_000)).toISOString())}.`
      : 'Endereço estará disponível quando o instrutor estiver a caminho.'
    : undefined;
  const meetingPointCoordinates = [booking?.meetingPoint, booking?.snapshot?.meetingPoint]
    .map((value) => value && typeof value === 'object' ? value as { latitude?: unknown; longitude?: unknown } : null)
    .find((value) => value && Number.isFinite(Number(value.latitude)) && Number.isFinite(Number(value.longitude)));
  const mapCenter = meetingPointCoordinates
    ? { lat: Number(meetingPointCoordinates.latitude), lng: Number(meetingPointCoordinates.longitude) }
    : undefined;

  return (
    <section
      className="fixed inset-0 z-[120] overflow-y-auto bg-[var(--mazzi-bg)] text-[var(--mazzi-text)]"
      aria-live="polite"
      aria-label="Retorno do pagamento Stripe"
    >
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-4 py-4 sm:px-8 sm:py-6">
        <div className="flex flex-1 flex-col items-center justify-start py-4 text-center sm:justify-center sm:py-7">
          <div className="flex w-full justify-end">
            <EnvironmentBadge />
          </div>
          {isSuccessPresentation && !successTransitionComplete ? (
            <div
              className="fixed inset-0 z-[130] flex flex-col items-center justify-center bg-emerald-500 px-6 text-center text-white"
              role="status"
              aria-live="polite"
              aria-label="Pagamento confirmado"
            >
              <div className="mazzi-checkout-return-success-icon relative flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-emerald-100 bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-14 w-14" strokeWidth={2.5} aria-hidden="true" />
                <Sparkles className="absolute -right-2 -top-2 h-5 w-5 fill-emerald-300 text-emerald-50" aria-hidden="true" />
                <Sparkles className="absolute -bottom-2 -left-2 h-4 w-4 fill-emerald-200 text-emerald-50" aria-hidden="true" />
              </div>
              <p className="mt-6 text-lg font-black">Pagamento confirmado</p>
            </div>
          ) : isSuccessPresentation ? (
            <>
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-10 w-10" strokeWidth={2.5} aria-hidden="true" />
                <Sparkles className="absolute -right-2 -top-2 h-4 w-4 fill-emerald-300 text-emerald-50" aria-hidden="true" />
                <Sparkles className="absolute -bottom-2 -left-2 h-3.5 w-3.5 fill-emerald-200 text-emerald-50" aria-hidden="true" />
              </div>
              <span className="mt-4 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                {isSuccess ? 'Reserva confirmada' : 'Checkout concluído'}
              </span>
              <h2 className="mt-2 text-xl font-black tracking-tight text-[var(--mazzi-dark)] sm:text-2xl">
                {isSuccess ? 'Aula agendada com sucesso!' : 'Pagamento realizado com sucesso!'}
              </h2>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-[var(--mazzi-muted)] sm:text-sm">
                {isSuccess
                  ? 'O pagamento foi confirmado pela Stripe. Sua reserva já está disponível em Minhas Aulas.'
                  : 'O Checkout da Stripe foi concluído. Estamos finalizando a confirmação segura da sua reserva.'}
              </p>

              {booking && <div className="mazzi-compact-card mt-5 w-full max-w-xl rounded-2xl border border-[var(--mazzi-border)] bg-white p-4 text-left sm:p-5">
                <div className="flex items-start justify-between gap-3 border-b border-[var(--mazzi-border)] pb-3">
                  <div>
                    <p className="mazzi-field-label">Confira sua aula</p>
                    <p className="mt-1 text-base font-black text-[var(--mazzi-dark)]">Resumo da reserva</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--mazzi-yellow-hover)] px-2.5 py-1 text-[10px] font-black text-[var(--mazzi-dark)]">
                    CAT. {booking.category}
                  </span>
                </div>

                <div className="divide-y divide-[var(--mazzi-border)]">
                  <div className="flex gap-3 py-3">
                    <CalendarIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                    <div>
                      <p className="text-[11px] text-[var(--mazzi-muted)]">Data e horário</p>
                      <p className="mt-1 text-[13px] font-extrabold text-[var(--mazzi-dark)]">{scheduleDate} · {scheduleStart} às {scheduleEnd}</p>
                    </div>
                  </div>

                  <div className="flex gap-3 py-3">
                    <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                    <div>
                      <p className="text-[11px] text-[var(--mazzi-muted)]">Instrutor</p>
                      <p className="mt-1 text-[13px] font-extrabold text-[var(--mazzi-dark)]">{booking.instructorName || booking.providerName}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--mazzi-muted)]">{booking.providerName}</p>
                    </div>
                  </div>

                  <div className="flex gap-3 py-3">
                    <Car className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                    <div>
                      <p className="text-[11px] text-[var(--mazzi-muted)]">Veículo</p>
                      <p className="mt-1 text-[13px] font-extrabold text-[var(--mazzi-dark)]">{vehicleName}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--mazzi-muted)]">{booking.snapshot.transmission ? formatTransmissionLabel(booking.snapshot.transmission) : 'Transmissão não informada'}</p>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-3">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                    <div>
                      <p className="text-[11px] text-[var(--mazzi-muted)]">Ponto de encontro</p>
                      {meetingPointNotice ? (
                        <p className="mt-1 text-[13px] font-bold leading-snug text-amber-800" role="status">{meetingPointNotice}</p>
                      ) : (
                        <p className="mt-1 text-[13px] font-extrabold leading-snug text-[var(--mazzi-dark)]">{booking.fullMeetingPoint || formatMeetingPoint(booking.meetingPoint)}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>}

              {booking && mapCenter && (
                <div className="mt-4 w-full max-w-xl">
                  <p className="sr-only">Mapa da região da aula, sem marcador do endereço exato.</p>
                  <UniversalMap
                    providers={[]}
                    mapCenter={mapCenter}
                    height="200px"
                    zoom={15}
                    showMeetingPointPopup={false}
                    interactive={false}
                  />
                </div>
              )}

              <Button type="button" variant="secondary" size="md" className="mt-4 w-full max-w-md font-extrabold" onClick={() => {
                if (isInstantBooking && booking && onViewBooking) {
                  onViewBooking(booking);
                  return;
                }
                onViewBookings();
              }}>
                {isInstantBooking ? 'Ver aula' : 'Ver minhas aulas'}
              </Button>
            </>
          ) : isOffline ? (
            <>
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                <WifiOff className="h-11 w-11" aria-hidden="true" />
              </div>
              <h2 className="mt-6 text-2xl font-black tracking-tight text-[var(--mazzi-dark)]">Sem conexão com a internet</h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--mazzi-muted)]">
                Não conseguimos confirmar o pagamento agora. Você será encaminhado para Minhas Aulas para consultar o status da reserva.
              </p>
              <Button type="button" variant="secondary" size="md" className="mt-6 w-full max-w-md font-extrabold" onClick={onViewBookings}>
                Ir para minhas aulas
              </Button>
            </>
          ) : (
            <>
              <div className={`flex h-20 w-20 items-center justify-center rounded-2xl ${isCancelled ? 'bg-slate-100 text-slate-500' : 'bg-rose-50 text-rose-600'}`}>
                {isCancelled ? <ExternalLink className="h-11 w-11" aria-hidden="true" /> : <XCircle className="h-11 w-11" aria-hidden="true" />}
              </div>
              <h2 className="mt-6 text-2xl font-black tracking-tight text-[var(--mazzi-dark)]">
                {isCancelled ? 'Você cancelou o pagamento' : 'Não foi possível confirmar o pagamento'}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--mazzi-muted)]">
                {message || 'A reserva continua disponível para você tentar novamente.'}
              </p>
              <Button type="button" variant="primary" size="md" className="mt-6 w-full max-w-md font-extrabold" onClick={onBackToSearch}>
                Escolher outro horário
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  );
};
