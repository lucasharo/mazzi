import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Booking } from '../../types';
import { BottomSheet } from '../ui/BottomSheet';
import { UpcomingBookingCard } from '../ui/UpcomingBookingCard';
import { IconButton } from '../ui/IconButton';

interface StaleConfirmedBookingsModalProps {
  isOpen: boolean;
  audience: 'student' | 'provider';
  bookings: Booking[];
  onClose: () => void;
  onOpenBooking: (booking: Booking) => void;
}

export const StaleConfirmedBookingsModal: React.FC<StaleConfirmedBookingsModalProps> = ({
  isOpen,
  audience,
  bookings,
  onClose,
  onOpenBooking,
}) => {
  const title = audience === 'provider' ? 'Aulas pendentes de encerramento' : 'Você tem aulas pendentes';
  const description = audience === 'provider'
    ? 'Estas aulas passaram do horário previsto e ainda não foram encerradas. Confira cada detalhe para registrar o que aconteceu.'
    : 'Estas aulas passaram do horário previsto e ainda não foram encerradas. Abra os detalhes para conferir cada uma.';

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={title}
      id={`stale-confirmed-bookings-${audience}`}
      closeOnBackdrop={false}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-xs font-semibold leading-relaxed">{description}</p>
        </div>

        <div className="space-y-2" aria-label="Aulas pendentes de encerramento">
          {bookings.map((booking) => {
            return (
              <UpcomingBookingCard
                key={booking.id}
                booking={booking}
                perspective={audience}
                onSelect={onOpenBooking}
                eyebrowLabel={null}
              />
            );
          })}
        </div>

        <div className="flex justify-center pt-1">
          <IconButton
            type="button"
            label="Fechar aulas pendentes"
            onClick={onClose}
            className="h-11 w-11 rounded-full bg-[var(--mazzi-dark)] text-white shadow-sm transition-colors hover:bg-black focus-visible:ring-2 focus-visible:ring-[var(--mazzi-focus-glow)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </IconButton>
        </div>
      </div>
    </BottomSheet>
  );
};
