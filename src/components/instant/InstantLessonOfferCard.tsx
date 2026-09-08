import React from 'react';
import { Car, Check, CircleX, Clock3, MapPin } from 'lucide-react';
import type { InstantLessonOffer } from '../../types';
import { formatCentsToBRL } from '../../domain/money';
import { formatTransmissionLabel } from '../../lib/date-format';
import { Button } from '../ui/Button';
import { CountdownTimer } from '../ui/CountdownTimer';
import { formatInstantStatus } from '../../domain/instant-lesson';

interface InstantLessonOfferCardProps {
  offer: InstantLessonOffer;
  secondsLeft?: number;
  onAccept?: () => void;
  onDecline?: () => void;
  isLoading?: 'accept' | 'decline' | null;
}

export const InstantLessonOfferCard: React.FC<InstantLessonOfferCardProps> = ({ offer, secondsLeft, onAccept, onDecline, isLoading }) => {
  // The backend is authoritative for the offer deadline. The local countdown
  // is informative only because a backgrounded tab can pause its timers and
  // incorrectly disable a still-pending offer.
  const actionable = offer.status === 'PENDING';
  return (
    <article className="mazzi-compact-card rounded-2xl border border-[var(--mazzi-border)] bg-white p-4 shadow-sm" aria-label={`Oferta de Aula Agora de ${offer.providerName || 'profissional'}`}>
      {secondsLeft != null && actionable && (
        <CountdownTimer secondsRemaining={secondsLeft} className="mb-3" />
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mazzi-eyebrow text-[9px] text-amber-700">Aula Agora</p>
          <h3 className="mt-1 text-base font-extrabold text-[var(--mazzi-dark)]">{offer.providerName || 'Nova solicitação'}</h3>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-semibold text-slate-600">
        <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-amber-600" aria-hidden="true" />{Math.max(0.1, offer.distanceMeters / 1000).toFixed(1).replace('.', ',')} km</span>
        <span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-amber-600" aria-hidden="true" />até {offer.etaMinutes} min</span>
        <span className="flex items-center gap-2"><Car className="h-4 w-4 text-amber-600" aria-hidden="true" />{formatTransmissionLabel(offer.transmission)}</span>
        <strong className="text-right text-sm text-[var(--mazzi-dark)]">{formatCentsToBRL(offer.offeredPriceInCents)}</strong>
      </div>
      <p className="mt-3 text-xs font-semibold text-slate-500">{formatInstantStatus(offer.status)} · {offer.durationMinutes} min</p>
      {onAccept && onDecline && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" size="sm" leftIcon={<Check className="h-4 w-4" />} onClick={onAccept} isLoading={isLoading === 'accept'} disabled={!actionable}>Aceitar</Button>
          <Button variant="dangerSoft" size="sm" leftIcon={<CircleX className="h-4 w-4" aria-hidden="true" />} onClick={onDecline} isLoading={isLoading === 'decline'} disabled={!actionable}>Recusar</Button>
        </div>
      )}
    </article>
  );
};
