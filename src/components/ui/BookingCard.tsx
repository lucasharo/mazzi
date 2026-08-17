import React from 'react';
import { Calendar, Clock, MapPin, MessageSquare, CheckCircle2, Star, Car, Gauge } from 'lucide-react';
import { Booking } from '../../types';
import { StatusBadge } from './StatusBadge';
import { Button } from './Button';
import { Price } from './Price';
import { formatDateBR, formatTimeBR } from '../../lib/date-format';
import { formatMeetingPoint } from '../../lib/meeting-point';

export interface BookingCardProps {
  booking: Booking;
  onCheckIn?: (booking: Booking) => void;
  onOpenChat?: (booking: Booking) => void;
  onReview?: (booking: Booking) => void;
  onViewDetails?: (booking: Booking) => void;
  isInstructorPerspective?: boolean;
  variant?: 'default' | 'student';
  id?: string;
}

const transmissionLabel = (value?: string) => value === 'AUTOMATIC' ? 'Automático' : value === 'MANUAL' ? 'Manual' : '';

export const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  onCheckIn,
  onOpenChat,
  onReview,
  onViewDetails,
  isInstructorPerspective = false,
  variant = 'default',
  id,
}) => {
  const isStudent = variant === 'student';
  const isUpcoming = booking.status === 'CONFIRMED' || booking.status === 'PENDING_PAYMENT' || booking.status === 'IN_PROGRESS';
  const isCompleted = booking.status === 'COMPLETED';
  const point = formatMeetingPoint(booking.meetingPoint || booking.snapshot?.meetingPoint);
  const vehicle = booking.vehicleName || booking.snapshot?.vehicleName;
  const transmission = transmissionLabel(booking.snapshot?.transmission);
  const instructor = booking.instructorName || booking.snapshot?.instructorName;
  const provider = booking.providerName || booking.snapshot?.providerName;
  const showProvider = Boolean(provider && provider !== instructor);
  const date = booking.scheduledStartAt ? formatDateBR(booking.scheduledStartAt) : formatDateBR(booking.scheduledDate);
  const time = booking.scheduledStartAt ? formatTimeBR(booking.scheduledStartAt) : [booking.startTime, booking.endTime].filter(Boolean).join(' – ');

  return (
    <div
      id={id || `booking-card-${booking.id}`}
      className={`mazzi-card p-5 transition ${isStudent ? 'space-y-4' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span className="font-bold text-slate-900 text-sm">
              {date}
            </span>
            <span className="text-slate-400">•</span>
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-700 text-xs">
              {time}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isInstructorPerspective ? (
              booking.studentName ? <span>Aluno: <strong className="text-slate-800">{booking.studentName}</strong></span> : null
            ) : (
              instructor ? <span><strong className="text-slate-800">{instructor}</strong></span> : null
            )}
          </p>
          {!isInstructorPerspective && showProvider && <p className="text-xs text-slate-500">{provider}</p>}
        </div>
        <StatusBadge status={booking.status} audience={isStudent ? 'student' : 'default'} />
      </div>

      <div className="mazzi-soft-card grid gap-2 px-4 py-3 text-xs text-[var(--mazzi-muted)]">
        <div className="flex items-center gap-1.5">
          <Car className="w-4 h-4 text-slate-400" />
          {vehicle && <><span className="truncate">{vehicle}</span>{transmission && <><span className="text-slate-300">•</span><Gauge className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" /><span>{transmission}</span></>}</>}
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-slate-400" />
          <span className="truncate">
            {point}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <Price cents={booking.snapshot.totalInCents} size="sm" showPeriodLabel={false} />
        
        <div className="flex items-center gap-2">
          {onOpenChat && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChat(booking)}
              leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
            >
              Chat
            </Button>
          )}

          {!isStudent && isUpcoming && onCheckIn && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onCheckIn(booking)}
              leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
            >
              {isInstructorPerspective
                ? booking.instructorCheckedIn
                  ? 'Check-in Realizado'
                  : 'Fazer Check-in'
                : booking.studentCheckedIn
                ? 'Check-in Realizado'
                : 'Fazer Check-in'}
            </Button>
          )}

          {isCompleted && onReview && !isInstructorPerspective && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onReview(booking)}
              leftIcon={<Star className="w-3.5 h-3.5" />}
            >
              Avaliar Aula
            </Button>
          )}

          {onViewDetails && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewDetails(booking)}
            >
              Detalhes
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
