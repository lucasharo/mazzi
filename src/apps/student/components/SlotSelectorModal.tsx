import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronDown, Clock, RefreshCw } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { supabase } from '../../../lib/supabase';
import { dbService } from '../../../lib/db-service';
import { formatCentsToBRL } from '../../../domain/money';

const INITIAL_WINDOW_DAYS = 30;
const LOAD_MORE_DAYS = 30;
const MAX_HORIZON_DAYS = 90;

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
}

export const SlotSelectorModal: React.FC<SlotSelectorModalProps> = ({ isOpen, onClose, offeringId, onSelect, instructorName, vehicleLabel, durationMinutes, priceInCents }) => {
  const [slotsByDate, setSlotsByDate] = useState<Record<string, PublicSlot[]>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<PublicSlot | null>(null);
  const [windowDays, setWindowDays] = useState(INITIAL_WINDOW_DAYS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fromDate = useMemo(() => dateOnlyFromDate(new Date()), []);

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
        setSelectedDate(firstAvailable || fromDate);
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
    void fetchSlots(INITIAL_WINDOW_DAYS, true);
  }, [fetchSlots, isOpen]);

  const dates = useMemo(() => Array.from({ length: windowDays }, (_, index) => addDays(fromDate, index)), [fromDate, windowDays]);
  const datesByMonth = useMemo(() => dates.reduce<Record<string, string[]>>((groups, date) => {
    const key = date.slice(0, 7);
    (groups[key] ||= []).push(date);
    return groups;
  }, {}), [dates]);
  const selectedSlots = selectedDate ? (slotsByDate[selectedDate] || []) : [];
  const groupedPeriods = selectedSlots.reduce<Record<string, PublicSlot[]>>((acc, slot) => {
    (acc[timePeriod(slot.local_start_time)] ||= []).push(slot);
    return acc;
  }, {});

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Escolha o horário" size="md">
      <div className="space-y-5 p-4" aria-busy={isLoading}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-slate-800">Escolha o dia</h3>
            <p className="text-xs text-slate-500 mt-1">Mostrando os próximos {windowDays} dias</p>
          </div>
          <Calendar className="w-5 h-5 text-amber-500" />
        </div>

        {error && (
          <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-between gap-3">
            <span>{error}</span>
            <button type="button" onClick={() => void fetchSlots(windowDays, true)} className="underline flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Tentar novamente</button>
          </div>
        )}

        <div className="max-h-72 overflow-y-auto pr-1 space-y-4">
          {(Object.entries(datesByMonth) as [string, string[]][]).map(([month, monthDates]) => <section key={month}>
            <h4 className="mb-2 text-xs font-black capitalize text-slate-700">{formatDateOnly(`${month}-01`, { month: 'long', year: 'numeric' })}</h4>
            <div className="grid grid-cols-7 gap-1.5 text-center">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((weekday) => <span key={`${month}-${weekday}`} className="text-[8px] font-black uppercase text-slate-400">{weekday}</span>)}
            {Array.from({ length: weekdayIndex(monthDates[0]) }, (_, index) => <span key={`${month}-empty-${index}`} aria-hidden="true" />)}
            {monthDates.map((date) => {
            const available = (slotsByDate[date] || []).length > 0;
            return (
              <button key={date} type="button" disabled={!available} onClick={() => { setSelectedDate(date); setSelectedSlot(null); }} aria-label={`${formatDateOnly(date, { dateStyle: 'full' })}${available ? '' : ', indisponível'}`} className={`h-9 min-h-0 rounded-lg border p-0.5 text-center transition ${selectedDate === date ? 'border-amber-500 bg-amber-50 text-slate-950 ring-2 ring-amber-400/30' : available ? 'border-slate-200 bg-white hover:border-amber-300 text-slate-700' : 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'}`}>
                <span className="text-[9px] uppercase font-bold block">{formatDateOnly(date, { weekday: 'short' }).replace('.', '')}</span>
                <span className="text-sm font-black block leading-tight">{formatDateOnly(date, { day: '2-digit' })}</span>
                <span className="text-[9px] font-bold leading-tight">{available ? `${slotsByDate[date].length}` : '—'}</span>
              </button>
            );
            })}
            </div>
          </section>)}
        </div>

        {windowDays < MAX_HORIZON_DAYS && (
          <button type="button" disabled={isLoading} onClick={() => { const next = Math.min(MAX_HORIZON_DAYS, windowDays + LOAD_MORE_DAYS); setWindowDays(next); void fetchSlots(next, false); }} className="w-full py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:border-amber-300 flex items-center justify-center gap-1">
            Ver próximos {LOAD_MORE_DAYS} dias <ChevronDown className="w-4 h-4" />
          </button>
        )}

        {selectedDate && (
          <div>
            <h3 className="font-bold text-sm text-slate-700 mb-3">{formatDateOnly(selectedDate, { dateStyle: 'full' })}</h3>
            {selectedSlots.length === 0 ? <p className="text-xs text-slate-500">Nenhum horário disponível neste dia.</p> : (
              <div className="space-y-3">
                {(['Manhã', 'Tarde', 'Noite'] as const).filter((period) => groupedPeriods[period]?.length).map((period) => (
                  <div key={period}>
                    <p className="text-[10px] uppercase font-black text-slate-400 mb-1">{period}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {groupedPeriods[period].map((slot) => <button key={slot.slot_start_at} type="button" onClick={() => setSelectedSlot(slot)} className={`p-2 rounded-xl border font-bold transition text-sm ${selectedSlot?.slot_start_at === slot.slot_start_at ? 'border-amber-500 bg-amber-400 text-slate-950' : 'border-slate-200 bg-white hover:border-amber-300 text-slate-700'}`}><Clock className="w-3 h-3 inline mr-1" />{slot.local_start_time.substring(0, 5)}</button>)}
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
          {durationMinutes && <p>Duração: {durationMinutes} minutos</p>}
          {typeof priceInCents === 'number' && <p>Preço: {formatCentsToBRL(priceInCents)}</p>}
        </div>

        <Button disabled={!selectedSlot || isLoading} className="w-full" onClick={() => { if (selectedSlot) { onSelect(selectedSlot); onClose(); } }}>Continuar</Button>
      </div>
    </Modal>
  );
};
