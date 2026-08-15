import React from 'react';
import { LeafletMap } from './LeafletMap';
import { MapProviderComponent } from './MapProvider';

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
  return <LeafletMap {...props} />;
};
