import React, { useEffect, useRef, useState } from 'react';
import { Navigation, Search } from 'lucide-react';
import { SearchRequest } from '../../types';
import { activeGeocodingProvider } from '../../domain/maps/geocoding-provider';
import { geocodeAddress } from '../../lib/geocoding';
import { trackSearchAnalytics } from './SearchAnalytics';

export interface SearchHeaderProps {
  searchRequest: SearchRequest;
  onUpdateSearch: (updated: Partial<SearchRequest>) => void;
  onPerformSearch: () => void;
  currentLocationName?: string;
  currentLocation?: { lat: number; lng: number };
  onLocationResolved?: (addressName: string, lat: number, lng: number) => void;
}

export const SearchHeader: React.FC<SearchHeaderProps> = ({
  searchRequest,
  onUpdateSearch,
  onPerformSearch,
  currentLocationName = '',
  currentLocation,
  onLocationResolved,
}) => {
  const [addressInput, setAddressInput] = useState(currentLocationName);
  const [isLocating, setIsLocating] = useState(false);
  const skipNextLocationNameSync = useRef(false);

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
    const query = addressInput.trim();
    if (!query) return;
    try {
      const best = await geocodeAddress(query);
      setAddressInput(best.displayName);
      onLocationResolved?.(best.displayName, best.latitude, best.longitude);
      onUpdateSearch({ latitude: best.latitude, longitude: best.longitude });
    } catch (error) {
      console.warn('Address geocoding failed:', error);
      const [fallback] = await activeGeocodingProvider.geocode(query);
      if (fallback) {
        setAddressInput(fallback.formattedAddress);
        onLocationResolved?.(fallback.formattedAddress, fallback.latitude, fallback.longitude);
        onUpdateSearch({ latitude: fallback.latitude, longitude: fallback.longitude });
      }
    } finally {
      onPerformSearch();
    }
  };

  return (
    <section className="space-y-4" aria-label="Buscar aulas">
      <form onSubmit={handleAddressSubmit} className="mazzi-card p-3 sm:p-4 focus-within:ring-2 focus-within:ring-[var(--mazzi-yellow)] focus-within:ring-offset-2 transition-all">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={isLocating}
            aria-label="Usar minha localização atual"
            title="Usar minha localização atual"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] transition hover:brightness-95 active:scale-95 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)] cursor-pointer"
          >
            <Navigation className={`h-5 w-5 ${isLocating ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
          <label className="min-w-0 flex-1 cursor-text">
            <span className="block text-[10px] font-extrabold uppercase tracking-[.14em] text-[var(--mazzi-muted)]">
              Localização
            </span>
            <input
              type="text"
              aria-label="Endereço para buscar instrutores"
              value={addressInput}
              onChange={(event) => setAddressInput(event.target.value)}
              placeholder="Sua localização atual"
              className="mt-0.5 sm:mt-1 w-full min-h-[32px] bg-transparent text-sm font-extrabold text-[var(--mazzi-dark)] outline-none placeholder:text-slate-400 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            aria-label="Buscar endereço"
            title="Buscar endereço"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--mazzi-dark)] text-white transition hover:bg-[#34353a] active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)] cursor-pointer"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </form>
    </section>
  );
};
