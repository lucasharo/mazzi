import React from 'react';
import { Check, Infinity } from 'lucide-react';
import type { InstantLessonPriceOption } from '../../types';
import { formatCentsToBRL } from '../../domain/money';
import { ButtonBase } from '../ui/Button';
import { instantOptionClassName } from './instant-option-style';

interface InstantLessonPriceSelectorProps {
  options: InstantLessonPriceOption[];
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export const InstantLessonPriceSelector: React.FC<InstantLessonPriceSelectorProps> = ({ options, value, onChange, disabled, isLoading }) => (
  <fieldset className="space-y-2" disabled={disabled || isLoading} aria-busy={isLoading}>
    <legend className="text-sm font-extrabold text-[var(--mazzi-dark)]">Quanto você aceita pagar?</legend>
    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Teto de preço da Aula Agora">
      {options.map((option) => {
        const selected = option.maxPriceInCents === value;
        const label = option.maxPriceInCents == null ? 'Sem limite' : `Até ${formatCentsToBRL(option.maxPriceInCents)}`;
        return (
          <ButtonBase
            key={option.maxPriceInCents == null ? 'unlimited' : option.maxPriceInCents}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.maxPriceInCents)}
            className={instantOptionClassName(selected)}
          >
            <span className="flex min-w-0 items-center gap-2">
              {option.maxPriceInCents == null ? <Infinity className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
              <span>
                <span className="block text-sm font-extrabold">{label}</span>
                <span className="block text-xs font-semibold text-slate-500">{option.eligibleProviderCount} {option.eligibleProviderCount === 1 ? 'profissional' : 'profissionais'}</span>
              </span>
            </span>
            {selected && <Check className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />}
          </ButtonBase>
        );
      })}
    </div>
  </fieldset>
);
