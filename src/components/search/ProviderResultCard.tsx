import React from 'react';
import { Car, ChevronRight, MapPin, ShieldCheck, Star } from 'lucide-react';
import { PublicSearchProviderResult } from '../../types';
import { formatCentsToBRL } from '../../domain/money';
import { trackSearchAnalytics } from './SearchAnalytics';

export interface ProviderResultCardProps {
  result: PublicSearchProviderResult;
  onSelect: (providerId: string) => void;
  onViewProfile?: (providerId: string) => void;
  isSelected?: boolean;
}

function getInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'M';
}

export const ProviderResultCard: React.FC<ProviderResultCardProps> = ({ result, onSelect, onViewProfile, isSelected = false }) => {
  const isCFC = result.providerType === 'DRIVING_SCHOOL';
  const primaryOffering = result.publicOfferings[0];
  const duration = primaryOffering?.durationMinutes;
  const location = [result.neighborhood, result.city].filter(Boolean).join(', ') || 'Localização aproximada';
  const transmission = primaryOffering?.transmission === 'AUTOMATIC' ? 'Automático' : primaryOffering?.transmission === 'MANUAL' ? 'Manual' : undefined;

  const handleSchedule = () => {
    trackSearchAnalytics({ eventType: 'PROVIDER_VIEWED', providerId: result.providerId });
    onSelect(result.providerId);
  };

  return (
    <article className={`rounded-3xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${isSelected ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200 shadow-sm'}`}>
      <div className="flex items-start gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-slate-950 text-lg font-black text-amber-400 ring-4 ring-slate-50">
          {result.avatarUrl ? <img src={result.avatarUrl} alt={`Foto de ${result.displayName}`} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center">{getInitials(result.displayName)}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-black text-amber-700">{isCFC ? 'Autoescola / CFC' : 'Instrutor autônomo'}</span>
            {result.isVerified && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700"><ShieldCheck className="h-3 w-3" aria-hidden="true" />Verificado</span>}
          </div>
          <h2 className="mt-1 truncate text-base font-black text-slate-950">{result.displayName}</h2>
          <p className="mt-1 flex items-center gap-1 truncate text-xs font-semibold text-slate-500"><MapPin className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />{result.formattedDistance || 'Distância não informada'} · {location}</p>
        </div>
        <div className="shrink-0 text-right">
          {result.ratingCount > 0 ? <div className="inline-flex items-center gap-1 text-sm font-black text-slate-900"><Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />{result.ratingAverage.toFixed(1)}<span className="text-[10px] font-semibold text-slate-400">({result.ratingCount})</span></div> : <span className="text-[10px] font-black text-slate-500">Novo na MAZZI</span>}
        </div>
      </div>

      {primaryOffering && <div className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700"><Car className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" /><span className="truncate">{primaryOffering.vehicleTitle || 'Veículo disponível'}</span>{transmission && <span className="shrink-0 text-slate-400">· {transmission}</span>}<span className="shrink-0 text-slate-400">· Cat. {primaryOffering.category || 'B'}</span></div>}

      <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-100 pt-4">
        <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">A partir de</p><p className="mt-0.5 text-lg font-black text-slate-950">{formatCentsToBRL(result.startingPriceInCents)}{duration ? <span className="ml-1 text-xs font-bold text-slate-400">· {duration} min</span> : null}</p></div>
        <div className="flex gap-2">
          {onViewProfile && <button type="button" onClick={() => onViewProfile(result.providerId)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 transition hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500">Ver perfil</button>}
          <button type="button" onClick={handleSchedule} className="inline-flex items-center gap-1 rounded-xl bg-amber-400 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-950">Ver horários<ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></button>
        </div>
      </div>
    </article>
  );
};
