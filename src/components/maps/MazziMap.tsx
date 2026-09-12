import React, { Suspense } from 'react';
import { MapProviderComponent } from './MapProvider';

const LazyLeafletMap = React.lazy(() => import('./LeafletMap').then((module) => ({
  default: module.LeafletMap,
})));

// Coordinate locations for mock providers in São Paulo
export const PROVIDER_COORDINATES: Record<string, { lat: number; lng: number }> = {
  prov_1: { lat: -23.5658, lng: -46.6872 }, // Pinheiros / Fradique Coutinho
  prov_2: { lat: -23.5629, lng: -46.6544 }, // Bela Vista / Brigadeiro
  prov_3: { lat: -23.5886, lng: -46.6389 }, // Vila Mariana
  prov_4: { lat: -23.6045, lng: -46.6631 }, // Moema
};

/**
 * MazziMap:
 * Standard application map utilizing the MapProvider contract.
 * Backed by Leaflet / OpenStreetMap for the MVP.
 */
export const MazziMap: MapProviderComponent = (props) => {
  return (
    <Suspense fallback={<div style={{ height: props.height || '380px' }} className="w-full rounded-2xl bg-slate-100" />}>
      <LazyLeafletMap {...props} />
    </Suspense>
  );
};
