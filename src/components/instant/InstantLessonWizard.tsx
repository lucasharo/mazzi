import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, LoaderCircle, Navigation, MapPin, Settings2, Shuffle, X, RefreshCw } from 'lucide-react';
import { EnvironmentBadge } from '../ui/EnvironmentBadge';
import { IconButton } from '../ui/IconButton';
import { WizardActionFooter } from '../ui/WizardActionFooter';
import { Button, ButtonBase } from '../ui/Button';
import { ConfirmableAddressAutocomplete } from '../search/ConfirmableAddressAutocomplete';
import { UniversalMap } from '../maps/UniversalMap';
import { InstantLessonPriceSelector } from './InstantLessonPriceSelector';
import { instantOptionClassName } from './instant-option-style';
import { resolveMeetingPointAddress } from '../../domain/maps/meeting-point-address';
import type { InstantLessonPriceOption, InstantLessonRequest, StudentSavedAddress, TransmissionType, VehicleCategory } from '../../types';

type Transmission = TransmissionType | 'ALL';
interface Props {
  location?: { lat: number; lng: number };
  locationLabel: string;
  currentUserId?: string;
  onClose: () => void;
  onRequestLocation: () => Promise<{ lat: number; lng: number }>;
  onLoadPriceOptions: (params: { latitude: number; longitude: number; category: VehicleCategory; transmission: Transmission }) => Promise<InstantLessonPriceOption[]>;
  onStart: (params: { meetingPoint: StudentSavedAddress; latitude: number; longitude: number; category: VehicleCategory; transmission: Transmission; maxPriceInCents: number | null }) => Promise<InstantLessonRequest>;
  isLoading?: boolean;
}
type Draft = { step: number; address: string; location?: { lat: number; lng: number }; transmission: Transmission; maxPrice: number | null; priceChosen: boolean };
const labels = ['Endereço', 'Câmbio', 'Valor'];
const headings = ['Onde será a aula?', 'Qual câmbio você prefere?', 'Quanto você aceita pagar?'];
function validLocation(value?: { lat: number; lng: number }) {
  return !!value && Number.isFinite(value.lat) && Number.isFinite(value.lng) && Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180;
}
function restore(key: string | undefined, fallback: Draft): Draft {
  if (!key) return fallback;
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || 'null');
    // Read the address from legacy drafts, never restore their step or filters.
    const d = saved?.version === 2 ? saved : saved?.draft;
    if (d && typeof d.address === 'string' && d.address.trim() && validLocation(d.location)) {
      return { ...fallback, address: d.address, location: d.location };
    }
  } catch { /* Storage can be unavailable in private browsing. */ }
  return fallback;
}

export function InstantLessonWizard({ location, locationLabel, currentUserId, onClose, onRequestLocation, onLoadPriceOptions, onStart, isLoading }: Props) {
  const storageKey = currentUserId ? `mazzi:instant-wizard:${currentUserId}` : undefined;
  const [draft, setDraft] = useState<Draft>(() => restore(storageKey, { step: 0, address: locationLabel, location: validLocation(location) ? location : undefined, transmission: 'ALL', maxPrice: null, priceChosen: false }));
  const [options, setOptions] = useState<InstantLessonPriceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const submitLock = useRef(false);
  const locationVersion = useRef(0);
  const mounted = useRef(true);
  const heading = useRef<HTMLHeadingElement>(null);
  const priceLoader = useRef(onLoadPriceOptions);
  priceLoader.current = onLoadPriceOptions;
  // Cache only this form's latest lookup. Back/forward and StrictMode share the promise.
  const lookup = useRef<{ key: string; promise: Promise<InstantLessonPriceOption[]> } | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { heading.current?.focus(); }, [draft.step]);
  useEffect(() => {
    if (!storageKey || !validLocation(draft.location) || !draft.address.trim()) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify({ version: 2, address: draft.address, location: draft.location })); } catch { /* Keep working without storage. */ }
  }, [draft.address, draft.location, storageKey]);
  useEffect(() => {
    if (draft.step !== 2 || !validLocation(draft.location)) return;
    let cancelled = false;
    const { lat, lng } = draft.location!;
    const key = `${lat}:${lng}:${draft.transmission}:${retry}`;
    setLoading(true); setError(null);
    if (lookup.current?.key !== key) lookup.current = { key, promise: Promise.resolve().then(() => priceLoader.current({ latitude: lat, longitude: lng, category: 'B', transmission: draft.transmission })) };
    void lookup.current.promise.then(data => {
      if (cancelled) return;
      setOptions(data.filter(o => Number.isInteger(o.eligibleProviderCount) && o.eligibleProviderCount >= 0 && (o.maxPriceInCents === null || (Number.isInteger(o.maxPriceInCents) && o.maxPriceInCents > 0))));
    }).catch(() => { if (!cancelled) { setOptions([]); setError('Não foi possível consultar os valores. Tente novamente.'); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [draft.step, draft.location?.lat, draft.location?.lng, draft.transmission, retry]);

  const busy = submitting || isLoading || locating;
  const addressValid = validLocation(draft.location) && Boolean(draft.address.trim());
  const available = options.some(o => o.eligibleProviderCount > 0);
  const selected = options.find(o => o.maxPriceInCents === draft.maxPrice);
  const canStart = addressValid && draft.priceChosen && selected && selected.eligibleProviderCount > 0 && !loading && !busy;
  const updateAddress = (address: string, next?: { lat: number; lng: number }) => {
    locationVersion.current += 1;
    setLocating(false); setOptions([]); setError(null);
    setDraft(d => ({ ...d, address, location: validLocation(next) ? next : undefined, priceChosen: false }));
  };
  const locate = async () => {
    const version = ++locationVersion.current;
    setLocating(true); setError(null);
    try {
      const next = await onRequestLocation();
      if (!validLocation(next)) throw new Error('INVALID_LOCATION');
      const address = await resolveMeetingPointAddress(next.lat, next.lng);
      if (mounted.current && version === locationVersion.current) updateAddress(address, next);
    } catch {
      if (mounted.current && version === locationVersion.current) setError('Não foi possível confirmar sua localização. Pesquise o endereço para continuar.');
    } finally { if (mounted.current && version === locationVersion.current) setLocating(false); }
  };
  const start = async () => {
    if (!canStart || submitLock.current || !draft.location) return;
    submitLock.current = true; setSubmitting(true); setError(null);
    try {
      const result = await onStart({ category: 'B', transmission: draft.transmission, maxPriceInCents: draft.maxPrice,
        latitude: draft.location.lat, longitude: draft.location.lng,
        meetingPoint: { formattedAddress: draft.address.trim(), latitude: draft.location.lat, longitude: draft.location.lng } });
      if (result.status === 'FAILED' || result.status === 'EXPIRED') throw new Error('INSTANT_NO_PROFESSIONAL_AVAILABLE');
    } catch (e) {
      if (mounted.current) setError(e instanceof Error && e.message === 'INSTANT_NO_PROFESSIONAL_AVAILABLE'
        ? 'Nenhum profissional está disponível com esses critérios agora. Atualize os valores ou tente novamente.'
        : 'Não foi possível iniciar a busca. Tente novamente.');
    } finally { submitLock.current = false; if (mounted.current) setSubmitting(false); }
  };
  const back = () => { setError(null); setDraft(d => ({ ...d, step: Math.max(0, d.step - 1) })); };

  return <div className="flex min-h-0 flex-1 flex-col bg-white text-slate-950" data-component="instant-lesson-wizard">
    <div className="mb-6 flex shrink-0 items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2"><img src="/brand/mazzi-mark-transparent.png" alt="" className="h-8 w-8 object-contain" /><span className="text-2xl font-extrabold tracking-tight">MAZZI</span></div>
      <div className="flex shrink-0 items-center gap-2">
        <EnvironmentBadge />
        <IconButton label="Fechar diálogo" onClick={onClose} className="rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-[var(--mazzi-dark)] transition-colors"><X className="h-4 w-4" aria-hidden="true" /></IconButton>
      </div>
    </div>
    <ol aria-label="Etapas da Aula Agora" className="mb-5 grid shrink-0 grid-cols-3">
      {labels.map((label, index) => <li key={label} aria-current={draft.step === index ? 'step' : undefined} className="space-y-2">
        <div className={`relative h-1.5 ${index === 0 ? 'rounded-l-full' : ''} ${index === labels.length - 1 ? 'rounded-r-full' : ''} before:absolute before:-top-1 before:left-0 before:h-3.5 before:w-3.5 before:rounded-full before:bg-inherit ${index <= draft.step ? 'bg-[var(--mazzi-yellow)]' : 'bg-[var(--mazzi-border)]'}`} />
        <span className="sr-only">{index + 1}. {label}</span>
      </li>)}
    </ol>
    <div className="min-h-0 min-w-0 flex-1 space-y-5 overflow-y-auto px-1 pt-1 pb-4">
      <div>
        <h2 ref={heading} tabIndex={-1} className="text-2xl font-extrabold text-slate-950 outline-none">{headings[draft.step]}</h2>
        <p className="mt-2 text-sm text-slate-600">{draft.step === 0 ? 'Informe o ponto de encontro. Sua aula começa e termina nesse local.' : draft.step === 1 ? 'Você fará a aula no carro do profissional.' : 'O profissional define o valor da aula. Você escolhe o máximo que aceita pagar.'}</p>
      </div>
      {draft.step === 0 && <div className="space-y-4">
        <div className="mazzi-card p-3 sm:p-4 focus-within:ring-2 focus-within:ring-[var(--mazzi-yellow)]">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 sm:gap-3">
            <ButtonBase type="button" disabled={busy} onClick={() => void locate()} aria-label="Usar minha localização" title="Usar minha localização"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] transition hover:brightness-95 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)]">
              {locating ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Navigation className="h-5 w-5" aria-hidden="true" />}
            </ButtonBase>
            <div className="min-w-0">
              <label htmlFor="instant-meeting-point" className="block text-[10px] font-extrabold uppercase tracking-[.14em] text-[var(--mazzi-muted)]">Localização</label>
        <ConfirmableAddressAutocomplete id="instant-meeting-point" value={draft.address} onChange={value => updateAddress(value)}
          onConfirm={(suggestion, value) => updateAddress(value, suggestion ? { lat: suggestion.latitude, lng: suggestion.longitude } : undefined)}
          onClear={() => updateAddress('')} ariaLabel="Endereço do encontro" placeholder="Digite um endereço, bairro ou local"
          className="mt-0.5 sm:mt-1"
          inputClassName="min-h-[32px] bg-transparent pr-7 text-sm font-extrabold text-[var(--mazzi-text)] outline-none placeholder:text-slate-400 focus:outline-none" />
            </div>
          </div>
        </div>
        {addressValid ? <div className="overflow-hidden rounded-2xl border border-[var(--mazzi-border)]"><UniversalMap providers={[]} meetingPoint={{ ...draft.location!, title: draft.address }} height="200px" zoom={16} interactive={false} /></div>
          : <div className="flex min-h-40 items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-500 p-5 text-sm text-slate-600"><MapPin className="h-6 w-6 shrink-0" aria-hidden="true" />Confirme um endereço para ver o ponto no mapa.</div>}
      </div>}
      {draft.step === 1 && <fieldset disabled={busy} className="min-w-0 space-y-2 text-slate-900"><legend className="sr-only">Câmbio</legend>
        <div className="grid gap-2 sm:grid-cols-2">
        {([{ value: 'MANUAL', label: 'Manual', icon: Settings2 }, { value: 'AUTOMATIC', label: 'Automático', icon: Settings2 }, { value: 'ALL', label: 'Tanto faz', icon: Shuffle }] as const).map(({ value, label, icon: Icon }) => <label key={value} className={`${instantOptionClassName(draft.transmission === value)} !min-h-20 relative cursor-pointer focus-within:ring-2 focus-within:ring-[var(--mazzi-yellow)] ${busy ? 'pointer-events-none opacity-60' : ''}`}>
          <span className="flex min-w-0 items-center gap-2"><Icon className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="block text-sm font-extrabold">{label}</span></span>
          <input type="radio" name="instant-transmission" value={value} checked={draft.transmission === value} onChange={() => { setOptions([]); setDraft(d => ({ ...d, transmission: value, priceChosen: false })); }} className="sr-only" />
          {draft.transmission === value && <Check className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />}
        </label>)}
        </div>
      </fieldset>}
      {draft.step === 2 && <div className="space-y-4 text-slate-900">
        <p className="rounded-2xl bg-[var(--mazzi-surface-soft)] p-3 text-sm text-[var(--mazzi-muted)]">{draft.address} · {draft.transmission === 'ALL' ? 'Qualquer câmbio' : draft.transmission === 'MANUAL' ? 'Manual' : 'Automático'}</p>
        {loading ? <div role="status" className="space-y-3"><span className="text-sm text-[var(--mazzi-muted)]">Consultando profissionais compatíveis…</span>{[1, 2, 3].map(n => <div key={n} className="h-16 rounded-2xl bg-[var(--mazzi-surface-soft)] motion-safe:animate-pulse" />)}</div>
          : <><InstantLessonPriceSelector options={options} value={draft.priceChosen ? draft.maxPrice : -1} onChange={value => setDraft(d => ({ ...d, maxPrice: value, priceChosen: true }))} disabled={busy} />
            {!available && !error && <p role="status" className="text-sm text-[var(--mazzi-muted)]">Nenhum profissional disponível agora. Tente novamente ou agende uma aula.</p>}
          </>}
        <div className="flex flex-wrap justify-end gap-2">
          <ButtonBase type="button" disabled={loading || busy} aria-busy={loading} onClick={() => setRetry(n => n + 1)}
            className="group flex min-h-12 items-center gap-3 rounded-2xl border border-[var(--mazzi-border)] bg-[var(--mazzi-surface-soft)] py-2 pl-2 pr-4 text-sm font-bold text-[var(--mazzi-dark)] transition-colors hover:border-amber-300 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-yellow)] disabled:cursor-not-allowed disabled:opacity-60">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--mazzi-yellow-soft)] text-amber-700"><RefreshCw className={`h-4 w-4 ${loading ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" /></span>
            <span>{loading ? 'Atualizando valores…' : 'Atualizar valores'}</span>
          </ButtonBase>
          {!available && !loading && <Button type="button" variant="outline" onClick={onClose}>Agendar uma aula</Button>}
        </div>
      </div>}
      {error && <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    </div>
    <WizardActionFooter>
      <Button type="button" variant="outline" disabled={busy} onClick={draft.step === 0 ? onClose : back} leftIcon={draft.step === 0 ? <X className="h-4 w-4" aria-hidden="true" /> : <ArrowLeft className="h-4 w-4" aria-hidden="true" />}>{draft.step === 0 ? 'Fechar' : 'Voltar'}</Button>
      <Button type="button" data-instant-primary="true" variant="primary" className="min-h-12 flex-1" disabled={draft.step === 2 ? !canStart : busy || !addressValid} isLoading={submitting || isLoading}
        onClick={() => { if (draft.step === 2) void start(); else { setError(null); setDraft(d => ({ ...d, step: d.step + 1 })); } }}
        leftIcon={draft.step === 2 ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}>
        {draft.step === 2 ? 'Encontrar profissional' : 'Continuar'}
      </Button>
    </WizardActionFooter>
  </div>;
}
