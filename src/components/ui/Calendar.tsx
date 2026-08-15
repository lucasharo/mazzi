import React from 'react';

export interface CalendarProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  availableDates?: string[];
  id?: string;
}

export const Calendar: React.FC<CalendarProps> = ({
  selectedDate,
  onSelectDate,
  availableDates = [],
  id,
}) => {
  // Generate next 14 days starting today
  const days: { dateStr: string; dayOfWeek: string; dayNumber: number; monthName: string; isAvailable: boolean }[] = [];
  const today = new Date();

  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const dayOfWeek = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    const dayNumber = d.getDate();
    const monthName = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    const isAvailable = availableDates.length === 0 || availableDates.includes(dateStr);

    days.push({ dateStr, dayOfWeek, dayNumber, monthName, isAvailable });
  }

  return (
    <div id={id || 'mazzi-calendar'} className="w-full space-y-2 select-none">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Selecione o Dia
        </span>
        <span className="text-xs text-slate-500 font-medium">Próximos 14 dias</span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {days.map((item) => {
          const isSelected = selectedDate === item.dateStr;
          return (
            <button
              type="button"
              key={item.dateStr}
              disabled={!item.isAvailable}
              onClick={() => onSelectDate(item.dateStr)}
              className={`flex-shrink-0 flex flex-col items-center justify-center w-14 h-18 rounded-2xl border transition-all text-center p-2 focus:outline-none cursor-pointer ${
                isSelected
                  ? 'bg-amber-400 border-amber-400 text-slate-950 shadow-sm ring-2 ring-amber-400/40 font-extrabold scale-102'
                  : item.isAvailable
                  ? 'bg-white border-slate-200 text-slate-800 hover:border-amber-400 hover:bg-amber-50/40'
                  : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
              }`}
            >
              <span className={`text-[10px] uppercase font-bold ${isSelected ? 'text-slate-950/80' : 'text-slate-400'}`}>
                {item.dayOfWeek}
              </span>
              <span className="text-lg font-black leading-tight my-0.5">
                {item.dayNumber}
              </span>
              <span className={`text-[10px] uppercase font-semibold ${isSelected ? 'text-slate-950/80' : 'text-slate-400'}`}>
                {item.monthName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
