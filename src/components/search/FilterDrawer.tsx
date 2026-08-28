import React, { useState, useEffect } from 'react';
import { Calendar, Car, DollarSign, MapPin, ShieldCheck, Star, Check, ArrowUpDown, RotateCcw, } from 'lucide-react';
import { Button, PrimaryButton, SecondaryButton, ButtonBase } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { SearchRequest } from '../../types';
import { formatCentsToBRL } from '../../domain/money';
import { DEFAULT_SEARCH_RADIUS_METERS } from '../../domain/search';
import { getBusinessDateOnly } from '../../lib/date-format';

export interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters?: Partial<SearchRequest>;
  searchRequest?: Partial<SearchRequest>;
  maxPriceLimitInCents?: number;
  onApplyFilters: (filters: Partial<SearchRequest>) => void;
  onResetFilters?: () => void;
}

export const FilterDrawer: React.FC<FilterDrawerProps> = ({
  isOpen,
  onClose,
  filters,
  searchRequest,
  maxPriceLimitInCents,
  onApplyFilters,
  onResetFilters,
}) => {
  // Staged filter state (draft) so user can configure choices and hit "Aplicar Filtros"
  const activeInputFilters = filters || searchRequest || {};
  const [draft, setDraft] = useState<Partial<SearchRequest>>(activeInputFilters);

  // Sync draft whenever drawer opens or upstream filters change
  useEffect(() => {
    if (isOpen) {
      setDraft(filters || searchRequest || {});
    }
  }, [isOpen, filters, searchRequest]);

  const updateDraft = (patch: Partial<SearchRequest>) => {
    setDraft((prev) => ({ ...(prev || {}), ...patch }));
  };

  const handleReset = () => {
    const resetValues: Partial<SearchRequest> = {
      date: undefined,
      category: undefined,
      transmission: undefined,
      radiusMeters: DEFAULT_SEARCH_RADIUS_METERS,
      providerType: undefined,
      minimumRating: undefined,
      maxPriceInCents: undefined,
      sortBy: 'RECOMMENDED',
    };
    setDraft(resetValues);
    onResetFilters?.();
  };

  const handleApply = () => {
    onApplyFilters(draft);
    onClose();
  };

  const footerContent = (
    <div className="flex items-center gap-3 w-full sticky bottom-0 pb-safe safe-area-inset-bottom z-[60] shrink-0">
      <SecondaryButton
        size="sm"
        className="w-1/2 font-bold shadow-sm hover:shadow-md transition-all rounded-2xl border-slate-300 bg-white flex items-center justify-center gap-2 text-slate-700"
        onClick={handleReset}
        leftIcon={<RotateCcw className="w-4 h-4 text-slate-500" aria-hidden="true" />}
        aria-label="Limpar todos os filtros selecionados"
      >
        Limpar
      </SecondaryButton>
      <PrimaryButton
        size="sm"
        className="w-1/2 font-bold shadow-md hover:shadow-lg transition-all rounded-2xl flex items-center justify-center gap-2"
        onClick={handleApply}
        leftIcon={<Check className="w-4 h-4 text-slate-950" aria-hidden="true" />}
        aria-label="Aplicar filtros selecionados à busca"
      >
        Aplicar Filtros
      </PrimaryButton>
    </div>
  );

  const currentDraft = draft || {};
  const isSelectedDate = (dateVal?: string) => currentDraft.date === dateVal;
  const isSelectedProvider = (type?: string) => (currentDraft.providerType || 'ALL') === type;
  const isSelectedTransmission = (trans?: string) => (currentDraft.transmission || 'ALL') === trans;
  const radiusKm = Math.round((currentDraft.radiusMeters || DEFAULT_SEARCH_RADIUS_METERS) / 1000);
  const ratingValue = currentDraft.minimumRating ?? 0;
  const priceValueInCents = currentDraft.maxPriceInCents ?? 0;
  const priceSliderMaxInCents = Math.max(maxPriceLimitInCents ?? 15000, 100);
  const priceSliderValueInCents = Math.min(priceValueInCents, priceSliderMaxInCents);
  const rangeClassName = 'h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--mazzi-yellow-soft)] accent-[var(--mazzi-yellow)] focus:outline-none focus:ring-2 focus:ring-[var(--mazzi-focus-glow)]';

  return (
    <Modal id="mazzi-filter-modal" isOpen={isOpen} onClose={onClose} title="Filtros" size="md" footer={footerContent}>
      <div className="space-y-6 text-left">
        {/* 1. Date Filter */}
        <div>
          <label className="mazzi-field-label flex items-center gap-1.5 mb-2">
            <Calendar className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
            Quando você quer sua aula?
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: undefined, label: 'Qualquer dia' },
              { value: getBusinessDateOnly(), label: 'Hoje' },
              { value: getBusinessDateOnly(1), label: 'Amanhã' },
            ].map((dateOption) => {
              const active = isSelectedDate(dateOption.value);
              return (
                <ButtonBase
                  key={dateOption.label}
                  type="button"
                  onClick={() => updateDraft({ date: dateOption.value })}
                  aria-pressed={active}
                  className={`min-h-11 rounded-xl border px-3 py-2 text-center text-xs transition cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)] ${
                    active
                      ? 'border-amber-400 bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] font-bold shadow-xs'
                      : 'border-[var(--mazzi-border)] bg-white text-slate-700 font-semibold hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {dateOption.label}
                </ButtonBase>
              );
            })}
          </div>
        </div>

        {/* 2. Sort By */}
        <div>
          <label className="mazzi-field-label flex items-center gap-1.5 mb-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
            Ordenar Por
          </label>
          <div className="grid grid-cols-1 gap-2">
            {[
              { id: 'RECOMMENDED', label: 'Recomendados (Algoritmo MAZZI)' },
              { id: 'DISTANCE', label: 'Menor Distância' },
              { id: 'RATING', label: 'Melhor Avaliação' },
              { id: 'PRICE_ASC', label: 'Menor Preço' },
              { id: 'PRICE_DESC', label: 'Maior Preço' },
            ].map((opt) => {
              const active = (currentDraft.sortBy || 'RECOMMENDED') === opt.id;
              return (
                <ButtonBase
                  key={opt.id}
                  type="button"
                  onClick={() => updateDraft({ sortBy: opt.id as any })}
                  aria-pressed={active}
                  className={`min-h-11 px-3.5 py-2.5 rounded-xl border text-xs text-left flex items-center justify-between transition cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)] ${
                    active
                      ? 'border-amber-400 bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] font-bold shadow-xs'
                      : 'border-[var(--mazzi-border)] bg-white text-slate-700 font-semibold hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span>{opt.label}</span>
                  {active && <Check className="w-4 h-4 text-[var(--mazzi-dark)] shrink-0" aria-hidden="true" />}
                </ButtonBase>
              );
            })}
          </div>
        </div>

        {/* 3. Provider Type */}
        <div>
          <label className="mazzi-field-label flex items-center gap-1.5 mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
            Tipo de Profissional
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'ALL', label: 'Todos' },
              { id: 'INSTRUCTOR', label: 'Autônomo' },
              { id: 'DRIVING_SCHOOL', label: 'CFC / Autoescola' },
            ].map((pType) => {
              const active = isSelectedProvider(pType.id);
              return (
                <ButtonBase
                  key={pType.id}
                  type="button"
                  onClick={() => updateDraft({ providerType: pType.id as any })}
                  aria-pressed={active}
                  className={`min-h-11 rounded-xl border px-2.5 py-2 text-center text-xs transition cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)] ${
                    active
                      ? 'border-amber-400 bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] font-bold shadow-xs'
                      : 'border-[var(--mazzi-border)] bg-white text-slate-700 font-semibold hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {pType.label}
                </ButtonBase>
              );
            })}
          </div>
        </div>

        {/* 4. Transmission Filter (Only applicable for Cat B or ALL) */}
        {currentDraft.category !== 'A' && (
          <div>
            <label className="mazzi-field-label flex items-center gap-1.5 mb-2">
              <Car className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
              Tipo de Câmbio
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'ALL', label: 'Todos' },
                { id: 'MANUAL', label: 'Manual' },
                { id: 'AUTOMATIC', label: 'Automático' },
              ].map((trans) => {
                const active = isSelectedTransmission(trans.id);
                return (
                  <ButtonBase
                    key={trans.id}
                    type="button"
                    onClick={() => updateDraft({ transmission: trans.id as any })}
                    aria-pressed={active}
                    className={`min-h-11 rounded-xl border px-3 py-2 text-center text-xs transition cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)] ${
                      active
                        ? 'border-amber-400 bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] font-bold shadow-xs'
                        : 'border-[var(--mazzi-border)] bg-white text-slate-700 font-semibold hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Car className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {trans.label}
                  </ButtonBase>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. Search Radius */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="mazzi-field-label flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
              Raio Máximo de Busca
            </label>
            <span className="rounded-md border border-amber-200 bg-[var(--mazzi-yellow-soft)] px-2 py-0.5 text-xs font-bold text-[var(--mazzi-dark)]">
              {radiusKm} km
            </span>
          </div>
          <input
            type="range"
            min="2"
            max="50"
            step="1"
            value={radiusKm}
            onChange={(event) => updateDraft({ radiusMeters: Number(event.target.value) * 1000 })}
            className={rangeClassName}
            style={{ accentColor: 'var(--mazzi-yellow)' }}
            aria-label="Raio máximo de busca"
            aria-valuetext={`${radiusKm} quilômetros`}
          />
          <div className="mt-1 flex justify-between text-[11px] font-semibold text-[var(--mazzi-muted)]">
            <span>2 km</span>
            <span>50 km</span>
          </div>
        </div>

        {/* 6. Minimum Rating */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="mazzi-field-label flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" aria-hidden="true" />
              Avaliação Mínima
            </label>
            <span className="rounded-md border border-amber-200 bg-[var(--mazzi-yellow-soft)] px-2 py-0.5 text-xs font-bold text-[var(--mazzi-dark)]">
              {ratingValue === 0 ? 'Todas' : `${ratingValue.toFixed(1)}★`}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="5"
            step="0.1"
            value={ratingValue}
            onChange={(event) => {
              const value = Number(event.target.value);
              updateDraft({ minimumRating: value === 0 ? undefined : value });
            }}
            className={rangeClassName}
            style={{ accentColor: 'var(--mazzi-yellow)' }}
            aria-label="Avaliação mínima"
            aria-valuetext={ratingValue === 0 ? 'Todas as avaliações' : `${ratingValue.toFixed(1)} estrelas`}
          />
          <div className="mt-1 flex justify-between text-[11px] font-semibold text-[var(--mazzi-muted)]">
            <span>Todas</span>
            <span>5.0★</span>
          </div>
        </div>

        {/* 7. Price Range */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="mazzi-field-label flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
              Faixa de Preço Máxima por Aula
            </label>
            <span className="rounded-md border border-amber-200 bg-[var(--mazzi-yellow-soft)] px-2 py-0.5 text-xs font-bold text-[var(--mazzi-dark)]">
              {priceSliderValueInCents === 0 ? 'Qualquer preço' : `Até ${formatCentsToBRL(priceSliderValueInCents)}`}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max={priceSliderMaxInCents}
            step="1"
            value={priceSliderValueInCents}
            onChange={(event) => {
              const value = Number(event.target.value);
              updateDraft({ maxPriceInCents: value === 0 ? undefined : value });
            }}
            className={rangeClassName}
            style={{ accentColor: 'var(--mazzi-yellow)' }}
            aria-label="Preço máximo por aula"
            aria-valuetext={priceSliderValueInCents === 0 ? 'Qualquer preço' : `Até ${formatCentsToBRL(priceSliderValueInCents)}`}
          />
          <div className="mt-1 flex justify-between text-[11px] font-semibold text-[var(--mazzi-muted)]">
            <span>Qualquer preço</span>
            <span>Até {formatCentsToBRL(priceSliderMaxInCents)}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};

// Export alias for future or alternative naming without breaking contract
export const FilterModal = FilterDrawer;
