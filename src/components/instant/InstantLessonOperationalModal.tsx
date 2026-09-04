import React from 'react';
import type { Booking } from '../../types';
import { ProviderBookingDetailsModal } from '../../apps/provider/components/ProviderBookingDetailsModal';

interface InstantLessonOperationalModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking;
  isWaitingPayment?: boolean;
  isOnTheWay?: boolean;
  hasArrived?: boolean;
  distanceKm?: number | null;
  etaMinutes?: number | null;
  onOpenNavigation?: () => void;
  onSetOnTheWay?: (bookingId: string) => Promise<void>;
  onCheckIn?: (booking: Booking) => void | Promise<string | void>;
  onOpenChat?: (booking: Booking) => void;
  isLoading?: boolean;
}

export const InstantLessonOperationalModal: React.FC<InstantLessonOperationalModalProps> = (props) => {
  return (
    <ProviderBookingDetailsModal
      isOpen={props.isOpen}
      onClose={props.onClose}
      booking={props.booking}
      isWaitingPayment={props.isWaitingPayment}
      isOnTheWay={props.isOnTheWay}
      hasArrived={props.hasArrived}
      distanceKm={props.distanceKm}
      etaMinutes={props.etaMinutes}
      onOpenNavigation={props.onOpenNavigation}
      onSetOnTheWay={props.onSetOnTheWay}
      onCheckIn={props.onCheckIn}
      onOpenChat={props.onOpenChat}
      isLoading={props.isLoading}
    />
  );
};
