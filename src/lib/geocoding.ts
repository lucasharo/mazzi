import { activeGeocodingProvider } from '../domain/maps/geocoding-provider';

export interface GeocodedAddress {
  latitude: number;
  longitude: number;
  displayName: string;
}

/** Compatibility wrapper over the canonical Geoapify/development adapter. */
export async function geocodeAddress(address: string): Promise<GeocodedAddress> {
  const [first] = await activeGeocodingProvider.geocode(address);
  if (!first) throw new Error('ADDRESS_NOT_FOUND');
  return { latitude: first.latitude, longitude: first.longitude, displayName: first.formattedAddress };
}
