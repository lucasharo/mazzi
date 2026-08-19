import React from 'react';
import { ShieldCheck, MapPin, Clock, Building2, User, ChevronRight } from 'lucide-react';
import { Provider } from '../../types';
import { Avatar } from './Avatar';
import { Rating } from './Rating';
import { Price } from './Price';
import { Badge } from './Badge';
import { Button } from './Button';

export interface ProviderCardProps {
  provider: Provider;
  onSelect?: (provider: Provider) => void;
  id?: string;
}

export const ProviderCard: React.FC<ProviderCardProps> = ({
  provider,
  onSelect,
  id,
}) => {
  return (
    <div
      id={id || `provider-card-${provider.id}`}
      className="mazzi-card p-4 sm:p-5 flex flex-col justify-between text-left transition hover:-translate-y-0.5 group"
    >
      <div>
        {/* Header with Avatar & Verified */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <Avatar name={provider.name} imageUrl={provider.avatarUrl} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="font-extrabold text-[var(--mazzi-dark)] text-base leading-snug truncate">
                  {provider.name}
                </h3>
                {provider.isVerified && (
                  <span
                    className="inline-flex items-center justify-center bg-emerald-50 text-emerald-700 p-1 rounded-full border border-emerald-200/60 shrink-0"
                    aria-label="Prestador verificado"
                    title="Prestador verificado"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-1 font-medium">
                {provider.type === 'DRIVING_SCHOOL' ? (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" /> Autoescola / CFC
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" /> Instrutor Autônomo
                  </span>
                )}
                <span>•</span>
                <span className="flex items-center gap-0.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                  {provider.neighborhood}
                  {provider.distanceKm ? ` (${provider.distanceKm} km)` : ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Rating & Categories */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Rating value={provider.ratingAverage} count={provider.ratingCount} size="sm" />
          <div className="flex items-center gap-1.5">
            {(provider.categories || []).map((cat) => (
              <Badge key={cat} variant="primary" size="sm">
                Cat. {cat}
              </Badge>
            ))}
            {(provider.transmissions || []).map((trans) => (
              <Badge key={trans} variant="default" size="sm">
                {trans === 'MANUAL' ? 'Manual' : 'Automático'}
              </Badge>
            ))}
          </div>
        </div>

        {/* Bio preview if available */}
        {provider.bio && (
          <p className="mt-3 text-xs text-slate-600 line-clamp-2 leading-relaxed">
            {provider.bio}
          </p>
        )}

        {/* Next slot */}
        {provider.nextAvailableSlot && (
          <div className="mt-3.5 px-3 py-2 rounded-xl bg-[var(--mazzi-surface-soft)] border border-[var(--mazzi-border)] flex items-center gap-2 text-xs text-[var(--mazzi-dark)] font-medium">
            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
            <span>Próximo horário: <strong className="font-extrabold">{provider.nextAvailableSlot}</strong></span>
          </div>
        )}
      </div>

      {/* Footer with Price and Action */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-3">
        <div>
          <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">A partir de</span>
          <Price cents={provider.startingPriceInCents} durationMinutes={50} size="md" />
        </div>
        <Button
          size="sm"
          variant="primary"
          className="min-h-11 px-4"
          onClick={() => onSelect && onSelect(provider)}
          rightIcon={<ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />}
        >
          Ver Horários
        </Button>
      </div>
    </div>
  );
};
