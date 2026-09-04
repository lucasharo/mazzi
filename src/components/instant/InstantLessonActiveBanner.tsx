import React from 'react';
import { CalendarClock, ChevronRight, Clock3, Navigation } from 'lucide-react';
import type { Booking } from '../../types';
import { ButtonBase } from '../ui/Button';
import { formatCentsToBRL } from '../../domain/money';
import { formatMeetingPoint, formatPendingPaymentMeetingPoint } from '../../lib/meeting-point';
import { needsMeetingPointAddress } from '../../domain/maps/meeting-point-address';

export type InstantLessonOperationalState =
  | 'WAITING_PAYMENT'
  | 'CONFIRMED'
  | 'ON_THE_WAY'
  | 'IN_PROGRESS';

interface InstantLessonActiveBannerProps {
  booking: Booking;
  operationalState: InstantLessonOperationalState;
  onOpenDetails: () => void;
  distanceKm?: number | null;
  etaMinutes?: number | null;
}

export const InstantLessonActiveBanner: React.FC<InstantLessonActiveBannerProps> = ({
  booking,
  operationalState,
  onOpenDetails,
  distanceKm,
  etaMinutes,
}) => {
  const isWaitingPayment = operationalState === 'WAITING_PAYMENT';
  const isOnTheWay = operationalState === 'ON_THE_WAY';

  const meetingPointText = isWaitingPayment
    ? formatPendingPaymentMeetingPoint(booking.meetingPoint || booking.snapshot?.meetingPoint || booking.fullMeetingPoint)
    : formatMeetingPoint(booking.meetingPoint) ||
      formatMeetingPoint(booking.snapshot?.meetingPoint) ||
      (booking.fullMeetingPoint && !needsMeetingPointAddress(booking.fullMeetingPoint) ? booking.fullMeetingPoint : '') ||
      'Ponto de encontro indicado no mapa';
  const priceFormatted = formatCentsToBRL(booking.totalInCents || booking.priceInCents || 0);
  const studentName = booking.studentName || 'Aluno';

  const statusLabel = isWaitingPayment
    ? 'Próxima aula · Aguardando pagamento do aluno'
    : isOnTheWay
      ? 'Próxima aula · Você está a caminho'
      : 'Próxima aula · Pagamento Confirmado!';

  return (
    <section
      role="button"
      tabIndex={0}
      onClick={onOpenDetails}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenDetails();
        }
      }}
      aria-label={`${statusLabel} — ${studentName}. Toque para ver detalhes e ir para a aula.`}
      className="mazzi-card w-full flex items-center justify-between gap-3.5 p-3.5 sm:p-4 transition-all hover:shadow-md cursor-pointer active:scale-[0.99] bg-white border border-[var(--mazzi-border)] text-left select-none"
      data-component="instant-active-banner"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] shadow-xs">
          {isWaitingPayment ? (
            <Clock3 className="h-5 w-5 animate-pulse" aria-hidden="true" />
          ) : isOnTheWay ? (
            <Navigation className="h-5 w-5" aria-hidden="true" />
          ) : (
            <CalendarClock className="h-5 w-5" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0">
          <p className="mazzi-eyebrow text-[9px] text-[#8b6800]">
            {statusLabel}
          </p>
          <strong className="block truncate text-sm font-extrabold text-[var(--mazzi-dark)] sm:text-base">
            {studentName} · {priceFormatted}
          </strong>
          <span className="block truncate text-xs font-medium text-[var(--mazzi-muted)]">
            {distanceKm != null && etaMinutes != null
              ? `${distanceKm} km · aprox. ${etaMinutes} min · ${meetingPointText}`
              : meetingPointText}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="hidden sm:inline-block text-xs font-extrabold text-[var(--mazzi-dark)]">
          {isWaitingPayment ? 'Ver detalhes' : 'Ir para a aula'}
        </span>
        <ButtonBase
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetails();
          }}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--mazzi-surface-soft)] text-[var(--mazzi-dark)] transition hover:bg-slate-200 cursor-pointer"
          aria-label={isWaitingPayment ? 'Ver detalhes' : 'Ir para a aula'}
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </ButtonBase>
      </div>
    </section>
  );
};

