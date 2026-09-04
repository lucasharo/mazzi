import React, { useEffect, useState } from 'react';
import type { BookingStatus, InstantLessonPriceOption, InstantLessonRequest, InstantLessonOffer, InstantLessonTracking, StudentSavedAddress, TransmissionType, VehicleCategory } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { InstantLessonWizard } from '../../../components/instant/InstantLessonWizard';
import { UniversalMap } from '../../../components/maps/UniversalMap';
import '../../../components/instant/instant-wizard.css';
import { InstantLessonStatusCard } from '../../../components/instant/InstantLessonStatusCard';
import { InstantLessonOfferCard } from '../../../components/instant/InstantLessonOfferCard';
import { InstantLessonTrackingCard } from '../../../components/instant/InstantLessonTrackingCard';
import type { Booking } from '../../../types';
import { BookingDetailsModal } from './BookingDetailsModal';

interface InstantLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  location?: { lat: number; lng: number };
  locationLabel: string;
  onRequestLocation: () => Promise<{ lat: number; lng: number }>;
  onLoadPriceOptions: (params: { latitude: number; longitude: number; category: VehicleCategory; transmission: TransmissionType | 'ALL' }) => Promise<InstantLessonPriceOption[]>;
  onStart: (params: { meetingPoint: StudentSavedAddress; latitude: number; longitude: number; category: VehicleCategory; transmission: TransmissionType | 'ALL'; maxPriceInCents: number | null }) => Promise<InstantLessonRequest>;
  activeRequest?: { request: InstantLessonRequest; offer?: InstantLessonOffer } | null;
  tracking?: InstantLessonTracking | null;
  bookingStatus?: BookingStatus;
  booking?: Booking;
  currentUserId?: string;
  onOpenChat?: (booking: Booking) => void;
  onBookingUpdated?: (booking: Booking) => void;
  onPayBooking?: (bookingId: string) => void;
  onCancelRequest: (requestId: string) => Promise<void>;
  isLoading?: boolean;
}

export const InstantLessonModal: React.FC<InstantLessonModalProps> = ({ isOpen, onClose, location, locationLabel, onRequestLocation, onLoadPriceOptions, onStart, activeRequest, tracking, bookingStatus, booking, currentUserId, onOpenChat, onBookingUpdated, onPayBooking, onCancelRequest, isLoading }) => {
  const [trackingOpen, setTrackingOpen] = useState(false);
  useEffect(() => { setTrackingOpen(false); }, [isOpen, booking?.id]);
  const showTrackingMap = Boolean(tracking) || Boolean(activeRequest?.request.bookingId && (bookingStatus === 'CONFIRMED' || bookingStatus === 'IN_PROGRESS'));
  if (showTrackingMap && !booking) {
    return <Modal isOpen={isOpen} onClose={onClose} title="Detalhes da aula" useHistory={false}><p role="status">Carregando informações da aula…</p></Modal>;
  }
  if (booking && activeRequest && !trackingOpen && bookingStatus !== 'PENDING_PAYMENT') {
    return <BookingDetailsModal isOpen={isOpen} onClose={onClose} booking={booking} currentUserId={currentUserId} onOpenChat={onOpenChat} onBookingUpdated={onBookingUpdated} useHistory={false}
      trackingPreview={showTrackingMap ? <InstantLessonTrackingCard request={activeRequest.request} tracking={tracking} providerName={activeRequest.offer?.providerName} onOpenTracking={() => setTrackingOpen(true)} /> : undefined} />;
  }
  return <Modal className={!activeRequest ? 'instant-light' : ''} isOpen={isOpen} onClose={() => { if (trackingOpen) setTrackingOpen(false); else onClose(); }} title={activeRequest ? (trackingOpen ? 'Acompanhamento da aula' : 'Aula Agora') : undefined} ariaLabel="Aula Agora" size="md" useHistory={false} fillContent={showTrackingMap || !activeRequest}>
    {activeRequest ? <div className={showTrackingMap ? 'flex min-h-0 flex-1 flex-col gap-3 overflow-hidden' : 'space-y-4'}>
      {!showTrackingMap && <div className="shrink-0">
      <InstantLessonStatusCard request={activeRequest.request} paymentConfirmed={bookingStatus === 'CONFIRMED' || bookingStatus === 'IN_PROGRESS'} onCancel={() => void onCancelRequest(activeRequest.request.id)} isCancelling={isLoading} />
      </div>}
      {activeRequest.request.status === 'SEARCHING' && <div className="overflow-hidden rounded-2xl border border-[var(--mazzi-border)]"><UniversalMap providers={[]} meetingPoint={{ lat: activeRequest.request.meetingPoint?.latitude, lng: activeRequest.request.meetingPoint?.longitude, title: activeRequest.request.meetingPoint?.formattedAddress || 'Ponto de encontro' }} height="min(45dvh, 360px)" zoom={16} interactive={false} /></div>}
      {!showTrackingMap && activeRequest.offer && <InstantLessonOfferCard offer={activeRequest.offer} />}
      {bookingStatus === 'PENDING_PAYMENT' && activeRequest.request.status === 'MATCHED' && activeRequest.request.bookingId && <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-3"><p className="text-sm font-semibold text-amber-950">O profissional aceitou. Confira os dados da aula e confirme o pagamento para iniciar.</p><Button type="button" variant="primary" className="w-full font-extrabold" onClick={() => onPayBooking?.(activeRequest.request.bookingId!)} disabled={!onPayBooking || isLoading}>Confirmar pagamento</Button></div>}
      {showTrackingMap && <InstantLessonTrackingCard request={activeRequest.request} tracking={tracking} providerName={activeRequest.offer?.providerName} priceInCents={activeRequest.offer?.offeredPriceInCents} offer={activeRequest.offer} paymentConfirmed={bookingStatus === 'CONFIRMED' || bookingStatus === 'IN_PROGRESS'} />}
    </div> : <InstantLessonWizard location={location} locationLabel={locationLabel} currentUserId={currentUserId} onClose={onClose} onRequestLocation={onRequestLocation} onLoadPriceOptions={onLoadPriceOptions} onStart={onStart} isLoading={isLoading} />}
  </Modal>;
};
