import React from 'react';
import { ShieldCheck, MapPin, Calendar, Clock, Building2, User, ChevronRight } from 'lucide-react';
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
      className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md transition-all hover:border-amber-400/80 flex flex-col justify-between text-left group"
    >
      <div>
        {/* Header with Avatar & Verified */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <Avatar name={provider.name} imageUrl={provider.avatarUrl} size="lg" />
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-slate-900 text-base leading-snug group-hover:text-amber-600 transition-colors">
                  {provider.name}
                </h3>
                {provider.isVerified && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
                    <ShieldCheck className="w-3 h-3 text-amber-600 flex-shrink-0" />
                    Verificado
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1 font-medium">
                {provider.type === 'DRIVING_SCHOOL' ? (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" /> Autoescola / CFC
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" /> Instrutor Autônomo
                  </span>
                )}
                <span>•</span>
                <span className="flex items-center gap-0.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-500" />
                  {provider.neighborhood}
                  {provider.distanceKm ? ` (${provider.distanceKm} km)` : ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Rating & Categories */}
        <div className="mt-4 flex items-center justify-between">
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
          <div className="mt-3.5 px-3 py-2 rounded-xl bg-amber-50/80 border border-amber-200/80 flex items-center gap-2 text-xs text-amber-950">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Próximo horário: <strong className="font-bold">{provider.nextAvailableSlot}</strong></span>
          </div>
        )}
      </div>

      {/* Footer with Price and Action */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between">
        <div>
          <span className="text-[11px] text-slate-400 block uppercase font-bold tracking-wider">A partir de</span>
          <Price cents={provider.startingPriceInCents} durationMinutes={50} size="md" />
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={() => onSelect && onSelect(provider)}
          rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
        >
          Ver Horários
        </Button>
      </div>
    </div>
  );
};
