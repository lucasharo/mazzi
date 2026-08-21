import { ButtonBase } from '../ui/Button';
import React, { useState } from 'react';
import { LeafletMap } from './LeafletMap';
import { MapProviderComponent, MapProviderProps } from './MapProvider';
import { Compass, Radio } from 'lucide-react';

export const UniversalMap: MapProviderComponent = (props: MapProviderProps) => {
  const {
    providers = [],
    selectedProvider = null,
    onSelectProvider,
    height = '380px',
    className = '',
    showCoverageRadius = false,
    meetingPoint,
    userLocation,
    searchedLocation,
  } = props;

  const [showRadius, setShowRadius] = useState(showCoverageRadius);

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Map Header Controls */}
      <div className="hidden flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1">
            <Compass className="w-3.5 h-3.5 text-amber-500" />
            Mapa de Cobertura SP
          </span>
          <span className="text-[10px] text-slate-500 font-medium hidden sm:inline">
            • OpenStreetMap
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <ButtonBase
            type="button"
            onClick={() => setShowRadius(!showRadius)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer flex items-center gap-1 shadow-2xs ${
              showRadius
                ? 'bg-amber-100 border-amber-300 text-amber-900'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Radio className="w-2.5 h-2.5" />
            <span>{showRadius ? 'Ocultar Raio (2.2km)' : 'Ver Raio (2.2km)'}</span>
          </ButtonBase>
        </div>
      </div>

      {/* Render map abstraction */}
      <LeafletMap
        providers={providers}
        selectedProvider={selectedProvider}
        onSelectProvider={onSelectProvider}
        height={height}
        showCoverageRadius={showRadius}
        meetingPoint={meetingPoint}
        userLocation={userLocation}
        searchedLocation={searchedLocation}
      />
    </div>
  );
};
