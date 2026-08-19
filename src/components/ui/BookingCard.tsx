import React from 'react';
import { Booking } from '../../types';
import { formatDateBR, formatTimeRange } from '../../lib/date-format';
import { formatMeetingPoint } from '../../lib/meeting-point';
import { formatCentsToBRL } from '../../domain/money';
import { Button, PrimaryButton, SecondaryButton } from './Button';
import {
  Calendar,
  Clock,
  Car,
  ClipboardList,
  MapPin,
  CheckCircle2,
  AlertCircle,
  XCircle,
  MessageSquare,
  Star,
} from 'lucide-react';

import { StatusBadge } from './StatusBadge';

export type BookingPerspective = 'STUDENT' | 'INSTRUCTOR';

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'M'
  );
}

function formatVehicleLabel(vehicle: {
  brand?: string;
  model?: string;
  year?: number | string;
  plate?: string;
  licensePlate?: string;
}): string {
  const parts = [vehicle.brand, vehicle.model].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Veículo';
}

export interface BookingCardProps {
  booking: Booking;
  perspective?: BookingPerspective;
  variant?: 'default' | 'student' | 'instructor';
  onCheckIn?: (booking: Booking) => void;
  onOpenChat?: (booking: Booking) => void;
  onViewDetails?: (booking: Booking) => void;
  onReview?: (booking: Booking) => void;
}

export const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  perspective = 'STUDENT',
  variant,
  onCheckIn,
  onOpenChat,
  onViewDetails,
  onReview,
}) => {
  const isInstructorPerspective = variant === 'instructor' || perspective === 'INSTRUCTOR';
  const isStudent = !isInstructorPerspective;
  const isPending = booking.status === 'PENDING_PAYMENT';
  const isConfirmed = booking.status === 'CONFIRMED';
  const isInProgress = booking.status === 'IN_PROGRESS';
  const isCompleted = booking.status === 'COMPLETED';
  const isCancelled = booking.status === 'CANCELLED';
  const isUpcoming = isConfirmed || isInProgress;

  const vehicle =
    (booking.vehicle ? formatVehicleLabel(booking.vehicle) : undefined) ||
    booking.vehicleTitle ||
    booking.snapshot?.vehicleName ||
    'Veículo não informado';

  const instructor = booking.instructorName || booking.instructor?.name || 'Instrutor';
  const provider = booking.providerName || booking.provider?.name || 'Autoescola';
  const student = booking.studentName || booking.student?.name || 'Aluno';
  const point = formatMeetingPoint(booking.meetingPoint) || 'Ponto de encontro a combinar';
  const transLabel = booking.snapshot?.transmission === 'AUTOMATIC' ? 'Automático' : 'Manual';
  const category = booking.snapshot?.category || 'B';
  const duration = booking.snapshot?.durationMinutes || 50;
  const totalInCents =
    booking.snapshot?.totalInCents || booking.totalInCents || booking.priceInCents || 0;

  // Single name display: show instructor name (or student name if in instructor perspective) exactly once
  const mainDisplayName = isInstructorPerspective ? student : instructor;

  return (
    <article
      id={`booking-card-${booking.id}`}
      aria-label={`Aula com ${mainDisplayName}, ${formatDateBR(booking.scheduledDate)}`}
      className="mazzi-card p-4 sm:p-5 transition-all duration-200 text-left space-y-3.5 hover:shadow-md"
    >
      {/* 1. HERO: Prominent Date, Time & Status in Evidence */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-[var(--mazzi-border)]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--mazzi-yellow-soft)] text-[var(--mazzi-dark)] border border-amber-200/60 shadow-2xs">
            <Calendar className="h-5 w-5 text-amber-600" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm sm:text-base font-extrabold text-[var(--mazzi-dark)] leading-tight truncate">
              {formatDateBR(booking.scheduledDate)}
            </p>
            <p className="text-xs font-bold text-amber-600 flex items-center gap-1 mt-0.5">
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{formatTimeRange(booking.startTime, booking.endTime)}</span>
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="shrink-0">
          <StatusBadge status={booking.status} audience={isStudent ? 'student' : 'default'} />
        </div>
      </div>

      {/* 2. Provider / Person Info (Render name ONLY ONCE) */}
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="mazzi-avatar h-12 w-12 shrink-0 text-sm font-bold shadow-xs ring-1 ring-black/5">
          <span
            className="flex h-full w-full items-center justify-center bg-[var(--mazzi-surface-soft)] text-[var(--mazzi-dark)]"
            aria-hidden="true"
          >
            {getInitials(mainDisplayName)}
          </span>
        </div>

        {/* Info: Name once + optional Autoescola tag + Location */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h2 className="text-sm sm:text-base font-bold text-[var(--mazzi-dark)] leading-snug break-words">
              {mainDisplayName}
            </h2>
          </div>

          <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-slate-500 truncate">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
            <span className="truncate">{point}</span>
          </p>
        </div>
      </div>

      {/* 3. Vehicle & Transmission Soft Card (Aligned with ProviderResultCard) */}
      <div className="mazzi-soft-card flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[var(--mazzi-dark)] border border-[var(--mazzi-border)]">
        <Car className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        <span className="truncate">{vehicle}</span>
        <span className="shrink-0 text-[var(--mazzi-muted)] font-medium">· {transLabel}</span>
        <span className="ml-auto shrink-0 text-[10px] font-bold uppercase bg-[var(--mazzi-yellow-soft)] text-[var(--mazzi-dark)] px-2 py-0.5 rounded-md">
          Cat. {category}
        </span>
      </div>

      {/* 4. Pricing & Action Buttons Footer */}
      <div className="mt-3.5 pt-3 border-t border-[var(--mazzi-border)] flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
            Valor total
          </p>
          <p className="mt-0.5 text-base sm:text-lg font-bold text-[var(--mazzi-dark)]">
            {formatCentsToBRL(totalInCents)}
            {duration ? (
              <span className="ml-1 text-xs font-normal text-slate-500">· {duration} min</span>
            ) : null}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onOpenChat && (
            <SecondaryButton
              type="button"
              size="sm"
              className="min-h-11 px-3.5 text-xs font-bold shadow-2xs"
              onClick={() => onOpenChat(booking)}
              leftIcon={<MessageSquare className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />}
              aria-label="Abrir chat da reserva"
            >
              Chat
            </SecondaryButton>
          )}

          {!isStudent && isUpcoming && onCheckIn && (
            <PrimaryButton
              type="button"
              size="sm"
              className="min-h-11 px-4 text-xs font-bold shadow-xs"
              onClick={() => onCheckIn(booking)}
              leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-current" aria-hidden="true" />}
              aria-label={
                isInstructorPerspective
                  ? booking.instructorCheckedIn
                    ? 'Check-in já realizado pelo instrutor'
                    : 'Fazer Check-in como instrutor'
                  : booking.studentCheckedIn
                  ? 'Check-in já realizado pelo aluno'
                  : 'Fazer Check-in como aluno'
              }
            >
              {isInstructorPerspective
                ? booking.instructorCheckedIn
                  ? 'Check-in Realizado'
                  : 'Fazer Check-in'
                : booking.studentCheckedIn
                ? 'Check-in Realizado'
                : 'Fazer Check-in'}
            </PrimaryButton>
          )}

          {isCompleted && onReview && !isInstructorPerspective && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="min-h-11 px-3.5 text-xs font-bold"
              onClick={() => onReview(booking)}
              leftIcon={<Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" aria-hidden="true" />}
              aria-label="Avaliar esta aula concluída"
            >
              Avaliar Aula
            </Button>
          )}

          {onViewDetails && (
            <PrimaryButton
              type="button"
              size="sm"
              className="min-h-11 px-4 text-xs font-bold shadow-xs"
              onClick={() => onViewDetails(booking)}
              leftIcon={<ClipboardList className="h-4 w-4 shrink-0" aria-hidden="true" />}
              aria-label="Ver detalhes completos da reserva"
            >
              Detalhes
            </PrimaryButton>
          )}
        </div>
      </div>
    </article>
  );
};
