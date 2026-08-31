import React, { useEffect, useState } from 'react';
import { Check, CheckCircle2, X } from 'lucide-react';
import { LocationSuggestion } from '../../domain/maps/geocoding-provider';
import { ButtonBase } from '../ui/Button';
import { AddressAutocomplete } from './AddressAutocomplete';

export interface ConfirmableAddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onConfirm: (suggestion: LocationSuggestion | null, value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  inputClassName?: string;
  proximity?: { longitude: number; latitude: number };
  dropdownAlignment?: 'input' | 'viewport';
}

/**
 * Address field with an explicit confirmation state, similar to a navigation
 * app: choosing a suggestion fills the field, then the student confirms it.
 */
export const ConfirmableAddressAutocomplete: React.FC<ConfirmableAddressAutocompleteProps> = ({
  value,
  onChange,
  onConfirm,
  onClear,
  placeholder = 'Digite um endereço, bairro ou local',
  ariaLabel = 'Buscar endereço ou local',
  className = '',
  inputClassName = '',
  proximity,
  dropdownAlignment = 'input',
}) => {
  const [pendingSuggestion, setPendingSuggestion] = useState<LocationSuggestion | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);

  useEffect(() => {
    if (!value.trim()) {
      setPendingSuggestion(null);
      setIsConfirmed(false);
    }
  }, [value]);

  const handleChange = (nextValue: string) => {
    setPendingSuggestion(null);
    setIsConfirmed(false);
    onChange(nextValue);
  };

  const handleSelect = (suggestion: LocationSuggestion) => {
    setPendingSuggestion(suggestion);
    setIsConfirmed(false);
  };

  const handleConfirm = () => {
    const nextValue = value.trim();
    if (!nextValue) return;
    setIsConfirmed(true);
    onConfirm(pendingSuggestion, nextValue);
  };

  const handleClear = () => {
    setPendingSuggestion(null);
    setIsConfirmed(false);
    onChange('');
    onClear?.();
  };

  return (
    <div className={`relative ${className}`}>
      <AddressAutocomplete
        value={value}
        onChange={handleChange}
        onSelect={handleSelect}
        placeholder={placeholder}
        ariaLabel={ariaLabel}
        proximity={proximity}
        dropdownAlignment={dropdownAlignment}
        showClearButton={false}
        inputClassName={`!pr-20 ${inputClassName}`}
      />

      {value.trim() && (
        <div className="absolute right-1 top-1/2 z-10 flex -translate-y-1/2 items-center gap-0.5">
          <ButtonBase
            type="button"
            onClick={handleConfirm}
            disabled={isConfirmed}
            aria-label={isConfirmed ? 'Endereço confirmado' : 'Confirmar endereço'}
            title={isConfirmed ? 'Endereço confirmado' : 'Confirmar endereço'}
            className={`grid h-8 w-8 place-items-center rounded-full transition ${
              isConfirmed
                ? 'bg-emerald-50 text-emerald-600'
                : 'text-emerald-600 hover:bg-emerald-50'
            }`}
          >
            {isConfirmed ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
          </ButtonBase>
          <ButtonBase
            type="button"
            onClick={handleClear}
            aria-label="Apagar endereço"
            title="Apagar endereço"
            className="grid h-8 w-8 place-items-center rounded-full text-[var(--mazzi-muted)] transition hover:bg-rose-50 hover:text-rose-600"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </ButtonBase>
        </div>
      )}
    </div>
  );
};
