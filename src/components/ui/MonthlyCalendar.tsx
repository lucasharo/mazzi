import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ButtonBase } from './Button';

export interface MonthlyCalendarProps {
  month: string;
  dates: string[];
  selectedDate: string;
  isDateAvailable: (date: string) => boolean;
  onSelectDate: (date: string) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  canPrevious?: boolean;
  canNext?: boolean;
  nextMonthLoading?: boolean;
}

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(monthNumber) || monthNumber < 1 || monthNumber > 12) return '';
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, monthNumber - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatDate(date: string, options: Intl.DateTimeFormatOptions): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { ...options, timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

function weekdayIndex(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export const MonthlyCalendar: React.FC<MonthlyCalendarProps> = ({
  month,
  dates,
  selectedDate,
  isDateAvailable,
  onSelectDate,
  onPreviousMonth,
  onNextMonth,
  canPrevious = true,
  canNext = true,
  nextMonthLoading = false,
}) => {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  // The grid offset must always be based on the first day of the month.
  // Using the first loaded/available date shifts weekdays when the horizon
  // starts after day 1 (for example, 07/09/2026 is a Monday).
  const firstDate = `${month}-01`;
  const daysInMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();

  return (
    <section className="space-y-2">
      <div className="mb-2 flex items-center justify-between">
        <ButtonBase type="button" aria-label="Mês anterior" disabled={!canPrevious} onClick={onPreviousMonth}
          className="grid h-9 w-9 place-items-center rounded-[0.8rem] bg-[var(--mazzi-surface-soft)] text-[var(--mazzi-dark)] transition hover:bg-slate-200 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)]">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </ButtonBase>
        <h4 className="text-[13px] font-bold text-[var(--mazzi-dark)]">{formatMonth(month)}</h4>
        <ButtonBase type="button" aria-label="Mês seguinte" disabled={!canNext || nextMonthLoading} onClick={onNextMonth}
          className="grid h-9 w-9 place-items-center rounded-[0.8rem] bg-[var(--mazzi-surface-soft)] text-[var(--mazzi-dark)] transition hover:bg-slate-200 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)]">
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </ButtonBase>
      </div>
      <div className="grid grid-cols-7 gap-px text-center">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((weekday) => (
          <span key={`${month}-${weekday}`} className="py-0 text-[9px] font-bold uppercase text-slate-400">{weekday}</span>
        ))}
        {Array.from({ length: weekdayIndex(firstDate) }, (_, index) => <span key={`${month}-empty-${index}`} aria-hidden="true" />)}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const date = `${month}-${String(index + 1).padStart(2, '0')}`;
          const available = isDateAvailable(date);
          const isSelected = selectedDate === date;
          return (
            <ButtonBase key={date} type="button" disabled={!available} onClick={() => onSelectDate(date)}
              aria-label={`${formatDate(date, { dateStyle: 'full' })}${available ? ', disponível' : ', indisponível'}`} aria-pressed={isSelected}
              className={`h-9 min-h-0 rounded-md p-1 text-center transition flex flex-col items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--mazzi-dark)] ${
                isSelected ? 'bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] font-bold shadow-xs' : available ? 'bg-white text-[var(--mazzi-dark)] font-bold hover:bg-slate-100 border border-[var(--mazzi-border)]' : 'text-slate-300 cursor-not-allowed bg-slate-50/50'
              }`}>
              <span className="text-xs font-bold leading-none">{String(index + 1).padStart(2, '0')}</span>
            </ButtonBase>
          );
        })}
      </div>
    </section>
  );
};
