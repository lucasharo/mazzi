// ============================================================================
// MAZZI PLATFORM — SEARCH FILTER DRAWER COMPONENT
// Advanced filtering for transmission, provider type, radius, price range, rating,
// and sorting options.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { SlidersHorizontal, X, Star, Check, ArrowUpDown } from 'lucide-react';
import { SearchRequest, ProviderType, TransmissionType } from '../../types';
import { DEFAULT_SEARCH_RADIUS_METERS } from '../../domain/search';
import { Button } from '../ui/Button';
import { formatCentsToBRL } from '../../domain/money';
import { trackSearchAnalytics } from './SearchAnalytics';
import { getBusinessDateOnly } from '../../lib/date-format';

export interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  searchRequest: SearchRequest;
  onApplyFilters: (updated: Partial<SearchRequest>) => void;
  onResetFilters: () => void;
}

export const FilterDrawer: React.FC<FilterDrawerProps> = ({
  isOpen,
  onClose,
  searchRequest,
  onApplyFilters,
  onResetFilters,
}) => {
  const [draft, setDraft] = useState<SearchRequest>(searchRequest);

  useEffect(() => {
    if (isOpen) setDraft(searchRequest);
  }, [isOpen, searchRequest]);

  if (!isOpen) return null;

  const updateDraft = (updated: Partial<SearchRequest>) => setDraft((current) => ({ ...current, ...updated }));
  const handleApply = () => {
    onApplyFilters(draft);
    trackSearchAnalytics({
      eventType: 'FILTER_APPLIED',
      category: draft.category,
      providerType: draft.providerType,
    });
    onClose();
  };
  const handleReset = () => {
    setDraft((current) => ({ ...current, date: undefined, sortBy: 'RECOMMENDED', providerType: 'ALL', transmission: 'ALL', radiusMeters: DEFAULT_SEARCH_RADIUS_METERS, minimumRating: undefined, maxPriceInCents: undefined }));
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-sm bg-white h-full shadow-2xl flex flex-col text-slate-900 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950 text-white flex items-center justify-between border-b border-slate-900">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-amber-400" />
            <h3 className="font-extrabold text-base text-white">Filtros de Busca</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Filters Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-left">
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-2.5">Quando você quer sua aula?</label>
            <div className="grid grid-cols-3 gap-2">
              {[{ value: undefined, label: 'Qualquer data' }, { value: getBusinessDateOnly(), label: 'Hoje' }, { value: getBusinessDateOnly(1), label: 'Amanhã' }].map((dateOption) => (
                <button key={dateOption.label} type="button" onClick={() => updateDraft({ date: dateOption.value })} aria-pressed={draft.date === dateOption.value || (!draft.date && !dateOption.value)} className={`rounded-xl border p-2.5 text-center text-xs font-bold transition ${draft.date === dateOption.value || (!draft.date && !dateOption.value) ? 'border-amber-400 bg-amber-50 text-slate-950 ring-1 ring-amber-400/40' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>{dateOption.label}</button>
              ))}
            </div>
          </div>

          {/* Sort By */}
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-2.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-500" />
              Ordenar Por
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {[
                { id: 'RECOMMENDED', label: 'Recomendados (Algoritmo MAZZI)' },
                { id: 'DISTANCE', label: 'Menor Distância' },
                { id: 'RATING', label: 'Melhor Avaliação' },
                { id: 'PRICE_ASC', label: 'Menor Preço' },
                { id: 'PRICE_DESC', label: 'Maior Preço' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => updateDraft({ sortBy: opt.id as any })}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-left flex items-center justify-between transition cursor-pointer ${
                    draft.sortBy === opt.id
                      ? 'border-amber-400 bg-amber-50/80 text-slate-950'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <span>{opt.label}</span>
                  {draft.sortBy === opt.id && (
                    <Check className="w-4 h-4 text-amber-600" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Provider Type */}
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-2.5">
              Tipo de Profissional
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'ALL', label: 'Todos' },
                { id: 'INSTRUCTOR', label: 'Instrutor Autônomo' },
                { id: 'DRIVING_SCHOOL', label: 'Autoescola (CFC)' },
              ].map((pType) => (
                <button
                  key={pType.id}
                  type="button"
                  onClick={() => updateDraft({ providerType: pType.id as any })}
                  className={`p-2.5 rounded-xl border text-center text-xs font-bold transition cursor-pointer ${
                    draft.providerType === pType.id || (!draft.providerType && pType.id === 'ALL')
                      ? 'border-amber-400 bg-amber-50 text-slate-950 ring-1 ring-amber-400/40'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {pType.label}
                </button>
              ))}
            </div>
          </div>

          {/* Transmission Filter (Only applicable for Cat B or ALL) */}
          {draft.category !== 'A' && (
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-2.5">
                Tipo de Câmbio
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'ALL', label: 'Todos' },
                  { id: 'MANUAL', label: 'Manual' },
                  { id: 'AUTOMATIC', label: 'Automático' },
                ].map((trans) => (
                  <button
                    key={trans.id}
                    type="button"
                    onClick={() => updateDraft({ transmission: trans.id as any })}
                    className={`p-2.5 rounded-xl border text-center text-xs font-bold transition cursor-pointer ${
                      draft.transmission === trans.id || (!draft.transmission && trans.id === 'ALL')
                        ? 'border-amber-400 bg-amber-50 text-slate-950 ring-1 ring-amber-400/40'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {trans.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Radius */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                Raio Máximo de Busca
              </label>
              <span className="text-xs font-black text-amber-600">
                {((draft.radiusMeters || DEFAULT_SEARCH_RADIUS_METERS) / 1000).toFixed(0)} km
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {[2000, 5000, 10000, 20000, 50000].map((rMeters) => (
                <button
                  key={rMeters}
                  type="button"
                  onClick={() => updateDraft({ radiusMeters: rMeters })}
                  className={`py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                    (draft.radiusMeters || DEFAULT_SEARCH_RADIUS_METERS) === rMeters
                      ? 'bg-slate-950 border-slate-950 text-amber-400'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {rMeters / 1000}km
                </button>
              ))}
            </div>
          </div>

          {/* Minimum Rating */}
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-2.5">
              Avaliação Mínima
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { val: undefined, label: 'Todas' },
                { val: 4.0, label: '4.0★' },
                { val: 4.5, label: '4.5★' },
                { val: 4.8, label: '4.8★' },
              ].map((rate) => (
                <button
                  key={rate.label}
                  type="button"
                  onClick={() => updateDraft({ minimumRating: rate.val })}
                  className={`p-2 rounded-xl border text-center text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
                    draft.minimumRating === rate.val
                      ? 'border-amber-400 bg-amber-50 text-slate-950'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                  <span>{rate.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-2.5">
              Faixa de Preço Máxima por Aula
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { maxInCents: undefined, label: 'Qualquer Preço' },
                { maxInCents: 10000, label: 'Até R$ 100' },
                { maxInCents: 15000, label: 'Até R$ 150' },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => updateDraft({ maxPriceInCents: p.maxInCents })}
                  className={`p-2 rounded-xl border text-center text-xs font-bold transition cursor-pointer ${
                    draft.maxPriceInCents === p.maxInCents
                      ? 'border-amber-400 bg-amber-50 text-slate-950'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] flex items-center gap-2">
          <Button
            variant="outline"
            size="md"
            className="w-1/3"
            onClick={handleReset}
          >
            Limpar
          </Button>
          <Button
            variant="primary"
            size="md"
            className="w-2/3"
            onClick={handleApply}
          >
            Aplicar Filtros
          </Button>
        </div>
      </div>
    </div>
  );
};
