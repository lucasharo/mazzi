import { ButtonBase } from '../ui/Button';
import React, { useEffect, useRef, useState } from 'react';
import { Navigation } from 'lucide-react';
import { SearchRequest } from '../../types';
import { activeGeocodingProvider } from '../../domain/maps/geocoding-provider';
import { trackSearchAnalytics } from './SearchAnalytics';
import { ConfirmableAddressAutocomplete } from './ConfirmableAddressAutocomplete';

export interface SearchHeaderProps {
  searchRequest: SearchRequest;
  onUpdateSearch: (updated: Partial<SearchRequest>) => void;
  onPerformSearch: () => void;
  currentLocationName?: string;
  currentLocation?: { lat: number; lng: number };
  onLocationResolved?: (addressName: string, lat: number, lng: number) => void;
  onLocationCleared?: () => void;
}

export const SearchHeader: React.FC<SearchHeaderProps> = ({
  searchRequest,
  onUpdateSearch,
  onPerformSearch,
  currentLocationName = '',
  currentLocation,
  onLocationResolved,
  onLocationCleared,
}) => {
  const [addressInput, setAddressInput] = useState(currentLocationName);
  const [isLocating, setIsLocating] = useState(false);
  const [isAddressFocused, setIsAddressFocused] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const skipNextLocationNameSync = useRef(false);
  const selectedAddressRef = useRef(false);

  useEffect(() => {
    if (!isAddressFocused || typeof window === 'undefined') {
      setIsKeyboardOpen(false);
      return;
    }

    const viewport = window.visualViewport;
    if (!viewport) return;

    const updateKeyboardState = () => {
      const isMobileViewport = window.matchMedia?.('(max-width: 767px)').matches ?? false;
      const keyboardHeight = window.innerHeight - viewport.height;
      setIsKeyboardOpen(isMobileViewport && keyboardHeight > 120);
    };

    updateKeyboardState();
    viewport.addEventListener('resize', updateKeyboardState);
    viewport.addEventListener('scroll', updateKeyboardState);

    return () => {
      viewport.removeEventListener('resize', updateKeyboardState);
      viewport.removeEventListener('scroll', updateKeyboardState);
    };
  }, [isAddressFocused]);

  useEffect(() => {
    if (skipNextLocationNameSync.current) {
      skipNextLocationNameSync.current = false;
      return;
    }
    setAddressInput(currentLocationName);
  }, [currentLocationName]);

  const handleUseMyLocation = async () => {
    // A localização atual é representada pelo placeholder
    setAddressInput('');
    setIsLocating(true);
    try {
      if (!currentLocation) throw new Error('CURRENT_LOCATION_UNAVAILABLE');
      const { lat, lng } = currentLocation;
      const geocoded = await activeGeocodingProvider.reverseGeocode(lat, lng);
      skipNextLocationNameSync.current = true;
      onLocationResolved?.(geocoded.formattedAddress, lat, lng);
      onUpdateSearch({ latitude: lat, longitude: lng });
      onPerformSearch();
      trackSearchAnalytics({ eventType: 'SEARCH_PERFORMED', regionLabel: geocoded.formattedAddress, category: searchRequest.category });
    } catch (error) {
      console.warn('Location detection fallback triggered:', error);
    } finally {
      setIsLocating(false);
    }
  };

  const handleAddressSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (selectedAddressRef.current) onPerformSearch();
  };

  return (
    <section className="space-y-4" aria-label="Buscar aulas">
      <form
        onSubmit={handleAddressSubmit}
        data-keyboard-pinned={isKeyboardOpen || undefined}
        className={`mazzi-card p-3 sm:p-4 focus-within:ring-2 focus-within:ring-[var(--mazzi-yellow)] focus-within:ring-offset-2 transition-all ${isKeyboardOpen ? 'fixed inset-x-3 top-3 z-[70] mx-auto max-w-lg shadow-[0_14px_32px_rgba(16,24,40,0.18)]' : ''}`}
      >
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 sm:gap-3">
          <ButtonBase
            type="button"
            onClick={handleUseMyLocation}
            disabled={isLocating}
            aria-label="Usar minha localização atual"
            title="Usar minha localização atual"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] transition hover:brightness-95 active:scale-95 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)] cursor-pointer"
          >
            <Navigation className={`h-5 w-5 ${isLocating ? 'animate-spin' : ''}`} aria-hidden="true" />
          </ButtonBase>
          <label className="min-w-0 flex-1 cursor-text">
            <span className="block text-[10px] font-extrabold uppercase tracking-[.14em] text-[var(--mazzi-muted)]">
              Localização
            </span>
            <ConfirmableAddressAutocomplete
              value={addressInput}
              ariaLabel="Buscar endereço ou local"
              placeholder="Digite um endereço, bairro ou local"
              className="mt-0.5 sm:mt-1"
              proximity={currentLocation ? { longitude: currentLocation.lng, latitude: currentLocation.lat } : undefined}
              dropdownAlignment="viewport"
              inputClassName="min-h-[32px] bg-transparent pr-7 text-sm font-extrabold text-[var(--mazzi-text)] outline-none placeholder:text-slate-400 focus:outline-none"
              onFocus={() => setIsAddressFocused(true)}
              onBlur={() => {
                setIsAddressFocused(false);
                setIsKeyboardOpen(false);
              }}
              onChange={(value) => {
                selectedAddressRef.current = false;
                setAddressInput(value);
                if (!value.trim()) {
                  onUpdateSearch({ latitude: undefined, longitude: undefined });
                  onLocationCleared?.();
                } else {
                  onUpdateSearch({ latitude: undefined, longitude: undefined });
                }
              }}
              onClear={() => {
                selectedAddressRef.current = false;
                setAddressInput('');
                onUpdateSearch({ latitude: undefined, longitude: undefined, page: 1 });
                onLocationCleared?.();
              }}
              onConfirm={(suggestion) => {
                if (!suggestion) return;
                selectedAddressRef.current = true;
                skipNextLocationNameSync.current = true;
                onLocationResolved?.(suggestion.formattedAddress, suggestion.latitude, suggestion.longitude);
                onUpdateSearch({ latitude: suggestion.latitude, longitude: suggestion.longitude, page: 1 });
                onPerformSearch();
                trackSearchAnalytics({ eventType: 'SEARCH_PERFORMED', regionLabel: suggestion.formattedAddress, category: searchRequest.category });
              }}
            />
          </label>
        </div>
      </form>
    </section>
  );
};
