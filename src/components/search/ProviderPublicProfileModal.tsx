import React from 'react';
import { ArrowLeft, Car, ChevronRight, MapPin, ShieldCheck, Star } from 'lucide-react';
import { PublicSearchProviderResult } from '../../types';
import { Modal } from '../ui/Modal';
import { formatCentsToBRL } from '../../domain/money';

export interface ProviderPublicProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: PublicSearchProviderResult | null;
  onSelectSlotToBook?: (providerId: string) => void;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'M';
}

function transmissionLabel(value?: string): string | undefined {
  if (value === 'AUTOMATIC') return 'Automático';
  if (value === 'MANUAL') return 'Manual';
  return undefined;
}

export const ProviderPublicProfileModal: React.FC<ProviderPublicProfileModalProps> = ({ isOpen, onClose, result, onSelectSlotToBook }) => {
  if (!isOpen || !result) return null;
  const isCFC = result.providerType === 'DRIVING_SCHOOL';
  const offerings = (result.publicOfferings || []).filter((offering) => offering.category === 'B');
  const location = [result.neighborhood, result.city].filter(Boolean).join(' • ') || 'Localização aproximada';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Perfil público" size="md">
      <div className="space-y-6 pb-1 text-left">
        <div className="flex items-center justify-between">
          <button type="button" onClick={onClose} aria-label="Voltar para a busca" className="inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Voltar</button>
          {result.isVerified && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />Verificado</span>}
        </div>

        <section className="text-center">
          <div className="mazzi-avatar mx-auto h-24 w-24 text-2xl font-black shadow-[var(--mazzi-shadow)]">{result.avatarUrl ? <img src={result.avatarUrl} alt={`Foto de ${result.displayName}`} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center">{initials(result.displayName)}</span>}</div>
          <div className="mt-4 min-w-0">
            <p className="text-xs font-black text-amber-700">{isCFC ? 'Autoescola / CFC' : 'Instrutor autônomo'}</p>
            <h2 className="mt-1 truncate text-xl font-black tracking-tight text-slate-950">{result.displayName}</h2>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-500">
              {result.ratingCount > 0 ? <span className="inline-flex items-center gap-1 text-slate-800"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />{result.ratingAverage.toFixed(1)} <span className="text-slate-400">({result.ratingCount} avaliações)</span></span> : <span className="font-black text-slate-500">Novo na MAZZI</span>}
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />{location}</span>
              {result.formattedDistance && <span>{result.formattedDistance}</span>}
            </div>
          </div>
        </section>

        <section className="mazzi-hero"><div className="p-4"><p className="text-2xl font-extrabold">{result.ratingCount > 0 ? result.ratingAverage.toFixed(1) : 'Novo'}</p><p className="mt-1 text-xs font-bold opacity-70">avaliação</p></div><div className="p-4"><p className="text-2xl font-extrabold">{formatCentsToBRL(result.startingPriceInCents)}</p><p className="mt-1 text-xs font-bold text-white/60">por aula</p></div></section>

        <section>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-black text-slate-900">Aulas disponíveis</h3><span className="text-[10px] font-bold text-slate-400">Categoria B</span></div>
          {offerings.length === 0 ? <div className="mazzi-soft-card p-5 text-center text-xs text-slate-500">Consulte os horários disponíveis para ver as ofertas ativas.</div> : <div className="space-y-3">{offerings.map((offering) => <article key={offering.id} className="mazzi-card p-4"><div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--mazzi-yellow-soft)]"><Car className="h-5 w-5"/></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{offering.vehicleTitle || 'Veículo disponível'}</p><p className="mt-1 text-xs font-semibold text-[var(--mazzi-muted)]">{[transmissionLabel(offering.transmission), offering.category ? `Categoria ${offering.category}` : undefined, offering.durationMinutes ? `${offering.durationMinutes} min` : undefined].filter(Boolean).join(' · ')}</p></div></div></article>)}</div>}
        </section>

        <button type="button" onClick={() => { onClose(); onSelectSlotToBook?.(result.providerId); }} className="mazzi-primary flex w-full items-center justify-center gap-2">Agendar aula<ChevronRight className="h-4 w-4"/></button>
      </div>
    </Modal>
  );
};
