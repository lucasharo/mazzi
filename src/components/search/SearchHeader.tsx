// ============================================================================
// MAZZI PLATFORM — SEARCH HEADER COMPONENT
// Handles location entry, "Use My Location", category selection, and quick date filter.
// ============================================================================

import React, { useState } from 'react';
import { Search, Navigation, Calendar as CalendarIcon, Car, Bike, Sparkles } from 'lucide-react';
import { VehicleCategory, SearchRequest } from '../../types';
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
  const [quickDate, setQuickDate] = useState<'ANY' | 'TODAY' | 'TOMORROW'>('ANY');

  const handleUseMyLocation = async () => {
    setIsLocating(true);
    try {
      if (!currentLocation) throw new Error('CURRENT_LOCATION_UNAVAILABLE');
      const { lat, lng } = currentLocation;
      const geocoded = await activeGeocodingProvider.reverseGeocode(lat, lng);
      
      setAddressInput(geocoded.formattedAddress);
      if (onLocationResolved) {
        onLocationResolved(geocoded.formattedAddress, lat, lng);
      }
      onUpdateSearch({ latitude: lat, longitude: lng });

      trackSearchAnalytics({
        eventType: 'SEARCH_PERFORMED',
        regionLabel: geocoded.formattedAddress,
        category: searchRequest.category,
      });
    } catch (e) {
      console.warn('Location detection fallback triggered:', e);
    } finally {
      setIsLocating(false);
    }
  };

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressInput.trim()) return;

    try {
      const best = await geocodeAddress(addressInput.trim());
      setAddressInput(best.displayName);
      onLocationResolved?.(best.displayName, best.latitude, best.longitude);
      onUpdateSearch({ latitude: best.latitude, longitude: best.longitude });
      onPerformSearch();
    } catch (error) {
      console.warn('Address geocoding failed:', error);
      const results = await activeGeocodingProvider.geocode(addressInput.trim());
      const best = results[0];
      if (best) {
        setAddressInput(best.formattedAddress);
        onLocationResolved?.(best.formattedAddress, best.latitude, best.longitude);
        onUpdateSearch({ latitude: best.latitude, longitude: best.longitude });
      }
      onPerformSearch();
    }
  };

  const handleQuickDateChange = (mode: 'ANY' | 'TODAY' | 'TOMORROW') => {
    setQuickDate(mode);
    const today = new Date();
    if (mode === 'TODAY') {
      const iso = today.toISOString().split('T')[0];
      onUpdateSearch({ date: iso });
    } else if (mode === 'TOMORROW') {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const iso = tomorrow.toISOString().split('T')[0];
      onUpdateSearch({ date: iso });
    } else {
      onUpdateSearch({ date: undefined });
    }
  };

  return (
    <div className="bg-slate-950 text-white p-4 rounded-3xl space-y-3 shadow-md border border-slate-900">
      {/* Top Title Bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-black uppercase tracking-wider text-amber-400">
            Aulas Práticas de Direção em SP
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-bold bg-slate-900 px-2 py-0.5 rounded-full">
          Raio: {((searchRequest.radiusMeters || 5000) / 1000).toFixed(0)}km
        </span>
      </div>

      {/* Address Search & Use Location Input Group */}
      <form onSubmit={handleAddressSubmit} className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="Endereço para buscar instrutores"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            placeholder="Bairro, CEP ou estação de metrô em SP..."
            className="w-full bg-slate-900 text-white placeholder:text-slate-400 text-xs font-semibold pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
          />
        </div>

        <button
          type="submit"
          title="Buscar endereço"
          aria-label="Buscar endereço"
          className="p-2.5 rounded-xl bg-amber-400 text-slate-950 hover:bg-amber-300 transition cursor-pointer flex items-center justify-center min-w-[42px]"
        >
          <Search className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={isLocating}
          title="Usar minha localização atual"
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-amber-400 hover:bg-slate-800 transition cursor-pointer flex items-center justify-center min-w-[42px]"
        >
          <Navigation className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
          <span className="sr-only">Usar localização atual</span>
        </button>
      </form>

      {/* Category Pills & Quick Date Controls */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-900">
        {/* Category Toggle */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onUpdateSearch({ category: 'B' })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold transition cursor-pointer ${
              searchRequest.category === 'B' || !searchRequest.category
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>Carro (Cat. B)</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateSearch({ category: 'A' })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold transition cursor-pointer ${
              searchRequest.category === 'A'
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Bike className="w-3.5 h-3.5" />
            <span>Moto (Cat. A)</span>
          </button>
        </div>

        {/* Quick Date Selector */}
        <div className="flex items-center gap-1 text-[11px]">
          <button
            type="button"
            onClick={() => handleQuickDateChange('ANY')}
            className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
              quickDate === 'ANY' ? 'text-amber-400 bg-slate-900' : 'text-slate-400 hover:text-white'
            }`}
          >
            Qualquer Data
          </button>
          <button
            type="button"
            onClick={() => handleQuickDateChange('TODAY')}
            className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
              quickDate === 'TODAY' ? 'text-amber-400 bg-slate-900' : 'text-slate-400 hover:text-white'
            }`}
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => handleQuickDateChange('TOMORROW')}
            className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
              quickDate === 'TOMORROW' ? 'text-amber-400 bg-slate-900' : 'text-slate-400 hover:text-white'
            }`}
          >
            Amanhã
          </button>
        </div>
      </div>
    </div>
  );
};
