import React, { useEffect, useMemo, useState } from 'react';
import { Car, Clock3, MapPin, Radio, Save } from 'lucide-react';
import type { Booking, InstantLessonInstructorStatus, InstantLessonOffer, InstantLessonSettings, Provider, ServiceOffering, Vehicle } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { formatCentsToBRL } from '../../../domain/money';
import { maskBRLInput } from '../../../lib/input-masks';
import { parseBrlToCents } from '../../../domain/vehicles-offerings';
import { formatInstantInstructorAvailability, isInstantInstructorAvailabilityActive, validateInstantSettings } from '../../../domain/instant-lesson';
import { InstantLessonOfferCard } from '../../../components/instant/InstantLessonOfferCard';
import { formatMeetingPoint, formatPendingPaymentMeetingPoint } from '../../../lib/meeting-point';

interface ProviderInstantLessonPanelProps {
  provider: Provider;
  offerings: ServiceOffering[];
  vehicles: Vehicle[];
  instructorOptions: Array<{ id: string; name: string }>;
  settings: InstantLessonSettings[];
  instructorStatuses: InstantLessonInstructorStatus[];
  currentUserId?: string;
  onSave: (params: { instructorId: string; vehicleId: string; instantEnabled: boolean; instantPriceInCents: number; maxDistanceKm: number }) => Promise<void>;
  onToggleOnline: (instructorId: string, online: boolean) => Promise<void>;
  isLoading?: boolean;
  offers: InstantLessonOffer[];
  pendingPaymentInstantBookings: Booking[];
  instantOffersServerNow?: string | null;
  onRespondOffer: (offerId: string, action: 'ACCEPT' | 'DECLINE') => Promise<void>;
  offerAction?: { offerId: string; action: 'ACCEPT' | 'DECLINE' } | null;
}

const distanceOptions = [1, 3, 5, 8, 10, 15, 20].map((value) => ({ value: String(value), label: `${value} km` }));

export const ProviderInstantLessonPanel: React.FC<ProviderInstantLessonPanelProps> = ({ provider, offerings, vehicles, instructorOptions, settings, instructorStatuses, currentUserId, onSave, onToggleOnline, isLoading, offers, pendingPaymentInstantBookings, instantOffersServerNow, onRespondOffer, offerAction }) => {
  const configurations = useMemo(() => {
    const activeVehicles = vehicles.filter((vehicle) => vehicle.status === 'ACTIVE');
    return instructorOptions.flatMap((instructor) => activeVehicles.map((vehicle) => ({
      id: `${instructor.id}:${vehicle.id}`,
      instructorId: instructor.id,
      instructorName: instructor.name,
      vehicleId: vehicle.id,
    })));
  }, [instructorOptions, vehicles]);
  const [drafts, setDrafts] = useState<Record<string, { enabled: boolean; price: string; distance: number }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [serverClockOffsetMs, setServerClockOffsetMs] = useState(0);
  const getInstructorStatus = (instructorId: string) => instructorStatuses.find((status) => status.providerId === provider.id && status.instructorId === instructorId);
  useEffect(() => {
    if (instantOffersServerNow) {
      setServerClockOffsetMs(new Date(instantOffersServerNow).getTime() - Date.now());
      setNow(Date.now());
    }
  }, [instantOffersServerNow]);
  const getDraft = (configuration: (typeof configurations)[number]) => {
    const setting = settings.find((item) => item.instructorId === configuration.instructorId && item.vehicleId === configuration.vehicleId);
    const agendaOffering = offerings.find((item) => item.status === 'ACTIVE' && item.instructorId === configuration.instructorId && item.vehicleId === configuration.vehicleId);
    return drafts[configuration.id] || {
      enabled: setting?.instantEnabled ?? false,
      price: setting?.instantPriceInCents ? formatCentsToBRL(setting.instantPriceInCents) : agendaOffering?.priceInCents ? formatCentsToBRL(agendaOffering.priceInCents) : '',
      distance: setting?.maxDistanceKm ?? 5,
    };
  };
  const updateDraft = (configuration: (typeof configurations)[number], patch: Partial<{ enabled: boolean; price: string; distance: number }>) => setDrafts((current) => ({ ...current, [configuration.id]: { ...getDraft(configuration), ...patch } }));
  useEffect(() => {
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
  }, []);
  const save = async (configuration: (typeof configurations)[number]) => {
    const draft = getDraft(configuration);
    let price: number;
    try {
      price = parseBrlToCents(draft.price);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Informe um valor válido para a Aula Agora.');
      return;
    }
    const validation = validateInstantSettings({ instantPriceInCents: price, maxDistanceKm: draft.distance });
    if (validation) { setError(validation); return; }
    setError(null); setSavingId(configuration.id);
    try { await onSave({ instructorId: configuration.instructorId, vehicleId: configuration.vehicleId, instantEnabled: draft.enabled, instantPriceInCents: price, maxDistanceKm: draft.distance }); }
    catch { setError('Não foi possível salvar a configuração da Aula Agora.'); }
    finally { setSavingId(null); }
  };
  return (
    <section className="space-y-4" aria-labelledby="instant-lesson-title">
      <div className="mazzi-compact-card rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)]"><Clock3 className="h-5 w-5" aria-hidden="true" /></span>
          <div><h2 id="instant-lesson-title" className="text-base font-extrabold text-[var(--mazzi-dark)]">Aula Agora</h2><p className="mt-1 text-sm font-medium text-slate-600">Defina quando você aceita aulas imediatas, o valor do seu trabalho e até onde pode se deslocar.</p></div>
        </div>
      <div className="mt-4 flex flex-wrap items-center gap-2"><Badge variant="neutral">ETA máximo 30 min</Badge><Badge variant="neutral">Oferta responde em 15 s</Badge><span className="text-xs font-semibold text-slate-600">O MAZZI não altera seu preço.</span></div>
      </div>
      <div className="flex items-center gap-1.5 px-1 text-[11px] font-semibold text-emerald-700" role="status" aria-live="polite"><Radio className="h-3.5 w-3.5" aria-hidden="true" /> <span>Atualização em tempo real</span></div>
       <section className="space-y-2" aria-labelledby="instant-instructor-availability-title"><h2 id="instant-instructor-availability-title" className="px-1 text-sm font-extrabold text-[var(--mazzi-dark)]">Disponibilidade do instrutor</h2>{instructorOptions.map((instructor) => { const instructorStatus = getInstructorStatus(instructor.id); const isOnline = instructorStatus ? isInstantInstructorAvailabilityActive(instructorStatus, now + serverClockOffsetMs) : false; const hasExpired = Boolean(instructorStatus?.instantOnline && instructorStatus.onlineExpiresAt && !isOnline); const availabilityText = instructorStatus ? formatInstantInstructorAvailability(instructorStatus, now + serverClockOffsetMs) : null; const enabledVehicleCount = settings.filter((setting) => setting.instructorId === instructor.id && setting.instantEnabled).length; const canToggle = currentUserId === instructor.id; return <div key={instructor.id} className="mazzi-compact-card flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm"><div className="min-w-0"><p className="text-sm font-extrabold text-[var(--mazzi-dark)]">{instructor.name}</p><p className="mt-0.5 text-xs font-medium text-slate-600">{hasExpired ? 'Sua disponibilidade da Aula Agora expirou. Ative novamente para receber novas solicitações.' : availabilityText || (canToggle ? 'Um único controle para aceitar Aula Agora.' : 'Disponibilidade controlada pelo próprio instrutor.')} {enabledVehicleCount === 0 && 'Habilite pelo menos um carro para ficar disponível.'}</p></div>{canToggle ? <label className={`inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-extrabold ${enabledVehicleCount > 0 && !isLoading ? 'cursor-pointer text-slate-700' : 'cursor-not-allowed text-slate-400'}`}><input type="checkbox" className="peer sr-only" checked={isOnline} disabled={enabledVehicleCount === 0 || isLoading} onChange={(event) => void onToggleOnline(instructor.id, event.target.checked)} /><span aria-hidden="true" className="relative h-6 w-11 shrink-0 rounded-full bg-slate-300 shadow-inner transition-colors after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-[var(--mazzi-yellow)] peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--mazzi-yellow)] peer-focus-visible:ring-offset-2 peer-disabled:opacity-50" /><span className="whitespace-nowrap">Aceitar Aula Agora</span></label> : <Badge variant={isOnline ? 'success' : 'neutral'}>{isOnline ? 'Disponível' : 'Offline'}</Badge>}</div>; })}</section>
      {error && <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
      {offers.length > 0 && <section className="space-y-3" aria-labelledby="instant-offers-title"><div className="flex items-center justify-between gap-3"><h2 id="instant-offers-title" className="text-base font-extrabold text-[var(--mazzi-dark)]">Solicitações recebidas</h2><Badge variant="warning">{offers.length}</Badge></div>{offers.map((offer) => <InstantLessonOfferCard key={offer.id} offer={offer} secondsLeft={Math.max(0, Math.ceil((new Date(offer.expiresAt).getTime() - (now + serverClockOffsetMs)) / 1000))} onAccept={() => void onRespondOffer(offer.id, 'ACCEPT')} onDecline={() => void onRespondOffer(offer.id, 'DECLINE')} isLoading={offerAction?.offerId === offer.id ? offerAction.action.toLowerCase() as 'accept' | 'decline' : null} />)}</section>}
      {pendingPaymentInstantBookings.length > 0 && <section className="space-y-3" aria-labelledby="instant-payment-title"><div className="flex items-center justify-between gap-3"><h2 id="instant-payment-title" className="text-base font-extrabold text-[var(--mazzi-dark)]">Pagamento do aluno</h2><Badge variant="warning">Aguardando</Badge></div>{pendingPaymentInstantBookings.map((booking) => { const meetingPoint = formatPendingPaymentMeetingPoint(booking.meetingPoint || booking.snapshot?.meetingPoint || booking.fullMeetingPoint); return <article key={booking.id} className="mazzi-compact-card rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-800"><Clock3 className="h-5 w-5" aria-hidden="true" /></span><div className="min-w-0"><h3 className="font-extrabold text-[var(--mazzi-dark)]">O aluno está finalizando o pagamento</h3><p className="mt-1 text-sm font-medium text-slate-600">A aula foi aceita e o aluno está concluindo o pagamento. Você será avisado assim que ela for confirmada.</p></div></div><div className="mazzi-compact-card mt-4 space-y-2 rounded-2xl border border-amber-200 bg-white p-3 text-sm font-semibold text-slate-700"><p><span className="text-slate-500">Aluno:</span> {booking.studentName || 'Aluno'}</p><p><span className="text-slate-500">Horário:</span> {booking.scheduledDate} · {booking.startTime} às {booking.endTime}</p><p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" /><span><span className="text-slate-500">Ponto de encontro:</span> {meetingPoint}</span></p></div><p className="mt-3 text-xs font-bold text-amber-900">Aguarde a confirmação do pagamento antes de se deslocar.</p></article>; })}</section>}
      {configurations.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><Car className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" /><p className="mt-3 font-extrabold text-slate-800">Nenhum veículo ou instrutor disponível</p><p className="mt-1 text-sm text-slate-500">Ative um veículo e um instrutor elegível para configurar a Aula Agora. Isso não altera a agenda.</p></div> : configurations.map((configuration) => {
        const draft = getDraft(configuration); const vehicle = vehicles.find((item) => item.id === configuration.vehicleId);
        const hasPrice = draft.price.trim().length > 0;
        return <article key={configuration.id} className="mazzi-compact-card rounded-2xl border border-[var(--mazzi-border)] bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><h3 className="font-extrabold text-[var(--mazzi-dark)]">{vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Veículo'}</h3><p className="mt-1 text-xs font-semibold text-slate-500">Instrutor {configuration.instructorName} · Categoria {vehicle?.category || 'B'} · {vehicle?.transmission || 'Câmbio'} · 50 min</p></div></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><Input label="Preço da Aula Agora" value={draft.price} onChange={(event) => updateDraft(configuration, { price: maskBRLInput(event.target.value) })} inputMode="decimal" placeholder="R$ 0,00" /><Select label="Distância máxima" value={String(draft.distance)} options={distanceOptions} onChange={(event) => updateDraft(configuration, { distance: Number(event.target.value) })} /></div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-sm font-extrabold text-[var(--mazzi-dark)]">Carro habilitado para Aula Agora</p><p className="mt-0.5 text-xs font-medium text-slate-600">Define se este carro pode ser oferecido quando o instrutor estiver disponível.</p></div><label aria-label={`${draft.enabled ? 'Desativar' : 'Ativar'} este carro para Aula Agora`} className={`inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-extrabold ${hasPrice ? 'cursor-pointer text-slate-700' : 'cursor-not-allowed text-slate-400'}`}><input type="checkbox" className="peer sr-only" checked={draft.enabled} disabled={!hasPrice} onChange={(event) => updateDraft(configuration, { enabled: event.target.checked })} /><span aria-hidden="true" className="relative h-6 w-11 shrink-0 rounded-full bg-slate-300 shadow-inner transition-colors after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-[var(--mazzi-yellow)] peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--mazzi-yellow)] peer-focus-visible:ring-offset-2 peer-disabled:opacity-50" /><span className="sr-only">{draft.enabled ? 'Ativo' : 'Desativado'}</span></label></div></div>
          <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3"><Button variant="outline" size="sm" disabled={!hasPrice} onClick={() => void save(configuration)} isLoading={savingId === configuration.id} leftIcon={<Save className="h-4 w-4" />}>Salvar</Button></div>
        </article>;
      })}
    </section>
  );
};
