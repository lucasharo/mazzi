import React from 'react';
import { ButtonBase } from './Button';

export interface ReasonChipOption<T extends string = string> {
  value: T;
  label: string;
}

interface ReasonChipsProps<T extends string> {
  options: ReasonChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
}

export function ReasonChips<T extends string>({ options, value, onChange, ariaLabel = 'Motivos' }: ReasonChipsProps<T>) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <ButtonBase
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`min-h-0 rounded-full px-2.5 py-1.5 text-[11px] leading-tight font-semibold transition focus-visible:outline-amber-400 ${selected ? 'bg-[#f6c945] text-slate-950 shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            {option.label}
          </ButtonBase>
        );
      })}
    </div>
  );
}
