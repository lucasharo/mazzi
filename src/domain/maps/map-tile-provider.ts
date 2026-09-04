// ============================================================================
// MAZZI PLATFORM — MAP TILE PROVIDER ABSTRACTION
// Decouples Leaflet/Map presentation from hardcoded tile server URLs.
// Allows seamless switching between OSM, CartoDB, Mapbox, or custom tile CDN.
// ============================================================================

export interface MapTileProvider {
  id: string;
  name: string;
  urlTemplate: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string[];
  isDevelopmentFallback?: boolean;
}

export const OSM_MAP_TILE_PROVIDER: MapTileProvider = {
  id: 'openstreetmap',
  name: 'OpenStreetMap Standard',
  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
  isDevelopmentFallback: true,
};

export const CARTO_POSITRON_TILE_PROVIDER: MapTileProvider = {
  id: 'carto_positron',
  name: 'CartoDB Positron Light',
  urlTemplate: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  maxZoom: 20,
  subdomains: ['a', 'b', 'c', 'd'],
  isDevelopmentFallback: false,
};

export function getActiveMapTileProvider(providerId?: string): MapTileProvider {
  if (providerId === 'carto') {
    return CARTO_POSITRON_TILE_PROVIDER;
  }
  return OSM_MAP_TILE_PROVIDER;
}
