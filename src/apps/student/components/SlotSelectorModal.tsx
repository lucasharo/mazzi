import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, RefreshCw } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { supabase } from '../../../lib/supabase';
import { dbService } from '../../../lib/db-service';
import { formatCentsToBRL } from '../../../domain/money';

export const INITIAL_WINDOW_DAYS = 30;
export const LOAD_MORE_DAYS = 30;
export const MAX_HORIZON_DAYS = 90;

type PublicSlot = {
  local_date: string;
  local_start_time: string;
  local_end_time: string;
  slot_start_at: string;
  slot_end_at?: string;
};

function dateOnlyFromDate(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export function addDays(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
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
}

export const SlotSelectorModal: React.FC<SlotSelectorModalProps> = ({ isOpen, onClose, offeringId, onSelect, instructorName, vehicleLabel, durationMinutes, priceInCents, transmission }) => {
  const [slotsByDate, setSlotsByDate] = useState<Record<string, PublicSlot[]>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<PublicSlot | null>(null);
  const [windowDays, setWindowDays] = useState(INITIAL_WINDOW_DAYS);
  const [visibleMonth, setVisibleMonth] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fromDate = useMemo(() => dateOnlyFromDate(new Date()), [isOpen]);

  const fetchSlots = useCallback(async (days: number, replace: boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      const toDate = addDays(fromDate, days - 1);
      const { data, error: rpcError } = await (supabase as any).rpc('get_available_slots_public', {
        p_offering_id: offeringId,
        // Keep DATE parameters timezone-independent; do not pass browser Date objects.
        p_date_from: replace ? fromDate : addDays(fromDate, days - LOAD_MORE_DAYS),
        p_date_to: toDate,
      });
      if (rpcError) throw rpcError;
      const incoming = (data || []) as PublicSlot[];
      setSlotsByDate((previous) => replace ? groupSlots(incoming) : {
        ...previous,
        ...groupSlots(incoming),
      });
      if (replace) {
        const grouped = groupSlots(incoming);
        const firstAvailable = Object.keys(grouped).sort()[0];
        setSelectedDate(firstAvailable || null);
        setSelectedSlot(null);
        void dbService.trackAnalyticsEvent('AVAILABLE_SLOTS_VIEW', {
          slot_count: incoming.length,
          date_count: Object.keys(grouped).length,
        }).catch(() => undefined);
      }
    } catch (cause) {
      console.error('Failed to fetch slots', cause);
      setError('Não foi possível carregar os horários agora.');
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, offeringId]);

  useEffect(() => {
    if (!isOpen) return;
    setWindowDays(INITIAL_WINDOW_DAYS);
    setSlotsByDate({});
    setSelectedDate(null);
    setSelectedSlot(null);
    setVisibleMonth(fromDate.slice(0, 7));
    void fetchSlots(INITIAL_WINDOW_DAYS, true);
  }, [fetchSlots, isOpen]);

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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Escolha uma data e horário" size="md">
      <div className="space-y-5" aria-busy={isLoading}>
        <div><h3 className="text-2xl font-extrabold tracking-tight">Escolha sua aula</h3></div>

        {error && (
          <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-between gap-3">
            <span>{error}</span>
            <button type="button" onClick={() => void fetchSlots(windowDays, true)} className="underline flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Tentar novamente</button>
          </div>
        )}

        {isLoading && <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center text-sm font-bold text-slate-500">Carregando horários disponíveis...</div>}

        {!isLoading && !error && !hasAnySlots && <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center"><p className="text-sm font-black text-slate-800">Nenhum horário disponível neste período.</p><p className="mt-1 text-xs text-slate-500">Você pode consultar os próximos dias abaixo.</p></div>}

        <div>
          {(Object.entries(datesByMonth) as [string, string[]][]).filter(([month]) => month === visibleMonth).map(([month, monthDates], _index, entries) => <section key={month}>
            <div className="mb-4 flex items-center justify-between"><button type="button" aria-label="Mês anterior" disabled={Object.keys(datesByMonth).indexOf(month) <= 0} onClick={() => { const months=Object.keys(datesByMonth); setVisibleMonth(months[months.indexOf(month)-1]); }} className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--mazzi-surface-soft)] disabled:opacity-30"><ChevronLeft className="h-4 w-4"/></button><h4 className="text-sm font-extrabold capitalize">{formatDateOnly(`${month}-01`, { month: 'long', year: 'numeric' })}</h4><button type="button" aria-label="Mês seguinte" disabled={Object.keys(datesByMonth).indexOf(month) >= Object.keys(datesByMonth).length-1} onClick={() => { const months=Object.keys(datesByMonth); setVisibleMonth(months[months.indexOf(month)+1]); }} className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--mazzi-surface-soft)] disabled:opacity-30"><ChevronRight className="h-4 w-4"/></button></div>
            <div className="grid grid-cols-7 gap-1.5 text-center">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((weekday) => <span key={`${month}-${weekday}`} className="text-[8px] font-black uppercase text-slate-400">{weekday}</span>)}
            {Array.from({ length: weekdayIndex(monthDates[0]) }, (_, index) => <span key={`${month}-empty-${index}`} aria-hidden="true" />)}
            {monthDates.map((date) => {
            const available = (slotsByDate[date] || []).length > 0;
            return (
              <button key={date} type="button" disabled={!available} onClick={() => { setSelectedDate(date); setSelectedSlot(null); }} aria-label={`${formatDateOnly(date, { dateStyle: 'full' })}${available ? `, ${slotsByDate[date].length} horários disponíveis` : ', indisponível'}`} className={`h-10 min-h-0 rounded-xl p-0.5 text-center transition ${selectedDate === date ? 'bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] shadow-sm' : available ? 'bg-white text-[var(--mazzi-text)]' : 'text-stone-300 cursor-not-allowed'}`}>
                <span className="text-sm font-black leading-tight">{formatDateOnly(date, { day: '2-digit' })}</span>
              </button>
            );
            })}
            </div>
          </section>)}
        </div>

        {windowDays < MAX_HORIZON_DAYS && <button type="button" disabled={isLoading} onClick={() => { const next = Math.min(MAX_HORIZON_DAYS, windowDays + LOAD_MORE_DAYS); setWindowDays(next); void fetchSlots(next, false); }} className="w-full py-2 text-xs font-bold text-[var(--mazzi-muted)]">Carregar meses seguintes</button>}

        {selectedDate && (
          <div>
            <h3 className="font-bold text-sm text-slate-700 mb-3">{formatDateOnly(selectedDate, { dateStyle: 'full' })}</h3>
            {selectedSlots.length === 0 ? <p className="text-xs text-slate-500">Nenhum horário disponível neste dia.</p> : (
              <div className="space-y-3">
                {(['Manhã', 'Tarde', 'Noite'] as const).filter((period) => groupedPeriods[period]?.length).map((period) => (
                  <div key={period}>
                    <p className="text-[10px] uppercase font-black text-slate-400 mb-1">{period}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {groupedPeriods[period].map((slot) => <button key={slot.slot_start_at} type="button" aria-pressed={selectedSlot?.slot_start_at === slot.slot_start_at} onClick={() => setSelectedSlot(slot)} className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-black transition ${selectedSlot?.slot_start_at === slot.slot_start_at ? 'border-amber-500 bg-amber-400 text-slate-950' : 'border-slate-200 bg-white text-slate-700 hover:border-amber-300'}`}><Clock className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />{slot.local_start_time.substring(0, 5)}</button>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
          <p className="font-bold">Resumo da seleção</p>
          {instructorName && <p>Instrutor: {instructorName}</p>}
          <p className="mt-1">Data: {selectedDate ? formatDateOnly(selectedDate, { dateStyle: 'short' }) : '—'}</p>
          <p>Horário: {selectedSlot?.local_start_time?.substring(0, 5) || '—'}</p>
          {vehicleLabel && <p>Veículo: {vehicleLabel}</p>}
          {transmission && <p>Câmbio: {transmission === 'AUTOMATIC' ? 'Automático' : 'Manual'}</p>}
          {durationMinutes && <p>Duração: {durationMinutes} minutos</p>}
          {typeof priceInCents === 'number' && <p>Preço: {formatCentsToBRL(priceInCents)}</p>}
        </div>

        <Button disabled={!selectedSlot || isLoading} className="w-full" onClick={() => { if (selectedSlot) { onSelect(selectedSlot); onClose(); } }}>Continuar</Button>
      </div>
    </Modal>
  );
};
