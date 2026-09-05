import React, { useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { ButtonBase } from '../ui/Button';
import { MonthlyCalendar } from '../ui/MonthlyCalendar';
import { EmergencyBlockableSlot, selectContiguousHourRange } from '../../domain/emergency-block';
import { getTodayInSaoPaulo } from '../../lib/date-format';

function formatSelectedDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

export const DateTimeSlotPicker: React.FC<{ slotsByDate: Record<string, EmergencyBlockableSlot[]>; selectedDate: string; selectedSlot?: EmergencyBlockableSlot | null; selectedSlots?: EmergencyBlockableSlot[]; selectionMode?: 'single' | 'hour-range'; onDateChange: (date: string) => void; onSlotChange?: (slot: EmergencyBlockableSlot) => void; onSlotsChange?: (slots: EmergencyBlockableSlot[]) => void; maxHorizonDays?: number; }> = ({ slotsByDate, selectedDate, selectedSlot = null, selectedSlots = [], selectionMode = 'single', onDateChange, onSlotChange, onSlotsChange, maxHorizonDays = 30 }) => {
  const businessToday = getTodayInSaoPaulo();
  const initialDate = selectedDate || businessToday;
  const [month, setMonth] = useState(() => new Date(`${initialDate}T12:00:00-03:00`));
  const dates = useMemo(() => Array.from({ length: maxHorizonDays }, (_, index) => getTodayInSaoPaulo(new Date(Date.parse(`${businessToday}T12:00:00-03:00`) + index * 86400000))), [businessToday, maxHorizonDays]);
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const slots = slotsByDate[selectedDate] || [];
  const groups = { Manhã: slots.filter((slot) => Number(slot.startTime.slice(0, 2)) < 12), Tarde: slots.filter((slot) => Number(slot.startTime.slice(0, 2)) >= 12 && Number(slot.startTime.slice(0, 2)) < 18), Noite: slots.filter((slot) => Number(slot.startTime.slice(0, 2)) >= 18) };
  return <div className="space-y-4">
    <MonthlyCalendar
      month={monthKey}
      dates={dates}
      selectedDate={selectedDate}
      isDateAvailable={(date) => dates.includes(date) && (slotsByDate[date]?.length || 0) > 0}
      onSelectDate={onDateChange}
      onPreviousMonth={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
      onNextMonth={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
    />
    {selectedDate && <div className="space-y-3 border-t border-[var(--mazzi-border)] pt-1.5"><h3 className="mb-2 text-[13px] font-bold text-[var(--mazzi-dark)]"><span className="sr-only">Horários livres</span>{formatSelectedDate(selectedDate)}</h3>{Object.entries(groups).map(([label, grouped]) => grouped.length > 0 && <div key={label} className="space-y-2"><p className="mb-1 text-[9px] font-bold uppercase text-slate-400">{label}</p><div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">{grouped.map((slot) => { const isSelected = selectionMode === 'hour-range' ? selectedSlots.some((item) => item.startAt === slot.startAt) : selectedSlot?.startAt === slot.startAt; return <ButtonBase key={slot.startAt} type="button" aria-label={`Selecionar ${slot.startTime} até ${slot.endTime}`} aria-pressed={isSelected} onClick={() => { if (selectionMode === 'single') { onSlotChange?.(slot); return; } onSlotsChange?.(selectContiguousHourRange({ availableSlots: slotsByDate[selectedDate] || [], selectedSlots, clickedSlot: slot })); }} className={`min-h-11 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition flex items-center justify-center gap-1 ${isSelected ? 'border-[var(--mazzi-yellow)] bg-[var(--mazzi-yellow)] text-slate-900 shadow-xs' : 'border-[var(--mazzi-border)] bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'}`}><Clock className="h-3 w-3 shrink-0" /><span className="font-bold">{slot.startTime}</span></ButtonBase>; })}</div></div>)}</div>}
  </div>;
};
