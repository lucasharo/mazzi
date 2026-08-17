import React, { useEffect, useState } from 'react';
import { MapPin, Navigation, Search, Sparkles } from 'lucide-react';
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
  currentLocationName = 'Sua localização',
  currentLocation,
  onLocationResolved,
}) => {
  const [addressInput, setAddressInput] = useState(currentLocationName);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    setAddressInput(currentLocationName || 'Sua localização');
  }, [currentLocationName]);

  const handleUseMyLocation = async () => {
    setIsLocating(true);
    try {
      if (!currentLocation) throw new Error('CURRENT_LOCATION_UNAVAILABLE');
      const { lat, lng } = currentLocation;
      const geocoded = await activeGeocodingProvider.reverseGeocode(lat, lng);
      setAddressInput(geocoded.formattedAddress);
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
      <div>
        <div className="flex items-center gap-2 text-amber-600">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span className="text-xs font-black uppercase tracking-[0.18em]">Aulas práticas</span>
        </div>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Encontre sua próxima aula</h1>
        <p className="mt-1 text-sm text-slate-500">Profissionais verificados perto de você.</p>
      </div>

      <form onSubmit={handleAddressSubmit} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-100">
        <Search className="ml-2 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
        <input type="text" aria-label="Endereço para buscar instrutores" value={addressInput} onChange={(event) => setAddressInput(event.target.value)} placeholder="Bairro, CEP ou endereço" className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400" />
        <button type="submit" aria-label="Buscar endereço" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-amber-400 transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500"><Search className="h-4 w-4" aria-hidden="true" /></button>
        <button type="button" onClick={handleUseMyLocation} disabled={isLocating} aria-label="Usar minha localização atual" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-amber-50 hover:text-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 disabled:opacity-50"><Navigation className={`h-4 w-4 ${isLocating ? 'animate-spin' : ''}`} aria-hidden="true" /></button>
      </form>

      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs font-semibold text-slate-600 shadow-sm">
        <MapPin className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        <span className="truncate">{(addressInput || 'Sua localização').split(',').slice(-2).join(',').trim()}</span>
        <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-800">Cat. B</span>
      </div>
    </section>
  );
};
