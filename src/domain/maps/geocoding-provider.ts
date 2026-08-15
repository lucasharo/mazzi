// ============================================================================
// MAZZI PLATFORM — GEOCODING PROVIDER ABSTRACTION
// Isolates address resolution and reverse-geocoding behind an explicit interface.
// Production requires a dedicated paid/managed geocoding provider (e.g. Google Maps, Mapbox).
// Public free APIs (like public Nominatim) MUST NOT be hardcoded as production dependencies.
// ============================================================================

import { PENDING_DECISIONS } from '../../types';

export interface GeocodingLocationResult {
  formattedAddress: string;
  neighborhood: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  postalCode?: string;
  placeId?: string;
}

export interface GeocodingProvider {
  id: string;
  name: string;
  isProductionReady: boolean;
  statusTag: string;
  geocode(addressQuery: string): Promise<GeocodingLocationResult[]>;
  reverseGeocode(latitude: number, longitude: number): Promise<GeocodingLocationResult>;
}

// Known Sao Paulo Neighborhoods & Centroids for Development Adapter
const SP_NEIGHBORHOOD_CENTROIDS: Record<string, { lat: number; lng: number; neighborhood: string }> = {
  pinheiros: { lat: -23.5658, lng: -46.6872, neighborhood: 'Pinheiros' },
  'bela vista': { lat: -23.5587, lng: -46.6483, neighborhood: 'Bela Vista' },
  'vila mariana': { lat: -23.5891, lng: -46.6342, neighborhood: 'Vila Mariana' },
  moema: { lat: -23.6019, lng: -46.6622, neighborhood: 'Moema' },
  santana: { lat: -23.5025, lng: -46.6247, neighborhood: 'Santana' },
  tatuape: { lat: -23.5398, lng: -46.5765, neighborhood: 'Tatuapé' },
  'itaim bibi': { lat: -23.5852, lng: -46.6811, neighborhood: 'Itaim Bibi' },
  'paulista': { lat: -23.5615, lng: -46.6559, neighborhood: 'Bela Vista' },
  'faria lima': { lat: -23.5794, lng: -46.6878, neighborhood: 'Pinheiros' },
  'santo amaro': { lat: -23.6521, lng: -46.7092, neighborhood: 'Santo Amaro' },
  'centro': { lat: -23.5505, lng: -46.6333, neighborhood: 'Centro' },
};

export class DevelopmentGeocodingAdapter implements GeocodingProvider {
  public id = 'development_sp_mock_adapter';
  public name = 'MAZZI SP Development Geocoding Adapter';
  public isProductionReady = false;
  public statusTag = PENDING_DECISIONS.GEOCODING_PROVIDER_PRODUCTION_PENDING;

  async geocode(addressQuery: string): Promise<GeocodingLocationResult[]> {
    const normalized = addressQuery.toLowerCase().trim();

    for (const [key, val] of Object.entries(SP_NEIGHBORHOOD_CENTROIDS)) {
      if (normalized.includes(key)) {
        return [
          {
            formattedAddress: `${val.neighborhood}, São Paulo - SP`,
            neighborhood: val.neighborhood,
            city: 'São Paulo',
            state: 'SP',
            latitude: val.lat,
            longitude: val.lng,
            placeId: `dev_place_${key}`,
          },
        ];
      }
    }

    // Default Fallback Centroid for SP
    return [
      {
        formattedAddress: `${addressQuery}, São Paulo - SP`,
        neighborhood: 'São Paulo (Região Central)',
        city: 'São Paulo',
        state: 'SP',
        latitude: -23.5505,
        longitude: -46.6333,
        placeId: 'dev_place_sp_center',
      },
    ];
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<GeocodingLocationResult> {
    return {
      formattedAddress: 'Pinheiros, São Paulo - SP',
      neighborhood: 'Pinheiros',
      city: 'São Paulo',
      state: 'SP',
      latitude,
      longitude,
      placeId: 'dev_reverse_place',
    };
  }
}

export const activeGeocodingProvider: GeocodingProvider = new DevelopmentGeocodingAdapter();
