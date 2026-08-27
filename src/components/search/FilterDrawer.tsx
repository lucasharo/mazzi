import React, { useState, useEffect } from 'react';
import { Calendar, Car, DollarSign, MapPin, ShieldCheck, Star, Check, ArrowUpDown, RotateCcw, } from 'lucide-react';
import { Button, PrimaryButton, SecondaryButton, ButtonBase } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { SearchRequest } from '../../types';
import { DEFAULT_SEARCH_RADIUS_METERS } from '../../domain/search';
import { getBusinessDateOnly } from '../../lib/date-format';

export interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters?: Partial<SearchRequest>;
  searchRequest?: Partial<SearchRequest>;
  onApplyFilters: (filters: Partial<SearchRequest>) => void;
  onResetFilters?: () => void;
}

export const FilterDrawer: React.FC<FilterDrawerProps> = ({
  isOpen,
  onClose,
  filters,
  searchRequest,
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
          <div className="flex items-center justify-between mb-2">
          <label className="mazzi-field-label flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
              Raio Máximo de Busca
            </label>
            <span className="text-xs font-bold text-[var(--mazzi-dark)] bg-[var(--mazzi-surface-soft)] px-2 py-0.5 rounded-md border border-[var(--mazzi-border)]">
              {((currentDraft.radiusMeters || DEFAULT_SEARCH_RADIUS_METERS) / 1000).toFixed(0)} km
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {[2000, 5000, 10000, 20000, 50000].map((rMeters) => {
              const active = (currentDraft.radiusMeters || DEFAULT_SEARCH_RADIUS_METERS) === rMeters;
              return (
                <ButtonBase
                  key={rMeters}
                  type="button"
                  onClick={() => updateDraft({ radiusMeters: rMeters })}
                  aria-pressed={active}
                  className={`min-h-11 rounded-xl text-xs border transition cursor-pointer flex items-center justify-center gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)] ${
                    active
                      ? 'border-amber-400 bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] font-bold shadow-xs'
                      : 'border-[var(--mazzi-border)] bg-white text-slate-700 font-semibold hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {rMeters / 1000}km
                </ButtonBase>
              );
            })}
          </div>
        </div>

        {/* 6. Minimum Rating */}
        <div>
          <label className="mazzi-field-label flex items-center gap-1.5 mb-2">
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" aria-hidden="true" />
            Avaliação Mínima
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { val: undefined, label: 'Todas' },
              { val: 4.0, label: '4.0★' },
              { val: 4.5, label: '4.5★' },
              { val: 4.8, label: '4.8★' },
            ].map((rate) => {
              const active = currentDraft.minimumRating === rate.val;
              return (
                <ButtonBase
                  key={rate.label}
                  type="button"
                  onClick={() => updateDraft({ minimumRating: rate.val })}
                  aria-pressed={active}
                  className={`min-h-11 rounded-xl border text-center text-xs transition cursor-pointer flex items-center justify-center gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)] ${
                    active
                      ? 'border-amber-400 bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] font-bold shadow-xs'
                      : 'border-[var(--mazzi-border)] bg-white text-slate-700 font-semibold hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" aria-hidden="true" />
                  <span>{rate.label}</span>
                </ButtonBase>
              );
            })}
          </div>
        </div>

        {/* 7. Price Range */}
        <div>
          <label className="mazzi-field-label flex items-center gap-1.5 mb-2">
            <DollarSign className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
            Faixa de Preço Máxima por Aula
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { maxInCents: undefined, label: 'Qualquer Preço' },
              { maxInCents: 10000, label: 'Até R$ 100' },
              { maxInCents: 15000, label: 'Até R$ 150' },
            ].map((p) => {
              const active = currentDraft.maxPriceInCents === p.maxInCents;
              return (
                <ButtonBase
                  key={p.label}
                  type="button"
                  onClick={() => updateDraft({ maxPriceInCents: p.maxInCents })}
                  aria-pressed={active}
                  className={`min-h-11 rounded-xl border px-2 py-2 text-center text-xs transition cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)] ${
                    active
                      ? 'border-amber-400 bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] font-bold shadow-xs'
                      : 'border-[var(--mazzi-border)] bg-white text-slate-700 font-semibold hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <DollarSign className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {p.label}
                </ButtonBase>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
};

// Export alias for future or alternative naming without breaking contract
export const FilterModal = FilterDrawer;
