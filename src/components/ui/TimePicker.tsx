import React from 'react';
import { Clock } from 'lucide-react';

export interface TimeSlot {
  startTime: string; // "08:00"
  endTime: string; // "08:50"
  isAvailable: boolean;
  isBooked?: boolean;
}

export interface TimePickerProps {
  slots: TimeSlot[];
  selectedSlot?: TimeSlot | null;
  onSelectSlot: (slot: TimeSlot) => void;
  id?: string;
}

export const TimePicker: React.FC<TimePickerProps> = ({
  slots,
  selectedSlot,
  onSelectSlot,
  id,
}) => {
  return (
    <div id={id || 'mazzi-time-picker'} className="w-full space-y-2 select-none text-left">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-amber-500" />
          Horários Disponíveis
        </span>
        <span className="text-xs text-slate-500 font-medium">
          {slots.filter((s) => s.isAvailable && !s.isBooked).length} vagas livres
        </span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {slots.map((slot) => {
          const isSelected =
            selectedSlot?.startTime === slot.startTime &&
            selectedSlot?.endTime === slot.endTime;
          const isBlocked = !slot.isAvailable || slot.isBooked;

          return (
            <button
              type="button"
              key={`${slot.startTime}-${slot.endTime}`}
              disabled={isBlocked}
              onClick={() => onSelectSlot(slot)}
              className={`py-2.5 px-2 rounded-2xl text-center border font-bold text-xs transition-all focus:outline-none cursor-pointer ${
                isSelected
                  ? 'bg-amber-400 border-amber-400 text-slate-950 shadow-sm ring-2 ring-amber-400/40 font-extrabold'
                  : isBlocked
                  ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed line-through'
                  : 'bg-white border-slate-200 text-slate-800 hover:border-amber-400 hover:bg-amber-50/40'
              }`}
            >
              <span>{slot.startTime}</span>
              <span className={`block text-[10px] ${isSelected ? 'text-slate-900 font-medium' : 'text-slate-400 font-normal'}`}>
                até {slot.endTime}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
