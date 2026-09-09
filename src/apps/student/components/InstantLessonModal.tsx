import React, { useEffect, useState } from 'react';
import type { BookingStatus, InstantLessonPriceOption, InstantLessonRequest, InstantLessonOffer, InstantLessonTracking, StudentSavedAddress, TransmissionType, VehicleCategory } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { InstantLessonWizard } from '../../../components/instant/InstantLessonWizard';
import { InstantLessonSearchingScreen } from '../../../components/instant/InstantLessonSearchingScreen';
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
  onScheduleLesson?: (location?: { address: string; coordinates: { lat: number; lng: number } }) => void;
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
  onRefreshBooking?: (bookingId: string) => Promise<Booking | null>;
  onPayBooking?: (bookingId: string) => void;
  onCancelRequest: (requestId: string) => Promise<void>;
  onCancelPendingSearch?: () => void;
  returnToPriceStep?: boolean;
  onStudentCheckIn?: (bookingId: string, location: { latitude: number; longitude: number }) => Promise<Booking>;
  isLoading?: boolean;
  isInitialLocationLoading?: boolean;
  checkInWindowBeforeMinutes?: number | null;
  instantLessonExpirationMinutes?: number;
}

export const InstantLessonModal: React.FC<InstantLessonModalProps> = ({ isOpen, onClose, onScheduleLesson, location, locationLabel, onRequestLocation, onLoadPriceOptions, onStart, activeRequest, tracking, bookingStatus, booking, currentUserId, onOpenChat, onBookingUpdated, onRefreshBooking, onPayBooking, onCancelRequest, onCancelPendingSearch, returnToPriceStep = false, onStudentCheckIn, isLoading, isInitialLocationLoading, checkInWindowBeforeMinutes, instantLessonExpirationMinutes }) => {
  const [trackingOpen, setTrackingOpen] = useState(false);
  useEffect(() => { setTrackingOpen(false); }, [isOpen, booking?.id]);
  const isLessonStarted = bookingStatus === 'IN_PROGRESS' || booking?.status === 'IN_PROGRESS' || Boolean(booking?.lessonStartedAt);
  const showTrackingMap = !isLessonStarted
    && (Boolean(tracking) || Boolean(activeRequest?.request.bookingId && bookingStatus === 'CONFIRMED'));
  if (showTrackingMap && !booking) {
    return <Modal isOpen={isOpen} onClose={onClose} title="Detalhes da aula" useHistory={false}><p role="status">Carregando informações da aula…</p></Modal>;
  }
  if (booking && bookingStatus !== 'PENDING_PAYMENT' && (isLessonStarted || (activeRequest && !trackingOpen))) {
    return <BookingDetailsModal isOpen={isOpen} onClose={onClose} booking={booking} currentUserId={currentUserId} onOpenChat={onOpenChat} onBookingUpdated={onBookingUpdated} onRefreshBooking={onRefreshBooking} onStudentCheckIn={onStudentCheckIn} useHistory={false}
      checkInWindowBeforeMinutes={checkInWindowBeforeMinutes}
      instantLessonExpirationMinutes={instantLessonExpirationMinutes}
      trackingPreview={showTrackingMap ? <InstantLessonTrackingCard request={activeRequest.request} tracking={tracking} providerName={activeRequest.offer?.providerName} onOpenTracking={() => setTrackingOpen(true)} /> : undefined} />;
  }
  const isSearching = activeRequest?.request.status === 'SEARCHING' || (!activeRequest && Boolean(isLoading));
  // Switch to the full-screen search surface as soon as the request starts,
  // before the backend response arrives, so the search state never flashes
  // inside the padded white wizard surface.
  if (activeRequest?.request.status === 'SEARCHING') {
    const cancelSearch = activeRequest?.request.status === 'SEARCHING'
      ? () => void onCancelRequest(activeRequest.request.id)
      : onCancelPendingSearch || onClose;
    return <Modal className="instant-searching" isOpen={isOpen} onClose={onClose} ariaLabel="Buscando profissionais" size="md" useHistory={false} fillContent>
      <InstantLessonSearchingScreen onCancel={cancelSearch} isCancelling={Boolean(isLoading)} />
    </Modal>;
  }
  return <Modal className={isSearching ? 'instant-searching' : !activeRequest ? 'instant-light' : ''} isOpen={isOpen} onClose={trackingOpen ? () => setTrackingOpen(false) : onClose} title={activeRequest ? (trackingOpen ? 'Acompanhamento do instrutor' : 'Aula Agora') : undefined} ariaLabel="Aula Agora" size="md" useHistory={false} showBackButton={trackingOpen} fillContent={showTrackingMap || !activeRequest}>
    {activeRequest ? <div className={showTrackingMap ? 'flex min-h-0 flex-1 flex-col gap-3 overflow-hidden' : 'space-y-4'}>
      {!showTrackingMap && <div className="shrink-0">
      <InstantLessonStatusCard request={activeRequest.request} paymentConfirmed={bookingStatus === 'CONFIRMED' || bookingStatus === 'IN_PROGRESS'} onCancel={() => void onCancelRequest(activeRequest.request.id)} isCancelling={isLoading} />
      </div>}
      {activeRequest.request.status === 'SEARCHING' && <div className="overflow-hidden rounded-2xl border border-[var(--mazzi-border)]"><UniversalMap providers={[]} meetingPoint={{ lat: activeRequest.request.meetingPoint?.latitude, lng: activeRequest.request.meetingPoint?.longitude, title: activeRequest.request.meetingPoint?.formattedAddress || 'Ponto de encontro' }} height="min(45dvh, 360px)" zoom={16} showMeetingPointPopup={false} interactive={false} /></div>}
      {!showTrackingMap && activeRequest.offer && <InstantLessonOfferCard offer={activeRequest.offer} />}
      {bookingStatus === 'PENDING_PAYMENT' && activeRequest.request.status === 'MATCHED' && activeRequest.request.bookingId && <div className="mazzi-compact-card space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-3"><p className="text-sm font-semibold text-amber-950">O profissional aceitou. Confira os dados da aula e confirme o pagamento para iniciar.</p><Button type="button" variant="primary" className="w-full font-extrabold" onClick={() => onPayBooking?.(activeRequest.request.bookingId!)} disabled={!onPayBooking || isLoading}>Confirmar pagamento</Button></div>}
      {showTrackingMap && <InstantLessonTrackingCard request={activeRequest.request} tracking={tracking} providerName={activeRequest.offer?.providerName} priceInCents={activeRequest.offer?.offeredPriceInCents} offer={activeRequest.offer} paymentConfirmed={bookingStatus === 'CONFIRMED' || bookingStatus === 'IN_PROGRESS'} />}
    </div> : <InstantLessonWizard location={location} locationLabel={locationLabel} currentUserId={currentUserId} onClose={onClose} onScheduleLesson={onScheduleLesson} onRequestLocation={onRequestLocation} onLoadPriceOptions={onLoadPriceOptions} onStart={onStart} onCancelPendingSearch={onCancelPendingSearch} returnToPriceStep={returnToPriceStep} isLoading={isLoading} isInitialLocationLoading={isInitialLocationLoading} />}
  </Modal>;
};
