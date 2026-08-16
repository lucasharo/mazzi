import React from 'react';
import { Calendar, Clock, MapPin, MessageSquare, CheckCircle2, Star, Car } from 'lucide-react';
import { Booking } from '../../types';
import { StatusBadge } from './StatusBadge';
import { Button } from './Button';
import { Price } from './Price';
import { formatDateBR } from '../../lib/date-format';
import { formatMeetingPoint } from '../../lib/meeting-point';

export interface BookingCardProps {
  booking: Booking;
  onCheckIn?: (booking: Booking) => void;
  onOpenChat?: (booking: Booking) => void;
  onReview?: (booking: Booking) => void;
  onViewDetails?: (booking: Booking) => void;
  isInstructorPerspective?: boolean;
  id?: string;
}

export const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  onCheckIn,
  onOpenChat,
  onReview,
  onViewDetails,
  isInstructorPerspective = false,
  id,
}) => {
  const isUpcoming = booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS';
  const isCompleted = booking.status === 'COMPLETED';

  return (
    <div
      id={id || `booking-card-${booking.id}`}
      className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs transition-all hover:border-slate-300"
    >
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span className="font-bold text-slate-900 text-sm">
              {formatDateBR(booking.scheduledDate)}
            </span>
            <span className="text-slate-400">•</span>
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-700 text-xs">
              {booking.startTime} - {booking.endTime}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isInstructorPerspective ? (
              <span>Aluno: <strong className="text-slate-800">{String(booking.studentName || '')}</strong></span>
            ) : (
              <span>Instrutor: <strong className="text-slate-800">{String(booking.instructorName || '')}</strong> ({String(booking.providerName || '')})</span>
            )}
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <div className="py-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <Car className="w-4 h-4 text-slate-400" />
          <span className="truncate">{String(booking.vehicleName || '')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-slate-400" />
          <span className="truncate">
            {formatMeetingPoint(booking.meetingPoint)}
          </span>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
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

          {isUpcoming && onCheckIn && (
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
