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
    <article className={`mazzi-card p-5 text-left transition hover:-translate-y-0.5 ${isSelected ? 'ring-2 ring-[var(--mazzi-yellow)]' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="mazzi-avatar h-16 w-16 shrink-0 text-lg font-black">
          {result.avatarUrl ? <img src={result.avatarUrl} alt={`Foto de ${result.displayName}`} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center">{getInitials(result.displayName)}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mazzi-muted)]">{isCFC ? 'Autoescola' : 'Instrutor'}</span>
            {result.isVerified && <ShieldCheck className="h-4 w-4 text-emerald-600" aria-label="Verificado"/>}
          </div>
          <h2 className="mt-1 truncate text-base font-black text-slate-950">{result.displayName}</h2>
          <p className="mt-1 flex items-center gap-1 truncate text-xs font-semibold text-slate-500"><MapPin className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />{result.formattedDistance || 'Distância não informada'} · {location}</p>
        </div>
        <div className="shrink-0 text-right">
          {result.ratingCount > 0 ? <div className="inline-flex items-center gap-1 text-sm font-black text-slate-900"><Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />{result.ratingAverage.toFixed(1)}<span className="text-[10px] font-semibold text-slate-400">({result.ratingCount})</span></div> : <span className="text-[10px] font-black text-slate-500">Novo na MAZZI</span>}
        </div>
      </div>

      {primaryOffering && <div className="mazzi-soft-card mt-5 flex items-center gap-2 px-4 py-3 text-xs font-bold"><Car className="h-4 w-4 shrink-0"/><span className="truncate">{primaryOffering.vehicleTitle || 'Veículo disponível'}</span>{transmission && <span className="shrink-0 text-[var(--mazzi-muted)]">· {transmission}</span>}</div>}

      <div className="mt-5 flex items-end justify-between gap-3">
        <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">A partir de</p><p className="mt-0.5 text-lg font-black text-slate-950">{formatCentsToBRL(result.startingPriceInCents)}{duration ? <span className="ml-1 text-xs font-bold text-slate-400">· {duration} min</span> : null}</p></div>
        <div className="flex gap-2">
          {onViewProfile && <button type="button" onClick={() => onViewProfile(result.providerId)} className="px-2 py-2 text-xs font-black">Perfil</button>}
          <button type="button" onClick={handleSchedule} className="mazzi-yellow-button inline-flex min-h-10 items-center gap-1 px-4 text-xs">Agendar<ChevronRight className="h-3.5 w-3.5"/></button>
        </div>
      </div>
    </article>
  );
};
