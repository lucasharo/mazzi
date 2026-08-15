// ============================================================================
// MAZZI PLATFORM — PUBLIC PROVIDER RESULT CARD COMPONENT
// Rendered in search results lists. Strictly displays sanitized Public DTO data.
// ============================================================================

import React from 'react';
import { Star, ShieldCheck, MapPin, Clock, ChevronRight, Car, Building2, User } from 'lucide-react';
import { PublicSearchProviderResult } from '../../types';
import { formatCentsToBRL } from '../../domain/money';
import { Badge } from '../ui/Badge';
import { trackSearchAnalytics } from './SearchAnalytics';

export interface ProviderResultCardProps {
  result: PublicSearchProviderResult;
  onSelect: (providerId: string) => void;
  onViewProfile?: (providerId: string) => void;
  isSelected?: boolean;
}

export const ProviderResultCard: React.FC<ProviderResultCardProps> = ({
  result,
  onSelect,
  onViewProfile,
  isSelected = false,
}) => {
  const isCFC = result.providerType === 'DRIVING_SCHOOL';
  const primaryOffering = result.publicOfferings[0];

  const handleCardClick = () => {
    trackSearchAnalytics({
      eventType: 'PROVIDER_VIEWED',
      providerId: result.providerId,
    });
    if (onSelect) {
      onSelect(result.providerId);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`bg-white rounded-2xl border p-4 shadow-xs transition hover:shadow-md cursor-pointer text-left relative overflow-hidden ${
        isSelected
          ? 'border-amber-400 bg-amber-50/40 ring-2 ring-amber-400/30'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Top Header: Badge, Type & Rating */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
              isCFC ? 'bg-indigo-50 text-indigo-900 border border-indigo-200' : 'bg-amber-50 text-amber-900 border border-amber-200'
            }`}
          >
            {isCFC ? <Building2 className="w-3 h-3 text-indigo-600" /> : <User className="w-3 h-3 text-amber-600" />}
            {isCFC ? 'Autoescola / CFC' : 'Instrutor Autônomo'}
          </span>

          {result.isVerified && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              Verificado
            </span>
          )}
        </div>

        {/* Rating */}
        <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200/80">
          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
          <span className="text-xs font-black text-slate-900">
            {result.ratingAverage.toFixed(1)}
          </span>
          <span className="text-[10px] text-slate-500 font-medium">({result.ratingCount})</span>
        </div>
      </div>

      {/* Main Info: Avatar & Name & Distance */}
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-slate-950 text-amber-400 font-black text-base flex items-center justify-center border border-slate-800 shadow-xs">
            {result.displayName
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-extrabold text-sm text-slate-900 truncate">{result.displayName}</h3>
          
          <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
            <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="truncate">
              {result.formattedDistance} • {result.neighborhood}, {result.city}
            </span>
          </div>

          {/* Public Offering Vehicle summary */}
          {primaryOffering && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-700 font-semibold mt-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
              <Car className="w-3.5 h-3.5 text-slate-500" />
              <span className="truncate">
                {primaryOffering.vehicleTitle} ({primaryOffering.transmission === 'AUTOMATIC' ? 'Automático' : 'Manual'})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer: Price, Available Slots & CTA */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
            A partir de
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-black text-slate-950">
              {formatCentsToBRL(result.startingPriceInCents)}
            </span>
            <span className="text-[11px] text-slate-500 font-semibold">/ 50min</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {result.nextAvailableSlot && (
            <div className="text-right hidden sm:block">
              <span className="text-[10px] text-emerald-700 font-bold block flex items-center gap-1">
                <Clock className="w-3 h-3 text-emerald-600 inline" />
                {result.nextAvailableSlot}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleCardClick();
            }}
            className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold text-xs transition cursor-pointer flex items-center gap-1 shadow-2xs"
          >
            <span>Ver Horários</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
