// ============================================================================
// MAZZI PLATFORM — GEOCODING PROVIDER ABSTRACTION
// Isolates address resolution and reverse-geocoding behind an explicit interface.
// Geoapify is the managed geocoding provider for the MVP/beta runtime.
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
  addressLine1?: string;
  addressLine2?: string;
  name?: string;
  street?: string;
  houseNumber?: string;
  district?: string;
  stateCode?: string;
  country?: string;
  countryCode?: string;
  resultType?: string;
  source?: 'GEOAPIFY' | 'DEVELOPMENT' | 'MAP_PIN';
}

export type LocationSuggestion = GeocodingLocationResult;

export interface GeocodingOptions {
  proximity?: { longitude: number; latitude: number };
  limit?: number;
  signal?: AbortSignal;
}

export interface StructuredGeocodingAddress {
  street: string;
  houseNumber?: string | null;
  postalCode: string;
  city: string;
  stateCode: string;
  countryCode?: string;
  proximity?: { longitude: number; latitude: number };
}

export interface GeocodingProvider {
  id: string;
  name: string;
  isProductionReady: boolean;
  statusTag: string;
  autocomplete?(query: string, options?: GeocodingOptions): Promise<LocationSuggestion[]>;
  geocode(addressQuery: string): Promise<GeocodingLocationResult[]>;
  geocodeStructuredAddress?(address: StructuredGeocodingAddress, signal?: AbortSignal): Promise<LocationSuggestion[]>;
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
            source: 'DEVELOPMENT',
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
      source: 'DEVELOPMENT',
      },
    ];
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<GeocodingLocationResult> {
    return {
      formattedAddress: 'Sua localização atual',
      neighborhood: 'São Paulo',
      city: 'São Paulo',
      state: 'SP',
      latitude,
      longitude,
      placeId: 'dev_reverse_place',
      source: 'DEVELOPMENT',
    };
  }
}

function normalizeGeoapifyFeature(feature: any): LocationSuggestion | null {
  const props = feature?.properties || feature || {};
  const latitude = Number(props.lat ?? feature?.geometry?.coordinates?.[1]);
  const longitude = Number(props.lon ?? feature?.geometry?.coordinates?.[0]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !props.formatted) return null;
  return {
    formattedAddress: String(props.formatted),
    addressLine1: props.address_line1 || undefined,
    addressLine2: props.address_line2 || undefined,
    name: props.name || undefined,
    neighborhood: props.suburb || props.district || props.city_district || '',
    district: props.district || undefined,
    city: props.city || props.town || props.village || '',
    state: props.state || '',
    stateCode: props.state_code || props.county_code || undefined,
    postalCode: props.postcode || undefined,
    country: props.country || undefined,
    countryCode: props.country_code || undefined,
    street: props.street || undefined,
    houseNumber: props.housenumber || undefined,
    latitude,
    longitude,
    placeId: props.place_id || undefined,
    resultType: props.result_type || undefined,
    source: 'GEOAPIFY',
  };
}

export class GeoapifyGeocodingProvider implements GeocodingProvider {
  public id = 'geoapify';
  public name = 'Geoapify';
  public isProductionReady = true;
  public statusTag = 'GEOAPIFY_CONFIGURED';
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.geoapify.com/v1/geocode';

  constructor(apiKey = String(import.meta.env.VITE_GEOAPIFY_API_KEY || '').trim()) {
    this.apiKey = apiKey;
  }

  private async request(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<LocationSuggestion[]> {
    if (!this.apiKey) throw new Error('GEOAPIFY_API_KEY_MISSING');
    const query = new URLSearchParams({ ...params, apiKey: this.apiKey, format: 'json' });
    const response = await fetch(`${this.baseUrl}/${path}?${query.toString()}`, { signal, headers: { Accept: 'application/json' } });
    if (response.status === 429) throw new Error('GEOAPIFY_RATE_LIMIT');
    if (!response.ok) throw new Error('GEOAPIFY_UNAVAILABLE');
    const body = await response.json() as { results?: any[]; features?: any[] };
    const records = body.results || body.features || [];
    return records.map(normalizeGeoapifyFeature).filter(Boolean) as LocationSuggestion[];
  }

  autocomplete(query: string, options: GeocodingOptions = {}): Promise<LocationSuggestion[]> {
    const params: Record<string, string> = {
      text: query,
      filter: 'countrycode:br',
      lang: 'pt',
      limit: String(Math.min(Math.max(options.limit || 6, 5), 8)),
    };
    if (options.proximity) params.bias = `proximity:${options.proximity.longitude},${options.proximity.latitude}`;
    return this.request('autocomplete', params, options.signal);
  }

  geocode(addressQuery: string): Promise<LocationSuggestion[]> {
    return this.request('search', { text: addressQuery, filter: 'countrycode:br', lang: 'pt', limit: '5' });
  }

  geocodeStructuredAddress(address: StructuredGeocodingAddress, signal?: AbortSignal): Promise<LocationSuggestion[]> {
    const params: Record<string, string> = { street: address.street, postcode: address.postalCode, city: address.city, state: address.stateCode, country: address.countryCode || 'br', filter: 'countrycode:br', lang: 'pt', limit: '5' };
    if (address.houseNumber?.trim()) params.housenumber = address.houseNumber.trim();
    if (address.proximity) params.bias = `proximity:${address.proximity.longitude},${address.proximity.latitude}`;
    return this.request('search', params, signal);
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<LocationSuggestion> {
    const [result] = await this.request('reverse', { lat: String(latitude), lon: String(longitude), lang: 'pt', limit: '1' });
    if (!result) throw new Error('ADDRESS_NOT_FOUND');
    return result;
  }
}

const geoapifyKey = String(import.meta.env.VITE_GEOAPIFY_API_KEY || '').trim();
export const activeGeocodingProvider: GeocodingProvider = geoapifyKey
  ? new GeoapifyGeocodingProvider(geoapifyKey)
  : new DevelopmentGeocodingAdapter();
