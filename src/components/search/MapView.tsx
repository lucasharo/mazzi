import { ButtonBase } from '../ui/Button';
// ============================================================================
// MAZZI PLATFORM — SEARCH MAP VIEW COMPONENT
// Integrates Leaflet map view with public approximate provider coordinates,
// coverage radius visualization, and tile provider abstraction.
// ============================================================================

import React, { useState } from 'react';
import { UniversalMap } from '../maps/UniversalMap';
import { PublicSearchProviderResult, Provider } from '../../types';
import { getActiveMapTileProvider } from '../../domain/maps/map-tile-provider';
import { Compass, Radio, MapPin } from 'lucide-react';

export interface MapViewProps {
  results: PublicSearchProviderResult[];
  selectedProviderId?: string | null;
  onSelectProvider: (providerId: string) => void;
  height?: string;
  showCoverageRadius?: boolean;
  userLocation?: { lat: number; lng: number };
  searchedLocation?: { lat: number; lng: number; label?: string };
}

export const MapView: React.FC<MapViewProps> = ({
  results,
  selectedProviderId,
  onSelectProvider,
  height = '380px',
  showCoverageRadius = true,
  userLocation,
  searchedLocation,
}) => {
  const activeTile = getActiveMapTileProvider();
  const [showRadius, setShowRadius] = useState(showCoverageRadius);
  const [hasMapError] = useState(false);

  // Map public result DTOs back into Provider compatibility objects for UniversalMap
  const safeResults = results || [];
  const mappedProviders: Provider[] = safeResults.map((res) => ({
    id: res.providerId,
    name: res.displayName,
    type: res.providerType,
    avatarUrl: res.avatarUrl,
    documentType: res.providerType === 'DRIVING_SCHOOL' ? 'CNPJ' : 'CPF',
    status: 'ACTIVE',
    city: res.city,
    state: 'SP',
    neighborhood: res.neighborhood,
    latitude: res.publicMapLocation.latitude,
    longitude: res.publicMapLocation.longitude,
    categories: res.categories,
    transmissions: res.transmissions,
    ratingAverage: res.ratingAverage,
    ratingCount: res.ratingCount,
    startingPriceInCents: res.startingPriceInCents,
    isVerified: res.isVerified,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  const selectedProvider = mappedProviders.find((p) => p.id === selectedProviderId) || null;

  if (hasMapError) {
    return (
      <div
        style={{ height }}
        className="w-full bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center p-6 text-center"
      >
        <MapPin className="w-8 h-8 text-slate-400 mb-2 animate-bounce" />
        <h4 className="text-sm font-bold text-slate-800">Visão de mapa indisponível no momento</h4>
        <p className="text-xs text-slate-500 max-w-md mt-1">
          A busca e listagem de instrutores continuam 100% funcionais. Utilize a lista abaixo para escolher seu instrutor ou autoescola.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Map Bar Controls */}
      <div className="hidden flex items-center justify-between px-1 text-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1">
            <Compass className="w-3.5 h-3.5 text-amber-500" />
            Mapa de Localização Aproximada ({results.length})
          </span>
          <span className="text-[10px] text-slate-500 font-semibold hidden sm:inline">
            • {activeTile.name}
          </span>
        </div>

        <ButtonBase
          type="button"
          onClick={() => setShowRadius(!showRadius)}
          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer flex items-center gap-1 ${
            showRadius
              ? 'bg-amber-100 border-amber-300 text-amber-900'
              : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
          }`}
        >
          <Radio className="w-2.5 h-2.5" />
          <span>{showRadius ? 'Ocultar Raio' : 'Ver Raio (2.2km)'}</span>
        </ButtonBase>
      </div>

      {/* Universal Leaflet Map Container */}
      <UniversalMap
        providers={mappedProviders}
        selectedProvider={selectedProvider}
        onSelectProvider={(p) => onSelectProvider(p.id)}
        height={height}
        showCoverageRadius={showRadius}
        userLocation={userLocation}
        searchedLocation={searchedLocation}
      />

      <p className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
        <MapPin className="w-3 h-3 text-amber-500" />
        Por motivos de segurança e privacidade, o mapa exibe o centro do bairro/região de atendimento.
      </p>
    </div>
  );
};
