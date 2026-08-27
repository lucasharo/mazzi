import React from 'react';
import { Calendar, Car, MapPin, ShieldCheck, Star, UserRound } from 'lucide-react';
import { PublicSearchProviderResult } from '../../types';
import { formatCentsToBRL } from '../../domain/money';
import { trackSearchAnalytics } from './SearchAnalytics';
import { Button, PrimaryButton, SecondaryButton } from '../ui/Button';

export interface ProviderResultCardProps {
  result: PublicSearchProviderResult;
  onSelect: (providerId: string) => void;
  onViewProfile?: (providerId: string) => void;
  isSelected?: boolean;
}

function getInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'M';
}

export const ProviderResultCard: React.FC<ProviderResultCardProps> = ({
  result,
  onSelect,
  onViewProfile,
  isSelected = false,
}) => {
  const isCFC = result.providerType === 'DRIVING_SCHOOL';
  const offerings = result.publicOfferings || [];
  const primaryOffering = offerings[0];
  const hasMultipleOfferings = offerings.length > 1;
  const duration = primaryOffering?.durationMinutes;
  const location = [result.neighborhood, result.city].filter(Boolean).join(', ') || 'Localização aproximada';
  
  const transmission =
    primaryOffering?.transmission === 'AUTOMATIC'
      ? 'Automático'
      : primaryOffering?.transmission === 'MANUAL'
      ? 'Manual'
      : undefined;

  // Render categories from actual data without hardcoding
  const categoryLabel = primaryOffering?.category
    ? `Cat. ${primaryOffering.category}`
    : result.categories && result.categories.length > 0
    ? `Cat. ${result.categories.join(', ')}`
    : undefined;

  const providerTypeLabel = isCFC ? 'Autoescola / CFC' : 'Instrutor autônomo';

  const cleanVehicleTitle = React.useMemo(() => {
    if (!primaryOffering?.vehicleTitle) return 'Veículo disponível';
    const title = primaryOffering.vehicleTitle;
    const nameParts = result.displayName.split(/\s+/).filter((p) => p.length > 2);
    const hasNameMatch = nameParts.some((part) => title.toLowerCase().includes(part.toLowerCase()));
    if (hasNameMatch || title.startsWith('Instrutor') || title.startsWith('Instrutora')) {
      return 'Veículo disponível';
    }
    return title;
  }, [primaryOffering?.vehicleTitle, result.displayName]);

  const handleSchedule = () => {
    trackSearchAnalytics({ eventType: 'PROVIDER_VIEWED', providerId: result.providerId });
    onSelect(result.providerId);
  };

  return (
    <article
      id={`provider-card-${result.providerId}`}
      aria-label={`Prestador ${result.displayName}, ${providerTypeLabel}`}
      className={`mazzi-card relative p-4 sm:p-5 transition-all duration-200 text-left space-y-3.5 hover:shadow-md ${
        isSelected ? 'ring-2 ring-[var(--mazzi-yellow)] shadow-md' : ''
      }`}
    >
      {/* 1. Top Section: Avatar + Identity + Rating */}
      <div className="flex items-start gap-3 sm:gap-3.5 pr-1">
        {/* Avatar */}
        <div className="mazzi-avatar !overflow-visible h-14 w-14 sm:h-16 sm:w-16 shrink-0 text-base sm:text-lg font-bold shadow-xs ring-1 ring-black/5 relative">
          {result.avatarUrl ? (
            <img
              src={result.avatarUrl}
              alt={`Foto de ${result.displayName}`}
              className="h-full w-full rounded-[inherit] object-cover"
              loading="lazy"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center rounded-[inherit] bg-[var(--mazzi-yellow-soft)] text-[var(--mazzi-dark)]" aria-hidden="true">
              {getInitials(result.displayName)}
            </span>
          )}
          {result.isVerified && (
            <span
              className="absolute bottom-0 right-0 z-20 inline-flex h-6 w-6 translate-x-1/4 translate-y-1/4 items-center justify-center rounded-full border-2 border-white bg-emerald-50 text-emerald-700 shadow-sm"
              aria-label="Prestador verificado"
              title="Verificado"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            </span>
          )}
        </div>

        {/* Info & Badges */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mazzi-muted)]">
              {isCFC ? 'Autoescola / CFC' : 'Instrutor autônomo'}
            </span>
          </div>

          <h2 className="mt-5 text-base sm:mt-0 sm:text-lg font-bold text-[var(--mazzi-dark)] leading-snug break-words">
            {result.displayName}
          </h2>

          <p className="mt-1 flex items-center gap-1 text-xs font-medium text-slate-500 truncate">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
            <span className="truncate">{result.formattedDistance ? `${result.formattedDistance} · ` : ''}{location}</span>
          </p>
        </div>

        {/* Rating Block */}
        <div className="absolute right-4 top-4 shrink-0 text-right sm:right-5 sm:top-5">
          {result.ratingCount > 0 ? (
            <div
              className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-[var(--mazzi-text)] bg-[var(--mazzi-surface-soft)] px-2.5 py-1 rounded-xl border border-[var(--mazzi-border)]"
              aria-label={`Avaliação ${result.ratingAverage.toFixed(1)} com ${result.ratingCount} avaliações`}
            >
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" aria-hidden="true" />
              <span>{result.ratingAverage.toFixed(1)}</span>
              <span className="text-[10px] font-normal text-slate-400">({result.ratingCount})</span>
            </div>
          ) : (
            <span className="inline-block text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
              Novo na MAZZI
            </span>
          )}
        </div>
      </div>

      {/* 2. Vehicle & Transmission Chip (When available) */}
      {primaryOffering && (
        <div className="mazzi-soft-card mt-3 flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[var(--mazzi-text)] border border-[var(--mazzi-border)]">
          <Car className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <span className="truncate">{cleanVehicleTitle}</span>
          {transmission && <span className="shrink-0 text-[var(--mazzi-muted)] font-medium">· {transmission}</span>}
          {categoryLabel && (
            <span className="ml-auto shrink-0 text-[10px] font-bold uppercase bg-[var(--mazzi-yellow-soft)] text-[var(--mazzi-text)] px-2 py-0.5 rounded-md">
              {categoryLabel}
            </span>
          )}
        </div>
      )}

      {/* 3. Pricing & Actions Footer */}
      <div className="mt-3.5 pt-3 border-t border-[var(--mazzi-border)] flex flex-nowrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          {hasMultipleOfferings ? (
            <p className="text-[9px] font-medium uppercase tracking-wider text-slate-400">
              A partir de
            </p>
          ) : (
            <p className="text-[9px] font-medium uppercase tracking-wider text-slate-400">
              Valor por aula
            </p>
          )}
          <p className="mt-0.5 whitespace-nowrap text-sm sm:text-base font-bold text-[var(--mazzi-text)]">
            {formatCentsToBRL(result.startingPriceInCents)}
            {duration ? (
              <span className="mt-0.5 block text-[10px] font-normal text-slate-500">{duration} min</span>
            ) : null}
          </p>
        </div>

        <div className="ml-auto flex items-center justify-end gap-2 shrink-0">
          {onViewProfile && (
            <SecondaryButton
              type="button"
              size="sm"
              className="min-h-11 px-2.5 sm:px-3.5 text-xs font-bold shadow-2xs flex items-center justify-center gap-1.5"
              onClick={() => onViewProfile(result.providerId)}
              leftIcon={<UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />}
              aria-label={`Ver perfil detalhado de ${result.displayName}`}
            >
              Perfil
            </SecondaryButton>
          )}
          <PrimaryButton
            type="button"
            size="sm"
            className="min-h-11 px-2.5 sm:px-4 text-xs font-bold shadow-xs flex items-center justify-center gap-1.5"
            onClick={handleSchedule}
            leftIcon={<Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />}
            aria-label={`Agendar aula com ${result.displayName}`}
          >
            Agenda
          </PrimaryButton>
        </div>
      </div>
    </article>
  );
};
