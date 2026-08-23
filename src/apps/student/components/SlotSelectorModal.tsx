import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Clock, RefreshCw, Check } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button, PrimaryButton, ButtonBase } from '../../../components/ui/Button';
import { supabase } from '../../../lib/supabase';
import { formatCentsToBRL } from '../../../domain/money';
import { STUDENT_BOOKING_HORIZON_DAYS } from '../../../domain/availability';
import { getTodayInSaoPaulo } from '../../../lib/date-format';

// Re-export and derive horizon constants from canonical domain source of truth
export { STUDENT_BOOKING_HORIZON_DAYS };
export const MAX_HORIZON_DAYS = STUDENT_BOOKING_HORIZON_DAYS;
export const INITIAL_WINDOW_DAYS = 30; // Progressive initial window (batch 1)
export const LOAD_MORE_DAYS = 30;      // Progressive load more batch (batch 2 to reach 60)
export const MAX_RPC_DATE_RANGE_DAYS = 31;

export type PublicSlot = {
  local_date: string;
  local_start_time: string;
  local_end_time: string;
  slot_start_at: string;
  slot_end_at?: string;
};

export function addDays(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function splitDateRange(fromDate: string, daysToFetch: number, maxRangeDays = MAX_RPC_DATE_RANGE_DAYS): Array<{ from: string; to: string }> {
  const safeDays = Math.max(0, Math.floor(daysToFetch));
  const safeRange = Math.max(1, Math.floor(maxRangeDays));
  return Array.from({ length: Math.ceil(safeDays / safeRange) }, (_, index) => {
    const startOffset = index * safeRange;
    const endOffset = Math.min(safeDays - 1, startOffset + safeRange - 1);
    return {
      from: addDays(fromDate, startOffset),
      to: addDays(fromDate, endOffset),
    };
  });
}

export function formatDateOnly(dateOnly: string, options: Intl.DateTimeFormatOptions): string {
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { ...options, timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)));
}

function weekdayIndex(dateOnly: string): number {
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function groupSlots(slots: PublicSlot[]): Record<string, PublicSlot[]> {
  return slots.reduce<Record<string, PublicSlot[]>>((acc, slot) => {
    (acc[slot.local_date] ||= []).push(slot);
    return acc;
  }, {});
}

export function timePeriod(time: string): 'Manhã' | 'Tarde' | 'Noite' {
  const hour = Number(time.slice(0, 2));
  return hour < 12 ? 'Manhã' : hour < 18 ? 'Tarde' : 'Noite';
}

export interface SlotSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  offeringId: string;
  onSelect: (slot: PublicSlot) => void;
  instructorName?: string;
  vehicleLabel?: string;
  durationMinutes?: number;
  priceInCents?: number;
  transmission?: string;
  /** Static slots for isolated visual previews. Production omits this and loads from the backend. */
  previewSlots?: PublicSlot[];
}

export const SlotSelectorModal: React.FC<SlotSelectorModalProps> = ({
  isOpen,
  onClose,
  offeringId,
  onSelect,
  instructorName,
  vehicleLabel,
  durationMinutes,
  priceInCents,
  transmission,
  previewSlots,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slotsByDate, setSlotsByDate] = useState<Record<string, PublicSlot[]>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<PublicSlot | null>(null);
  const [windowDays, setWindowDays] = useState(INITIAL_WINDOW_DAYS);
  const [visibleMonth, setVisibleMonth] = useState<string>('');

  const fromDate = useMemo(() => getTodayInSaoPaulo(), []);

  const fetchSlots = useCallback(async (daysToFetch: number, resetSelection = false) => {
    if (!offeringId) return;
    setIsLoading(true);
    setError(null);
    const ranges = splitDateRange(fromDate, daysToFetch);

    try {
      const batches = await Promise.all(ranges.map(async ({ from, to }) => {
        const { data, error: rpcError } = await (supabase as any).rpc('get_available_slots_public', {
          p_offering_id: offeringId,
          p_date_from: from,
          p_date_to: to,
        });
        if (rpcError) throw rpcError;
        return (data as PublicSlot[]) || [];
      }));

      const grouped = groupSlots(batches.flat());
      setSlotsByDate(grouped);

      const firstAvailable = Object.keys(grouped).sort()[0] || null;
      if (resetSelection) {
        setSelectedDate(firstAvailable);
        setSelectedSlot(null);
      } else {
        setSelectedDate((prev) => prev || firstAvailable);
      }

      const firstMonth = (firstAvailable || fromDate).slice(0, 7);
      setVisibleMonth((prev) => prev || firstMonth);
    } catch (err: any) {
      console.warn('[SlotSelectorModal] RPC call failed:', err);
      setError('Não foi possível carregar os horários. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }, [offeringId, fromDate]);

  useEffect(() => {
    if (isOpen && previewSlots) {
      const grouped = groupSlots(previewSlots);
      const firstAvailable = Object.keys(grouped).sort()[0] || null;
      setWindowDays(INITIAL_WINDOW_DAYS);
      setSlotsByDate(grouped);
      setSelectedDate(firstAvailable);
      setSelectedSlot(null);
      setVisibleMonth((firstAvailable || fromDate).slice(0, 7));
      setError(null);
      setIsLoading(false);
      return;
    }
    if (isOpen && offeringId) {
      setWindowDays(INITIAL_WINDOW_DAYS);
      setVisibleMonth(fromDate.slice(0, 7));
      void fetchSlots(INITIAL_WINDOW_DAYS, true);
    }
  }, [isOpen, offeringId, fromDate, fetchSlots, previewSlots]);

  const dates = useMemo(() => Array.from({ length: windowDays }, (_, index) => addDays(fromDate, index)), [fromDate, windowDays]);
  const datesByMonth = useMemo(() => dates.reduce<Record<string, string[]>>((groups, date) => {
    const key = date.slice(0, 7);
    (groups[key] ||= []).push(date);
    return groups;
  }, {}), [dates]);
  const selectedSlots = selectedDate ? (slotsByDate[selectedDate] || []) : [];
  const hasAnySlots = Object.values(slotsByDate as Record<string, PublicSlot[]>).some((slots) => slots.length > 0);
  const groupedPeriods = selectedSlots.reduce<Record<string, PublicSlot[]>>((acc, slot) => {
    (acc[timePeriod(slot.local_start_time)] ||= []).push(slot);
    return acc;
  }, {});

  const footerContent = (
    <PrimaryButton
      size="sm"
      disabled={!selectedSlot || isLoading}
      className="w-full font-bold shadow-md hover:shadow-lg transition-all rounded-2xl"
      leftIcon={<Check className="w-4 h-4 text-slate-950" aria-hidden="true" />}
      onClick={() => {
        if (selectedSlot) {
          onSelect(selectedSlot);
          onClose();
        }
      }}
      aria-label="Confirmar horário selecionado"
    >
      Confirmar Horário
    </PrimaryButton>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Escolha uma data e horário"
      size="md"
      footer={footerContent}
    >
      <div className="space-y-5 text-left" aria-busy={isLoading}>
        {/* Scrollable Body Content */}
        <div className="space-y-5">
          <div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--mazzi-dark)]">Escolha sua aula</h3>
          </div>

          {error && (
            <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between gap-3">
              <span>{error}</span>
              <ButtonBase type="button" onClick={() => void fetchSlots(windowDays, true)} className="underline flex items-center gap-1 cursor-pointer font-bold">
                <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
              </ButtonBase>
            </div>
          )}

          {isLoading && (
            <div className="rounded-2xl border border-[var(--mazzi-border)] bg-white p-5 text-center text-sm font-semibold text-slate-500">
              Carregando horários disponíveis...
            </div>
          )}

          {!isLoading && !error && !hasAnySlots && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
              <p className="text-sm font-bold text-slate-800">Nenhum horário disponível neste período.</p>
              <p className="mt-1 text-xs text-slate-500">Você pode consultar os próximos dias abaixo.</p>
            </div>
          )}

          {/* Month & Calendar Grid */}
          <div>
            {(Object.entries(datesByMonth) as [string, string[]][]).filter(([month]) => month === visibleMonth).map(([month, monthDates]) => (
              <section key={month}>
                <div className="mb-3 flex items-center justify-between">
                  <ButtonBase
                    type="button"
                    aria-label="Mês anterior"
                    disabled={Object.keys(datesByMonth).indexOf(month) <= 0}
                    onClick={() => {
                      const months = Object.keys(datesByMonth);
                      setVisibleMonth(months[months.indexOf(month) - 1]);
                    }}
                    className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--mazzi-surface-soft)] text-[var(--mazzi-dark)] transition hover:bg-slate-200 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)] cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </ButtonBase>
                  <h4 className="text-sm font-bold capitalize text-[var(--mazzi-dark)]">
                    {formatDateOnly(`${month}-01`, { month: 'long', year: 'numeric' })}
                  </h4>
                  <ButtonBase
                    type="button"
                    aria-label="Mês seguinte"
                    disabled={Object.keys(datesByMonth).indexOf(month) >= Object.keys(datesByMonth).length - 1}
                    onClick={() => {
                      const months = Object.keys(datesByMonth);
                      setVisibleMonth(months[months.indexOf(month) + 1]);
                    }}
                    className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--mazzi-surface-soft)] text-[var(--mazzi-dark)] transition hover:bg-slate-200 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)] cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </ButtonBase>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((weekday) => (
                    <span key={`${month}-${weekday}`} className="text-[10px] font-bold uppercase text-slate-400 py-1">
                      {weekday}
                    </span>
                  ))}
                  {Array.from({ length: weekdayIndex(monthDates[0]) }, (_, index) => (
                    <span key={`${month}-empty-${index}`} aria-hidden="true" />
                  ))}
                  {monthDates.map((date) => {
                    const available = (slotsByDate[date] || []).length > 0;
                    const isSelected = selectedDate === date;
                    return (
                      <ButtonBase
                        key={date}
                        type="button"
                        disabled={!available}
                        onClick={() => {
                          setSelectedDate(date);
                          setSelectedSlot(null);
                        }}
                        aria-label={`${formatDateOnly(date, { dateStyle: 'full' })}${available ? `, ${slotsByDate[date].length} horários disponíveis` : ', indisponível'}`}
                        className={`h-10 min-h-0 min-h-[44px] rounded-xl p-1 text-center transition flex flex-col items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--mazzi-dark)] cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] font-bold shadow-xs'
                            : available
                            ? 'bg-white text-[var(--mazzi-dark)] font-bold hover:bg-slate-100 border border-[var(--mazzi-border)]'
                            : 'text-slate-300 cursor-not-allowed bg-slate-50/50'
                        }`}
                      >
                        <span className="text-sm font-bold leading-none">{formatDateOnly(date, { day: '2-digit' })}</span>
                      </ButtonBase>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {windowDays < MAX_HORIZON_DAYS && (
            <ButtonBase
              type="button"
              disabled={isLoading}
              onClick={() => {
                const next = Math.min(MAX_HORIZON_DAYS, windowDays + LOAD_MORE_DAYS);
                setWindowDays(next);
                void fetchSlots(next, false);
              }}
              className="flex w-full cursor-pointer items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-[var(--mazzi-muted)] transition hover:text-[var(--mazzi-dark)]"
            >
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
              Carregar meses seguintes
            </ButtonBase>
          )}

          {/* Time Slots Section */}
          {selectedDate && (
            <div className="pt-2 border-t border-[var(--mazzi-border)]">
              <h3 className="font-bold text-sm text-[var(--mazzi-dark)] mb-2.5">
                {formatDateOnly(selectedDate, { dateStyle: 'full' })}
              </h3>
              {selectedSlots.length === 0 ? (
                <p className="text-xs text-slate-500 font-medium">Nenhum horário disponível neste dia.</p>
              ) : (
                <div className="space-y-3">
                  {(['Manhã', 'Tarde', 'Noite'] as const)
                    .filter((period) => groupedPeriods[period]?.length)
                    .map((period) => (
                      <div key={period}>
                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">{period}</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {groupedPeriods[period].map((slot) => {
                            const isSelected = selectedSlot?.slot_start_at === slot.slot_start_at;
                            return (
                              <ButtonBase
                                key={slot.slot_start_at}
                                type="button"
                                aria-pressed={isSelected}
                                onClick={() => setSelectedSlot(slot)}
                                className={`min-h-11 rounded-xl border px-3 py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)] ${
                                  isSelected
                                    ? 'border-amber-400/80 bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] font-bold shadow-xs'
                                    : 'border-[var(--mazzi-border)] bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                                }`}
                              >
                                <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span>{slot.local_start_time.substring(0, 5)}</span>
                              </ButtonBase>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Selection Summary (Clearly grounded within the content, never covered) */}
          <div className="p-3.5 rounded-2xl bg-[var(--mazzi-surface-soft)] border border-[var(--mazzi-border)] text-xs text-slate-700 space-y-1">
            <p className="font-bold text-[var(--mazzi-dark)]">Resumo da seleção</p>
            {instructorName && (
              <p>
                <span className="text-slate-500 font-medium">Instrutor:</span> <strong>{instructorName}</strong>
              </p>
            )}
            <p>
              <span className="text-slate-500 font-medium">Data:</span>{' '}
              <strong>{selectedDate ? formatDateOnly(selectedDate, { dateStyle: 'short' }) : '—'}</strong>
            </p>
            <p>
              <span className="text-slate-500 font-medium">Horário:</span>{' '}
              <strong>{selectedSlot?.local_start_time?.substring(0, 5) || '—'}</strong>
            </p>
            {vehicleLabel && (
              <p>
                <span className="text-slate-500 font-medium">Veículo:</span> {vehicleLabel}
              </p>
            )}
            {transmission && (
              <p>
                <span className="text-slate-500 font-medium">Câmbio:</span>{' '}
                {transmission === 'AUTOMATIC' ? 'Automático' : 'Manual'}
              </p>
            )}
            {durationMinutes && (
              <p>
                <span className="text-slate-500 font-medium">Duração:</span> {durationMinutes} minutos
              </p>
            )}
            {typeof priceInCents === 'number' && (
              <p>
                <span className="text-slate-500 font-medium">Preço:</span>{' '}
                <strong>{formatCentsToBRL(priceInCents)}</strong>
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
