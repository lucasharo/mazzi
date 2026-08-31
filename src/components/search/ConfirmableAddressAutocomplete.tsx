import React, { useId, useState } from 'react';
import { Check, CheckCircle2, Trash2, X } from 'lucide-react';
import { LocationSuggestion } from '../../domain/maps/geocoding-provider';
import { Button, ButtonBase } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { AddressAutocomplete } from './AddressAutocomplete';

export interface ConfirmableAddressAutocompleteProps {
  id?: string;
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
  onFocus?: () => void;
  onBlur?: () => void;
}

/** Address field that opens its own confirmation dialog, similar to a map app. */
export const ConfirmableAddressAutocomplete: React.FC<ConfirmableAddressAutocompleteProps> = ({
  id,
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
  onFocus,
  onBlur,
}) => {
  const modalId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [draftValue, setDraftValue] = useState(value);
  const [pendingSuggestion, setPendingSuggestion] = useState<LocationSuggestion | null>(null);

  const openModal = () => {
    setDraftValue(value);
    setPendingSuggestion(null);
    setIsOpen(true);
  };

  const closeModal = () => {
    setDraftValue(value);
    setPendingSuggestion(null);
    setIsOpen(false);
  };

  const handleDraftChange = (nextValue: string) => {
    setDraftValue(nextValue);
    setPendingSuggestion(null);
  };

  const handleSelect = (suggestion: LocationSuggestion) => {
    setDraftValue(suggestion.formattedAddress);
    setPendingSuggestion(suggestion);
  };

  const handleConfirm = () => {
    const nextValue = draftValue.trim();
    if (!nextValue) return;
    onChange(nextValue);
    onConfirm(pendingSuggestion, nextValue);
    setPendingSuggestion(null);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setPendingSuggestion(null);
    onClear?.();
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          id={id}
          value={value}
          readOnly
          role="combobox"
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-expanded={isOpen}
          aria-controls={`confirmable-address-${modalId}`}
          aria-haspopup="dialog"
          aria-readonly="true"
          onClick={openModal}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openModal();
            }
          }}
          className={`w-full cursor-pointer ${inputClassName} !pr-20`}
        />
        <div className="absolute right-1 top-1/2 z-10 flex -translate-y-1/2 items-center gap-0.5">
          {value.trim() && <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Endereço confirmado" />}
          {value.trim() && <ButtonBase type="button" onClick={(event) => { event.stopPropagation(); handleClear(); }} aria-label="Apagar endereço" title="Apagar endereço" className="grid h-8 w-8 place-items-center rounded-full text-[var(--mazzi-muted)] transition hover:bg-rose-50 hover:text-rose-600"><X className="h-4 w-4" aria-hidden="true" /></ButtonBase>}
        </div>
      </div>

      <Modal
        id={`confirmable-address-${modalId}`}
        isOpen={isOpen}
        onClose={closeModal}
        title="Confirmar endereço"
        size="md"
        layer="nested"
        footer={(
          <>
            <Button type="button" variant="ghost" size="sm" onClick={handleClear} disabled={!draftValue.trim()} leftIcon={<Trash2 className="h-4 w-4" aria-hidden="true" />}>Apagar</Button>
            <Button type="button" variant="outline" size="sm" onClick={closeModal}>Cancelar</Button>
            <Button type="button" variant="primary" size="sm" onClick={handleConfirm} disabled={!draftValue.trim()} leftIcon={<Check className="h-4 w-4" aria-hidden="true" />}>Confirmar endereço</Button>
          </>
        )}
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-[var(--mazzi-muted)]">Busque o ponto de encontro e confirme o endereço para continuar.</p>
          <AddressAutocomplete
            value={draftValue}
            onChange={handleDraftChange}
            onSelect={handleSelect}
            placeholder={placeholder}
            ariaLabel={ariaLabel}
            proximity={proximity}
            dropdownAlignment="input"
            showClearButton={false}
            inputClassName={`!pr-4 ${inputClassName}`}
          />
        </div>
      </Modal>
    </div>
  );
};
