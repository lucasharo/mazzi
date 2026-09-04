import React, { useEffect, useMemo, useState } from 'react';
import { Car, Clock3, MapPin, Power, Save } from 'lucide-react';
import type { Booking, InstantLessonOffer, InstantLessonSettings, Provider, ServiceOffering, Vehicle } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { formatCentsToBRL } from '../../../domain/money';
import { maskBRLInput } from '../../../lib/input-masks';
import { parseBrlToCents } from '../../../domain/vehicles-offerings';
import { validateInstantSettings } from '../../../domain/instant-lesson';
import { InstantLessonOfferCard } from '../../../components/instant/InstantLessonOfferCard';
import { formatMeetingPoint } from '../../../lib/meeting-point';

interface ProviderInstantLessonPanelProps {
  provider: Provider;
  offerings: ServiceOffering[];
  vehicles: Vehicle[];
  settings: InstantLessonSettings[];
  onSave: (params: { offeringId: string; instantEnabled: boolean; instantPriceInCents: number; maxDistanceKm: number }) => Promise<void>;
  onToggleOnline: (setting: InstantLessonSettings, online: boolean) => Promise<void>;
  onUpdateLocation: () => Promise<void>;
  isLoading?: boolean;
  locationStatus?: 'IDLE' | 'UPDATING' | 'READY' | 'ERROR';
  offers: InstantLessonOffer[];
  pendingPaymentInstantBookings: Booking[];
  instantOffersServerNow?: string | null;
  onRespondOffer: (offerId: string, action: 'ACCEPT' | 'DECLINE') => Promise<void>;
  offerAction?: { offerId: string; action: 'ACCEPT' | 'DECLINE' } | null;
}

const distanceOptions = [1, 3, 5, 8, 10, 15, 20].map((value) => ({ value: String(value), label: `${value} km` }));

export const ProviderInstantLessonPanel: React.FC<ProviderInstantLessonPanelProps> = ({ provider, offerings, vehicles, settings, onSave, onToggleOnline, onUpdateLocation, isLoading, locationStatus = 'IDLE', offers, pendingPaymentInstantBookings, instantOffersServerNow, onRespondOffer, offerAction }) => {
  const activeOfferings = useMemo(() => offerings.filter((offering) => offering.status === 'ACTIVE'), [offerings]);
  const [drafts, setDrafts] = useState<Record<string, { enabled: boolean; price: string; distance: number }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [serverClockOffsetMs, setServerClockOffsetMs] = useState(0);
  useEffect(() => {
    if (instantOffersServerNow) {
      setServerClockOffsetMs(new Date(instantOffersServerNow).getTime() - Date.now());
      setNow(Date.now());
    }
  }, [instantOffersServerNow]);
  const getDraft = (offering: ServiceOffering) => {
    const setting = settings.find((item) => item.offeringId === offering.id);
    return drafts[offering.id] || {
      enabled: setting?.instantEnabled ?? false,
      price: setting?.instantPriceInCents ? formatCentsToBRL(setting.instantPriceInCents) : formatCentsToBRL(offering.priceInCents),
      distance: setting?.maxDistanceKm ?? 5,
    };
  };
  const updateDraft = (offeringId: string, patch: Partial<{ enabled: boolean; price: string; distance: number }>) => setDrafts((current) => ({ ...current, [offeringId]: { ...getDraft(offerings.find((item) => item.id === offeringId)!), ...patch } }));
  useEffect(() => {
    if (!offers.length) return undefined;
    const syncNow = () => setNow(Date.now());
    const timer = window.setInterval(syncNow, 1000);
    document.addEventListener('visibilitychange', syncNow);
    window.addEventListener('focus', syncNow);
    syncNow();
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', syncNow);
      window.removeEventListener('focus', syncNow);
    };
  }, [offers.length]);
  const save = async (offering: ServiceOffering) => {
    const draft = getDraft(offering);
    const price = parseBrlToCents(draft.price);
    const validation = validateInstantSettings({ instantPriceInCents: price, maxDistanceKm: draft.distance });
    if (validation) { setError(validation); return; }
    setError(null); setSavingId(offering.id);
    try { await onSave({ offeringId: offering.id, instantEnabled: draft.enabled, instantPriceInCents: price, maxDistanceKm: draft.distance }); }
    catch { setError('Não foi possível salvar a configuração da Aula Agora.'); }
    finally { setSavingId(null); }
  };
  return (
    <section className="space-y-4" aria-labelledby="instant-lesson-title">
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)]"><Clock3 className="h-5 w-5" aria-hidden="true" /></span>
          <div><h2 id="instant-lesson-title" className="text-base font-extrabold text-[var(--mazzi-dark)]">Aula Agora</h2><p className="mt-1 text-sm font-medium text-slate-600">Defina quando você aceita aulas imediatas, o valor do seu trabalho e até onde pode se deslocar.</p></div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2"><Badge variant="neutral">ETA máximo 30 min</Badge><Badge variant="neutral">Oferta responde em 15 s</Badge><span className="text-xs font-semibold text-slate-600">O MAZZI não altera seu preço.</span></div>
      </div>
      {locationStatus !== 'READY' && <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600"><span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-amber-600" aria-hidden="true" />{locationStatus === 'ERROR' ? 'Não foi possível atualizar sua localização.' : 'Atualize sua localização para receber solicitações.'}</span><Button variant="outline" size="sm" onClick={() => void onUpdateLocation()} isLoading={locationStatus === 'UPDATING'}>Atualizar</Button></div>}
      {error && <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
      {offers.length > 0 && <section className="space-y-3" aria-labelledby="instant-offers-title"><div className="flex items-center justify-between gap-3"><h2 id="instant-offers-title" className="text-base font-extrabold text-[var(--mazzi-dark)]">Solicitações recebidas</h2><Badge variant="warning">{offers.length}</Badge></div>{offers.map((offer) => <InstantLessonOfferCard key={offer.id} offer={offer} secondsLeft={Math.max(0, Math.ceil((new Date(offer.expiresAt).getTime() - (now + serverClockOffsetMs)) / 1000))} onAccept={() => void onRespondOffer(offer.id, 'ACCEPT')} onDecline={() => void onRespondOffer(offer.id, 'DECLINE')} isLoading={offerAction?.offerId === offer.id ? offerAction.action.toLowerCase() as 'accept' | 'decline' : null} />)}</section>}
      {pendingPaymentInstantBookings.length > 0 && <section className="space-y-3" aria-labelledby="instant-payment-title"><div className="flex items-center justify-between gap-3"><h2 id="instant-payment-title" className="text-base font-extrabold text-[var(--mazzi-dark)]">Pagamento do aluno</h2><Badge variant="warning">Aguardando</Badge></div>{pendingPaymentInstantBookings.map((booking) => { const meetingPoint = formatMeetingPoint(booking.meetingPoint || booking.snapshot?.meetingPoint) || booking.fullMeetingPoint || 'Ponto de encontro não informado'; return <article key={booking.id} className="rounded-3xl border border-amber-200 bg-amber-50 p-4 shadow-sm"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-800"><Clock3 className="h-5 w-5" aria-hidden="true" /></span><div className="min-w-0"><h3 className="font-extrabold text-[var(--mazzi-dark)]">O aluno está finalizando o pagamento</h3><p className="mt-1 text-sm font-medium text-slate-600">A aula foi aceita e o aluno está concluindo o pagamento. Você será avisado assim que ela for confirmada.</p></div></div><div className="mt-4 space-y-2 rounded-2xl border border-amber-200 bg-white p-3 text-sm font-semibold text-slate-700"><p><span className="text-slate-500">Aluno:</span> {booking.studentName || 'Aluno'}</p><p><span className="text-slate-500">Horário:</span> {booking.scheduledDate} · {booking.startTime} às {booking.endTime}</p><p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" /><span><span className="text-slate-500">Ponto de encontro:</span> {meetingPoint}</span></p></div><p className="mt-3 text-xs font-bold text-amber-900">Aguarde a confirmação do pagamento antes de se deslocar.</p></article>; })}</section>}
      {activeOfferings.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center"><Car className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" /><p className="mt-3 font-extrabold text-slate-800">Cadastre uma oferta ativa primeiro</p><p className="mt-1 text-sm text-slate-500">A Aula Agora usa a mesma oferta, veículo e instrutor da sua agenda.</p></div> : activeOfferings.map((offering) => {
        const draft = getDraft(offering); const setting = settings.find((item) => item.offeringId === offering.id); const vehicle = vehicles.find((item) => item.id === offering.vehicleId);
        return <article key={offering.id} className="rounded-3xl border border-[var(--mazzi-border)] bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><h3 className="font-extrabold text-[var(--mazzi-dark)]">{vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Oferta de aula'}</h3><p className="mt-1 text-xs font-semibold text-slate-500">Categoria {offering.category} · {vehicle?.transmission || offering.transmission || 'Câmbio'} · {offering.durationMinutes} min</p></div><Badge variant={draft.enabled ? 'success' : 'neutral'}>{draft.enabled ? 'Ativa' : 'Desativada'}</Badge></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><Input label="Preço da Aula Agora" value={draft.price} onChange={(event) => updateDraft(offering.id, { price: maskBRLInput(event.target.value) })} inputMode="decimal" placeholder="R$ 0,00" /><Select label="Distância máxima" value={String(draft.distance)} options={distanceOptions} onChange={(event) => updateDraft(offering.id, { distance: Number(event.target.value) })} /></div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3"><label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-extrabold text-slate-700"><input type="checkbox" className="h-4 w-4 accent-amber-500" checked={draft.enabled} onChange={(event) => updateDraft(offering.id, { enabled: event.target.checked })} /> Aceitar Aula Agora</label><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void save(offering)} isLoading={savingId === offering.id} leftIcon={<Save className="h-4 w-4" />}>Salvar</Button>{setting?.instantEnabled && <Button variant={setting.instantOnline ? 'secondary' : 'outline'} size="sm" onClick={() => void onToggleOnline(setting, !setting.instantOnline)} isLoading={isLoading} leftIcon={<Power className="h-4 w-4" />}>{setting.instantOnline ? 'Disponível' : 'Ficar disponível'}</Button>}</div></div>
        </article>;
      })}
    </section>
  );
};
