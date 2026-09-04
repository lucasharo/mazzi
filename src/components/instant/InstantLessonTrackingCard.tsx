import React, { useEffect, useState } from 'react';
import { CheckCircle2, MapPin, Navigation } from 'lucide-react';
import type { InstantLessonOffer, InstantLessonRequest, InstantLessonTracking, Provider } from '../../types';
import { UniversalMap } from '../maps/UniversalMap';
import { formatCentsToBRL } from '../../domain/money';
import { formatTransmissionLabel } from '../../lib/date-format';
import { ButtonBase } from '../ui/Button';
import { needsMeetingPointAddress, resolveMeetingPointAddress } from '../../domain/maps/meeting-point-address';

interface InstantLessonTrackingCardProps {
  request: InstantLessonRequest;
  tracking?: InstantLessonTracking | null;
  providerName?: string;
  priceInCents?: number;
  offer?: InstantLessonOffer;
  paymentConfirmed?: boolean;
  onOpenTracking?: () => void;
}

/** Uses the canonical Leaflet map only after the backend authorizes a matched booking. */
export const InstantLessonTrackingCard: React.FC<InstantLessonTrackingCardProps> = ({ request, tracking, providerName = 'Seu profissional', priceInCents = 1, offer, paymentConfirmed, onOpenTracking }) => {
  const { latitude, longitude, formattedAddress } = request.meetingPoint;
  const addressKey = `${latitude},${longitude}`;
  const [resolvedAddress, setResolvedAddress] = useState<{ key: string; text: string } | null>(null);
  const needsAddress = needsMeetingPointAddress(formattedAddress);
  useEffect(() => {
    if (!needsAddress || latitude == null || longitude == null) return;
    let cancelled = false;
    void resolveMeetingPointAddress(latitude, longitude)
      .then(text => { if (!cancelled) setResolvedAddress({ key: addressKey, text }); })
      .catch(() => { if (!cancelled) setResolvedAddress({ key: addressKey, text: 'Endereço indisponível. Consulte o ponto indicado no mapa.' }); });
    return () => { cancelled = true; };
  }, [needsAddress, latitude, longitude, addressKey]);
  const meetingAddress = needsAddress
    ? resolvedAddress?.key === addressKey ? resolvedAddress.text : 'Buscando endereço do ponto de encontro…'
    : formattedAddress;
  const provider: Provider | null = tracking ? {
    id: 'instant-match', name: providerName, type: 'INSTRUCTOR', status: 'ACTIVE', ratingAverage: 0, ratingCount: 0,
    neighborhood: '', city: '', categories: [request.category], transmissions: request.transmission === 'ALL' ? [] : [request.transmission],
    startingPriceInCents: priceInCents, isVerified: false, latitude: tracking.latitude, longitude: tracking.longitude,
  } : null;
  const meetingPoint = request.meetingPoint.latitude != null && request.meetingPoint.longitude != null
    ? { lat: request.meetingPoint.latitude, lng: request.meetingPoint.longitude, title: meetingAddress }
    : undefined;

  return (
    <section className={`flex min-h-0 ${onOpenTracking ? 'shrink-0' : 'flex-1'} flex-col overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-sm`} aria-labelledby="instant-tracking-title">
      <div className="flex shrink-0 items-center gap-3 p-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Navigation className="h-5 w-5" aria-hidden="true" /></span>
        <div className="min-w-0"><h3 id="instant-tracking-title" className="font-extrabold text-[var(--mazzi-dark)]">{tracking ? 'Profissional a caminho' : 'Aguardando localização do profissional'}</h3><p className="mt-1 text-xs font-semibold text-slate-500">{tracking ? `Última atualização: ${new Date(tracking.recordedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'O mapa será atualizado quando o sinal de GPS retornar.'}</p></div>
      </div>
      <div className={`relative overflow-hidden ${onOpenTracking ? 'h-48' : 'min-h-0 flex-1'}`}>
        <UniversalMap className="h-full !space-y-0" providers={provider ? [provider] : []} selectedProvider={provider} meetingPoint={meetingPoint} height="100%" zoom={17} providerMarker="vehicle" followSelectedProvider showCoverageRadius={false} interactive={!onOpenTracking} />
        {onOpenTracking && <ButtonBase type="button" onClick={onOpenTracking} aria-label="Abrir acompanhamento do profissional" className="absolute inset-x-0 top-0 bottom-6 z-[1000] flex items-end justify-center pb-3 focus-visible:outline-2 focus-visible:outline-amber-500"><span className="rounded-full bg-[var(--mazzi-dark)] px-4 py-2 text-sm font-bold text-white shadow-md">Acompanhar profissional</span></ButtonBase>}
      </div>
      {!onOpenTracking && <div className="relative z-10 shrink-0 rounded-t-3xl border-t border-slate-100 bg-white px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]" aria-label="Informações da aula">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500">Sua aula • Categoria {request.category}</p>
            <h3 className="mt-1 text-sm font-extrabold text-[var(--mazzi-dark)]">{providerName}</h3>
          </div>
          {offer && <strong className="shrink-0 text-base font-extrabold text-[var(--mazzi-dark)]">{formatCentsToBRL(offer.offeredPriceInCents)}</strong>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-600">
          {offer && <span>{offer.durationMinutes} min · {formatTransmissionLabel(offer.transmission)}</span>}
          {paymentConfirmed && <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />Pagamento confirmado</span>}
        </div>
        <p className="mt-2 flex items-start gap-2 text-xs text-slate-600"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" /><span className="min-w-0 break-words">{meetingAddress}</span></p>
      </div>}
    </section>
  );
};
