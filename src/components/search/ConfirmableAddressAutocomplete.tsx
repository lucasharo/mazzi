import React, { useId, useRef, useState } from 'react';
import { LoaderCircle, Navigation, X } from 'lucide-react';
import { activeGeocodingProvider, LocationSuggestion } from '../../domain/maps/geocoding-provider';
import { ButtonBase } from '../ui/Button';
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

function getEditableAddress(suggestion: LocationSuggestion): string {
  const street = suggestion.street?.trim();
  const houseNumber = suggestion.houseNumber?.trim();
  if (street) return houseNumber ? `${street} ${houseNumber}` : street;

  const addressLine1 = suggestion.addressLine1?.trim();
  if (addressLine1) return addressLine1;

  return suggestion.formattedAddress.split(',')[0]?.trim() || suggestion.formattedAddress;
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
  const triggerInputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [draftValue, setDraftValue] = useState(value);
  const [modalOrigin, setModalOrigin] = useState({ x: '50vw', y: '50vh' });
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const modalInputId = `confirmable-address-input-${modalId}`;

  const openModal = () => {
    const bounds = triggerInputRef.current?.getBoundingClientRect();
    if (bounds) {
      setModalOrigin({
        x: `${bounds.left + bounds.width / 2}px`,
        y: `${bounds.top + bounds.height / 2}px`,
      });
    }
    setDraftValue(value);
    setLocationError(null);
    setIsOpen(true);
  };

  const closeModal = () => {
    setDraftValue(value);
    setIsOpen(false);
  };

  const handleDraftChange = (nextValue: string) => {
    setDraftValue(nextValue);
    setLocationError(null);
  };

  const handleSelect = (suggestion: LocationSuggestion) => {
    const nextValue = suggestion.formattedAddress;
    setDraftValue(nextValue);
    setLocationError(null);
    onChange(nextValue);
    onConfirm(suggestion, nextValue);
    setIsOpen(false);
  };

  const handleEditSuggestion = (suggestion: LocationSuggestion) => {
    setDraftValue(getEditableAddress(suggestion));
    setLocationError(null);
    window.requestAnimationFrame(() => document.getElementById(modalInputId)?.focus());
  };

  const handleUseCurrentLocation = () => {
    if (isLocating) return;
    if (!navigator.geolocation) {
      setLocationError('A localização do dispositivo não está disponível.');
      return;
    }

    setIsLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        void (async () => {
          try {
            const suggestion = await activeGeocodingProvider.reverseGeocode(coords.latitude, coords.longitude);
            handleSelect(suggestion);
          } catch (error) {
            console.warn('ADDRESS_REVERSE_GEOCODING_FAILED', error);
            setLocationError('Não foi possível identificar seu endereço. Tente buscar na lista.');
          } finally {
            setIsLocating(false);
          }
        })();
      },
      (error) => {
        console.warn('CURRENT_LOCATION_UNAVAILABLE', error);
        setLocationError('Permita o acesso à localização para usar este botão.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const handleClear = () => {
    onChange('');
    onClear?.();
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          id={id}
          ref={triggerInputRef}
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
          className={`w-full cursor-pointer ${inputClassName} !pr-12`}
        />
        <div className="absolute right-0 top-1/2 z-10 flex -translate-y-1/2 items-center">
          {value.trim() && <ButtonBase type="button" onClick={(event) => { event.stopPropagation(); handleClear(); }} aria-label="Apagar endereço" title="Apagar endereço" className="grid h-8 w-8 place-items-center rounded-full text-[var(--mazzi-muted)] transition hover:bg-rose-50 hover:text-rose-600"><X className="h-4 w-4" aria-hidden="true" /></ButtonBase>}
        </div>
      </div>

      <Modal
        id={`confirmable-address-${modalId}`}
        isOpen={isOpen}
        onClose={closeModal}
        ariaLabel="Confirmar endereço"
        layer="nested"
        presentation="fullscreen"
      >
        <div
          className="mazzi-address-modal-panel min-h-full space-y-4 bg-[var(--mazzi-bg)] px-4 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-6"
          style={{
            '--mazzi-address-origin-x': modalOrigin.x,
            '--mazzi-address-origin-y': modalOrigin.y,
          } as React.CSSProperties}
        >
          <div className="relative">
            <AddressAutocomplete
              id={modalInputId}
              className="contents"
              inputWrapperClassName="min-h-[74px] rounded-[28px] border border-[var(--mazzi-border)] bg-white px-4 pb-3 pl-[4.5rem] pr-12 pt-8 shadow-[0_12px_32px_rgba(32,33,38,0.08)] sm:px-5 sm:pb-4 sm:pl-[4.75rem] sm:pr-14 sm:pt-9"
              inputLabel={<span className="pointer-events-none absolute left-[4.5rem] top-3 z-10 mazzi-field-label sm:left-[4.75rem] sm:top-3.5">Localização</span>}
              inputLeading={(
                <ButtonBase
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={isLocating}
                  aria-label="Usar minha localização atual"
                  title="Usar minha localização atual"
                  className="absolute left-4 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-2xl bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] transition hover:brightness-95 active:scale-95 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)]"
                >
                  {isLocating
                    ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
                    : <Navigation className="h-5 w-5" aria-hidden="true" />}
                </ButtonBase>
              )}
              inputTrailing={(
                <div className="absolute right-2 top-[calc(50%+10px)] z-10 flex -translate-y-1/2 items-center gap-1">
                  {draftValue.trim() && <ButtonBase type="button" onClick={() => { setDraftValue(''); setLocationError(null); }} aria-label="Apagar endereço pesquisado" title="Apagar endereço pesquisado" className="grid h-9 w-9 place-items-center rounded-full text-[var(--mazzi-muted)] transition hover:bg-rose-50 hover:text-rose-600"><X className="h-4 w-4" aria-hidden="true" /></ButtonBase>}
                </div>
              )}
              value={draftValue}
              onChange={handleDraftChange}
              onSelect={handleSelect}
              onEditSuggestion={handleEditSuggestion}
              placeholder={placeholder}
              ariaLabel={ariaLabel}
              proximity={proximity}
              dropdownAlignment="input"
              suggestionsMode="list"
              searchInitialValue
              showClearButton={false}
              inputClassName={`!min-h-7 !rounded-none !border-0 !bg-transparent !px-0 !py-0 !pl-0 !pr-0 !text-base !font-extrabold !text-[var(--mazzi-text)] !shadow-none focus:!border-0 focus:!ring-0 ${inputClassName}`}
            />
            {locationError && <p className="mt-2 text-xs font-semibold text-rose-700" role="alert">{locationError}</p>}
          </div>
        </div>
      </Modal>
    </div>
  );
};
