import React from 'react';
import { CalendarClock, ChevronRight } from 'lucide-react';
import type { Booking } from '../../types';
import { calculateLessonDurationMinutes, formatDateBR } from '../../lib/date-format';
import { isBookingInProgress } from '../../domain/booking';
import { getProviderBookingMeetingPointText, getStudentBookingMeetingPointText } from '../../lib/booking-meeting-point-display';
import { Button, ButtonBase } from './Button';

interface UpcomingBookingCardProps {
  booking: Booking;
  perspective: 'student' | 'provider';
  onSelect: (booking: Booking) => void;
  eyebrowLabel?: string | null;
}

export const UpcomingBookingCard: React.FC<UpcomingBookingCardProps> = ({ booking, perspective, onSelect, eyebrowLabel }) => {
  const isInProgress = isBookingInProgress(booking);
  const visibleEyebrowLabel = eyebrowLabel !== undefined
    ? eyebrowLabel
    : isInProgress ? 'Aula em andamento' : 'Próxima aula';
  const participantName = perspective === 'student'
    ? booking.instructorName || 'Instrutor'
    : booking.studentName || 'Aluno';
  const contextLabel = perspective === 'provider'
    ? booking.snapshot?.vehicleName || booking.vehicleName
    : undefined;
  const meetingPointText = perspective === 'student'
    ? getStudentBookingMeetingPointText(booking, 'Região da aula')
    : getProviderBookingMeetingPointText(booking);
  const duration = calculateLessonDurationMinutes(booking) || 50;
  const details = [participantName, contextLabel, `${duration} min`].filter(Boolean).join(' · ');
  const openDetails = () => onSelect(booking);

  return (
    <ButtonBase
      type="button"
      onClick={openDetails}
      className="mazzi-card flex min-h-[68px] w-full items-center justify-between gap-3.5 p-3.5 text-left transition-all hover:shadow-md active:scale-[0.99]"
      aria-label={`${visibleEyebrowLabel || 'Aula'} em ${formatDateBR(booking.scheduledDate)} às ${booking.startTime}. Toque para ver detalhes.`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)]">
          <CalendarClock className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          {visibleEyebrowLabel && <span className="mazzi-eyebrow block text-[9px] text-[#8b6800]">{visibleEyebrowLabel}</span>}
          <strong className="block truncate text-sm font-extrabold text-[var(--mazzi-dark)] sm:text-base">
            {formatDateBR(booking.scheduledDate)} · {booking.startTime}
          </strong>
          <span className="block truncate text-xs font-medium text-[var(--mazzi-muted)]">{details}</span>
          {meetingPointText && <span className="block truncate text-[11px] font-semibold text-[var(--mazzi-muted)]">{meetingPointText}</span>}
        </span>
      </span>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--mazzi-surface-soft)] text-[var(--mazzi-dark)] transition hover:bg-slate-200" aria-hidden="true">
        <ChevronRight className="h-5 w-5" />
      </span>
    </ButtonBase>
  );
};

interface UpcomingBookingEmptyCardProps {
  onViewBookings: () => void;
}

export const UpcomingBookingEmptyCard: React.FC<UpcomingBookingEmptyCardProps> = ({ onViewBookings }) => (
  <section className="mazzi-card flex min-h-[68px] w-full items-center justify-between gap-3.5 p-3.5" aria-label="Próxima aula">
    <span className="flex min-w-0 items-center gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--mazzi-surface-soft)] text-[var(--mazzi-muted)]">
        <CalendarClock className="h-5 w-5 text-[var(--mazzi-dark)]" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="mazzi-eyebrow block text-[9px] text-[var(--mazzi-muted)]">Próxima aula</span>
        <strong className="block truncate text-sm font-extrabold text-[var(--mazzi-dark)]">Nenhuma aula agendada</strong>
        <span className="block truncate text-xs font-medium text-[var(--mazzi-muted)]">Não há aulas confirmadas nos próximos horários.</span>
      </span>
    </span>
    <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={onViewBookings}>
      Ver aulas
    </Button>
  </section>
);
