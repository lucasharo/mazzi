import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, Navigation, Search, SlidersHorizontal } from 'lucide-react';
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
  onOpenFilters?: () => void;
  activeFilterCount?: number;
}

export const SearchHeader: React.FC<SearchHeaderProps> = ({
  searchRequest,
  onUpdateSearch,
  onPerformSearch,
  currentLocationName = '',
  currentLocation,
  onLocationResolved,
  onOpenFilters,
  activeFilterCount = 0,
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
    // A localização atual é representada pelo placeholder, não por um
    // endereço reverso que pode ser impreciso ou excessivamente longo.
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
      <form onSubmit={handleAddressSubmit} className="mazzi-card p-4 focus-within:ring-2 focus-within:ring-[var(--mazzi-yellow)]">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)]"><Navigation className={`h-5 w-5 ${isLocating ? 'animate-spin' : ''}`}/></span><label className="min-w-0 flex-1"><span className="block text-[10px] font-extrabold uppercase tracking-[.14em] text-[var(--mazzi-muted)]">Localização</span><input type="text" aria-label="Endereço para buscar instrutores" value={addressInput} onChange={(event) => setAddressInput(event.target.value)} placeholder="Sua localização atual" className="mt-1 w-full truncate bg-transparent text-sm font-extrabold outline-none placeholder:text-[var(--mazzi-text)]"/></label><button type="submit" aria-label="Buscar endereço" className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--mazzi-dark)] text-white"><ChevronRight className="h-5 w-5"/></button></div>
        <div className="mt-3 flex gap-2"><button type="button" onClick={handleUseMyLocation} disabled={isLocating} className="min-h-10 flex-1 rounded-xl bg-[var(--mazzi-surface-soft)] px-3 text-xs font-bold">Usar localização atual</button>{onOpenFilters && <button type="button" onClick={onOpenFilters} className="flex min-h-10 items-center gap-2 rounded-xl bg-[var(--mazzi-surface-soft)] px-3 text-xs font-bold"><SlidersHorizontal className="h-4 w-4"/>Filtros{activeFilterCount > 0 ? ` ${activeFilterCount}` : ''}</button>}</div>
      </form>
    </section>
  );
};
